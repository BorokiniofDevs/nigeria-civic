// lib/civic/reportService.ts — Phase 3 intake + moderation service.
//
// Implements the PHASE3_PLAN §4 security matrix client-side. In production
// this logic lives behind the API with PostgreSQL RLS as the authority; here
// it runs against an in-memory store seeded with NOTHING, so the reporting
// workflow is real and testable end-to-end. The migration 0005 schema is the
// production target — this service mirrors its rules 1:1.
//
// SECURITY MODEL (mirrors the RLS pins):
//   citizen   → submitReport, addEvidence, addNote (intake only; states pinned)
//   moderator → all of the above + workflow transitions, evidence review,
//               claim creation/linking, assignment, resolution, duplicates.
//               Every action appends to report_events. Nothing is deleted.
//
// The DEV role switch is NOT a security boundary. It exists so the
// DEV-ONLY moderator console can exercise the workflow. Production
// authorization is the API session role + database RLS.
import type {
  CitizenReport,
  EvidenceSubmissionInput,
  ReportEvent,
  ReportEventKind,
  ReportEvidence,
  ReportStatus,
  ReportClaimLink,
  ReportClaimRelationship,
  ReportSubmissionInput,
  Severity,
} from './reporting';
import {
  MAX_EVIDENCE_PER_REPORT,
  MAX_REPORTS_PER_HOUR,
  allowedReportTransitions,
  assertClaimNotVerifiedFromReport,
  canTransitionReport,
  claimInitialStateForReport,
  validateEvidenceMetadata,
  validateReportSubmission,
} from './reporting';
import type { CivicClaim, CivicEvent } from './types';

/** DEV-ONLY role. Not a security boundary — see module doc. */
export type ServiceRole = 'citizen' | 'moderator';

export interface ServiceContext {
  role: ServiceRole;
  /** Internal actor id. Never exposed publicly. */
  actorId?: string | null;
  /** Hashed session/device fingerprint for rate limiting. */
  fingerprint: string;
}

export type ServiceErrorCode =
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'MODERATOR_ONLY'
  | 'RATE_LIMITED'
  | 'ILLEGAL_TRANSITION'
  | 'EVIDENCE_LIMIT'
  | 'ALREADY_LINKED';

export class ReportServiceError extends Error {
  code: ServiceErrorCode;
  details: string[];
  constructor(code: ServiceErrorCode, message: string, details: string[] = []) {
    super(message);
    this.name = 'ReportServiceError';
    this.code = code;
    this.details = details;
  }
}

export interface ClaimInput {
  claimKey: string;
  claimLabel: string;
  claimValue: string;
}

/** Everything the report detail panel needs, in canonical order. */
export interface ReportDetailBundle {
  report: CitizenReport;
  evidence: ReportEvidence[];
  events: ReportEvent[];
  claims: { claim: CivicClaim; relationship: ReportClaimRelationship }[];
}

interface IntakeLogEntry {
  fingerprint: string;
  reporterId: string | null;
  at: number;
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function createReportService() {
  const reports = new Map<string, CitizenReport>();
  const evidence = new Map<string, ReportEvidence>();
  const events = new Map<string, ReportEvent[]>(); // reportId → events
  const claims = new Map<string, CivicClaim>();
  const claimLinks: ReportClaimLink[] = [];
  const intakeLog: IntakeLogEntry[] = [];

  function requireModerator(ctx: ServiceContext): void {
    if (ctx.role !== 'moderator') {
      throw new ReportServiceError(
        'MODERATOR_ONLY',
        'This action requires the moderator role. The dev role switch is not a security boundary; production enforces this via RLS/service_role.',
      );
    }
  }

  function getReportOrThrow(id: string): CitizenReport {
    const r = reports.get(id);
    if (!r) throw new ReportServiceError('NOT_FOUND', `Report ${id} not found.`);
    return r;
  }

  function appendEvent(
    reportId: string,
    actorType: ReportEvent['actorType'],
    event: ReportEventKind,
    opts: { actorId?: string | null; note?: string | null; oldStatus?: ReportStatus | null; newStatus?: ReportStatus | null } = {},
  ): ReportEvent {
    const ev: ReportEvent = {
      id: newId('revt'),
      reportId,
      actorType,
      actorId: opts.actorId ?? null,
      event,
      note: opts.note ?? null,
      oldStatus: opts.oldStatus ?? null,
      newStatus: opts.newStatus ?? null,
      createdAt: nowIso(),
    };
    events.get(reportId)!.push(ev);
    return ev;
  }

  function touch(r: CitizenReport): void {
    r.updatedAt = nowIso();
    reports.set(r.id, r);
  }

  // ------------------------------------------------------------------
  // Citizen intake — states pinned, exactly like the RLS WITH CHECK.
  // ------------------------------------------------------------------
  function submitReport(input: ReportSubmissionInput, ctx: ServiceContext): CitizenReport {
    const v = validateReportSubmission(input);
    if (!v.ok) throw new ReportServiceError('VALIDATION', 'Report submission failed validation.', v.errors);

    // Operational rate limit (no scoring, no ranking — a plain counter).
    const hourAgo = Date.now() - 3600 * 1000;
    const recent = intakeLog.filter((e) => e.fingerprint === ctx.fingerprint && e.at >= hourAgo);
    if (recent.length >= MAX_REPORTS_PER_HOUR) {
      throw new ReportServiceError(
        'RATE_LIMITED',
        `Too many submissions. Please wait before submitting again (limit: ${MAX_REPORTS_PER_HOUR}/hour).`,
      );
    }

    const id = newId('rep');
    const now = nowIso();
    const report: CitizenReport = {
      id,
      sectorId: null,
      category: input.category.trim(),
      title: input.title.trim(),
      description: input.description.trim(),
      observedAt: input.observedAt ?? null,
      locationStatus: input.locationStatus,
      geom: input.geom ?? null,
      geoEntityId: input.geoEntityId ?? null,
      reporterId: ctx.actorId ?? null,
      isAnonymous: input.isAnonymous ?? !ctx.actorId,
      // PINNED — mirrors reports_intake WITH CHECK. Citizens submit;
      // they never publish, verify, or resolve.
      status: 'reported',
      informationState: 'citizen_submitted',
      severity: (input.severity ?? 'medium') as Severity,
      assignedInstitutionId: null,
      resolutionNote: null,
      resolvedAt: null,
      duplicateOf: null,
      createdAt: now,
      updatedAt: now,
    };
    reports.set(id, report);
    events.set(id, []);
    intakeLog.push({ fingerprint: ctx.fingerprint, reporterId: report.reporterId ?? null, at: Date.now() });
    appendEvent(id, 'citizen', 'created', {
      actorId: report.reporterId,
      note: 'Report submitted by a citizen. An allegation, not a fact.',
    });
    return { ...report };
  }

  function addEvidence(reportId: string, input: EvidenceSubmissionInput, ctx: ServiceContext): ReportEvidence {
    const report = getReportOrThrow(reportId);
    const v = validateEvidenceMetadata(input);
    if (!v.ok) throw new ReportServiceError('VALIDATION', 'Evidence metadata failed validation.', v.errors);

    const existing = [...evidence.values()].filter((e) => e.reportId === reportId);
    if (existing.length >= MAX_EVIDENCE_PER_REPORT) {
      throw new ReportServiceError('EVIDENCE_LIMIT', `A report may carry at most ${MAX_EVIDENCE_PER_REPORT} evidence items.`);
    }
    if (['resolved', 'rejected', 'duplicate'].includes(report.status)) {
      throw new ReportServiceError(
        'ILLEGAL_TRANSITION',
        `Cannot attach evidence while the report is ${report.status}. Reopen it for review first.`,
      );
    }

    const ev: ReportEvidence = {
      id: newId('ev'),
      reportId,
      evidenceType: input.evidenceType,
      storageRef: input.storageRef.trim(),
      originalFilename: input.originalFilename ?? null,
      mimeType: input.mimeType ?? null,
      byteSize: input.byteSize ?? null,
      capturedAt: input.capturedAt ?? null,
      submittedAt: nowIso(),
      hasLocation: input.hasLocation ?? false,
      capturedGeom: input.capturedGeom ?? null,
      isOriginal: input.isOriginal ?? true,
      metadata: input.metadata ?? {},
      // PINNED — mirrors report_evidence_intake WITH CHECK.
      reviewState: 'pending',
      submittedBy: ctx.actorId ?? null,
      createdAt: nowIso(),
    };
    evidence.set(ev.id, ev);
    touch(report);
    appendEvent(reportId, 'citizen', 'evidence_added', {
      actorId: ctx.actorId ?? null,
      note: `Evidence attached (${ev.evidenceType}). Material received — not proof of the claim.`,
    });
    return { ...ev };
  }

  /** Citizen follow-up note. Mirrors the RLS pin: event='note', no status change. */
  function addNote(reportId: string, note: string, ctx: ServiceContext): ReportEvent {
    getReportOrThrow(reportId);
    const text = note.trim();
    if (!text) throw new ReportServiceError('VALIDATION', 'Note text is required.', ['Note text is required.']);
    return appendEvent(reportId, 'citizen', 'note', { actorId: ctx.actorId ?? null, note: text });
  }

  // ------------------------------------------------------------------
  // Reads — public by design (reporter identity never leaves the service).
  // ------------------------------------------------------------------
  function sanitize(r: CitizenReport): CitizenReport {
    // Reporter identity never leaves the service boundary.
    return { ...r, reporterId: null };
  }

  function listReports(filter: { status?: ReportStatus; category?: string; geoEntityId?: string; severity?: Severity; maxAgeHours?: number } = {}): CitizenReport[] {
    const cutoff = filter.maxAgeHours != null ? Date.now() - filter.maxAgeHours * 3600_000 : null;
    return [...reports.values()]
      .filter((r) =>
        (!filter.status || r.status === filter.status) &&
        (!filter.category || r.category === filter.category) &&
        (!filter.geoEntityId || r.geoEntityId === filter.geoEntityId) &&
        (!filter.severity || r.severity === filter.severity) &&
        (cutoff == null || new Date(r.createdAt).getTime() >= cutoff),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(sanitize);
  }

  function getEvidence(reportId: string): ReportEvidence[] {
    return [...evidence.values()]
      .filter((e) => e.reportId === reportId)
      .map((e) => ({ ...e, submittedBy: null }));
  }

  function getEvents(reportId: string): ReportEvent[] {
    return (events.get(reportId) ?? []).map((e) => ({ ...e, actorId: null }));
  }

  function getClaimsForReport(reportId: string): { claim: CivicClaim; relationship: ReportClaimRelationship }[] {
    return claimLinks
      .filter((l) => l.reportId === reportId)
      .map((l) => ({ claim: claims.get(l.claimId)!, relationship: l.relationship }))
      .filter((x) => !!x.claim);
  }

  function getReport(id: string): ReportDetailBundle | undefined {
    const r = reports.get(id);
    if (!r) return undefined;
    return { report: sanitize(r), evidence: getEvidence(id), events: getEvents(id), claims: getClaimsForReport(id) };
  }

  /** Operational dedup aid: same category + same jurisdiction + 72h window. */
  function findPossibleDuplicates(reportId: string): CitizenReport[] {
    const r = reports.get(reportId);
    if (!r || !r.geoEntityId) return [];
    const windowStart = Date.parse(r.createdAt) - 72 * 3600 * 1000;
    return [...reports.values()]
      .filter((o) =>
        o.id !== r.id &&
        o.category === r.category &&
        o.geoEntityId === r.geoEntityId &&
        Date.parse(o.createdAt) >= windowStart,
      )
      .map(sanitize);
  }

  // ------------------------------------------------------------------
  // Moderation — DEV role switch required. Every action is auditable.
  // ------------------------------------------------------------------
  function transitionReport(reportId: string, to: ReportStatus, note: string, ctx: ServiceContext): CitizenReport {
    requireModerator(ctx);
    const r = getReportOrThrow(reportId);
    if (!canTransitionReport(r.status, to)) {
      throw new ReportServiceError(
        'ILLEGAL_TRANSITION',
        `Cannot move a report from ${r.status} to ${to}.`,
        [`Legal destinations: ${allowedReportTransitions(r.status).join(', ') || 'none'}`],
      );
    }
    const text = note.trim();
    if (!text) throw new ReportServiceError('VALIDATION', 'A moderation note is required.', ['Moderation actions require a written reason.']);
    const from = r.status;
    r.status = to;
    if (to === 'resolved') {
      r.resolvedAt = nowIso();
      r.resolutionNote = text;
    }
    touch(r);
    appendEvent(reportId, ctx.role === 'moderator' ? 'admin' : 'system', 'status_changed', {
      actorId: ctx.actorId ?? null,
      note: text,
      oldStatus: from,
      newStatus: to,
    });
    return sanitize(r);
  }

  function assignInstitution(reportId: string, institutionId: string, ctx: ServiceContext): CitizenReport {
    requireModerator(ctx);
    const r = getReportOrThrow(reportId);
    r.assignedInstitutionId = institutionId;
    touch(r);
    appendEvent(reportId, 'admin', 'assigned', { actorId: ctx.actorId ?? null, note: `Assigned to institution ${institutionId}.` });
    return sanitize(r);
  }

  function requestInfo(reportId: string, note: string, ctx: ServiceContext): CitizenReport {
    requireModerator(ctx);
    const r = getReportOrThrow(reportId);
    const text = note.trim();
    if (!text) throw new ReportServiceError('VALIDATION', 'A note describing the needed information is required.', ['Requesting information requires a written reason.']);
    if (r.status === 'reported' && canTransitionReport('reported', 'under_review')) {
      const from = r.status;
      r.status = 'under_review';
      touch(r);
      appendEvent(reportId, 'admin', 'status_changed', {
        actorId: ctx.actorId ?? null,
        note: 'Moved to review while awaiting the requested information.',
        oldStatus: from,
        newStatus: 'under_review',
      });
    }
    appendEvent(reportId, 'admin', 'evidence_requested', { actorId: ctx.actorId ?? null, note: text });
    return sanitize(r);
  }

  function reviewEvidence(evidenceId: string, decision: 'accepted' | 'rejected', note: string, ctx: ServiceContext): ReportEvidence {
    requireModerator(ctx);
    const ev = evidence.get(evidenceId);
    if (!ev) throw new ReportServiceError('NOT_FOUND', `Evidence ${evidenceId} not found.`);
    const text = note.trim();
    if (!text) throw new ReportServiceError('VALIDATION', 'An evidence review note is required.', ['Evidence review requires a written reason.']);
    ev.reviewState = decision;
    appendEvent(ev.reportId, 'admin', 'moderated', {
      actorId: ctx.actorId ?? null,
      note: `Evidence ${ev.id} ${decision}: ${text} (material judgement only — not claim verification)`,
    });
    return { ...ev, submittedBy: null };
  }

  /**
   * Create a structured claim from a report. The claim ALWAYS enters through
   * the Phase 1 intake mapping for citizen_portal — never `verified`.
   * The originating report is attached as a citizen_evidence source with an
   * explicit "allegation, not verification" note.
   */
  function createClaimFromReport(
    reportId: string,
    input: ClaimInput,
    ctx: ServiceContext,
  ): { claim: CivicClaim; link: ReportClaimLink } {
    requireModerator(ctx);
    const r = getReportOrThrow(reportId);
    if (!['under_review', 'verified', 'in_progress'].includes(r.status)) {
      throw new ReportServiceError(
        'ILLEGAL_TRANSITION',
        `Claims can only be created from reports under review or accepted (current: ${r.status}).`,
      );
    }
    const claimKey = input.claimKey.trim();
    const claimLabel = input.claimLabel.trim();
    const claimValue = input.claimValue.trim();
    if (!claimKey || !claimLabel || !claimValue) {
      throw new ReportServiceError('VALIDATION', 'Claim key, label and value are required.', ['Claim key, label and value are required.']);
    }

    const acceptedEvidence = [...evidence.values()].filter(
      (e) => e.reportId === reportId && e.reviewState === 'accepted',
    );
    const hasIdentifiableSource = acceptedEvidence.length > 0;
    const state = claimInitialStateForReport(hasIdentifiableSource);
    // The second lock on the same door (the first is this mapping itself).
    assertClaimNotVerifiedFromReport(state);

    const claimId = newId('clm');
    const at = nowIso();
    const claimEvent: CivicEvent = {
      id: newId('cevt'),
      at,
      actor: 'system',
      event: 'submitted',
      oldState: null,
      newState: state,
      note: `Claim structured from citizen report ${reportId}. Citizen submission — not verified.`,
    };
    const claim: CivicClaim = {
      id: claimId,
      entityId: r.geoEntityId ?? r.id,
      claimKey,
      claimLabel,
      claimValue,
      informationState: state,
      ingestChannel: 'citizen_portal',
      sources: [
        {
          source: {
            id: `src_${r.id}`,
            name: `Citizen report: ${r.title}`,
            sourceType: 'citizen_evidence',
          },
          role: 'corroborating',
          note: 'Originating citizen submission. An allegation, not verification.',
        },
      ],
      events: [claimEvent],
    };
    claims.set(claimId, claim);

    const link: ReportClaimLink = {
      reportId,
      claimId,
      relationship: 'originated_from',
      createdBy: ctx.actorId ?? null,
      createdAt: at,
    };
    claimLinks.push(link);
    appendEvent(reportId, 'admin', 'claim_linked', {
      actorId: ctx.actorId ?? null,
      note: `Claim ${claimId} structured from this report (state: ${state}).`,
    });
    return { claim: { ...claim }, link: { ...link } };
  }

  function markDuplicate(reportId: string, duplicateOfId: string, note: string, ctx: ServiceContext): CitizenReport {
    requireModerator(ctx);
    const r = getReportOrThrow(reportId);
    const target = getReportOrThrow(duplicateOfId);
    if (reportId === duplicateOfId) {
      throw new ReportServiceError('VALIDATION', 'A report cannot be a duplicate of itself.', ['A report cannot be a duplicate of itself.']);
    }
    void target;
    r.duplicateOf = duplicateOfId;
    touch(r);
    appendEvent(reportId, 'admin', 'status_changed', {
      actorId: ctx.actorId ?? null,
      note: note.trim() || `Marked as duplicate of ${duplicateOfId}.`,
      oldStatus: r.status,
      newStatus: 'duplicate',
    });
    r.status = 'duplicate';
    touch(r);
    return sanitize(r);
  }

  // ------------------------------------------------------------------
  // Test/operational introspection (no production data leaves here).
  // ------------------------------------------------------------------
  function intakeCount(fingerprint: string, sinceMs: number): number {
    return intakeLog.filter((e) => e.fingerprint === fingerprint && e.at >= sinceMs).length;
  }

  function stats(): { reports: number; evidence: number; events: number; claims: number; links: number } {
    return {
      reports: reports.size,
      evidence: evidence.size,
      events: [...events.values()].reduce((n, l) => n + l.length, 0),
      claims: claims.size,
      links: claimLinks.length,
    };
  }

  return {
    // citizen
    submitReport,
    addEvidence,
    addNote,
    // reads
    listReports,
    getReport,
    getEvidence,
    getEvents,
    getClaimsForReport,
    findPossibleDuplicates,
    // moderator (DEV role switch)
    transitionReport,
    assignInstitution,
    requestInfo,
    reviewEvidence,
    createClaimFromReport,
    markDuplicate,
    // introspection
    intakeCount,
    stats,
  };
}

export type ReportService = ReturnType<typeof createReportService>;

/**
 * The shared dev intake service. Seeded with NOTHING — the first report in
 * the system is the first one a citizen actually submits. Production
 * replaces this 1:1 with the API backed by migration 0005.
 */
export const reportService = createReportService();
