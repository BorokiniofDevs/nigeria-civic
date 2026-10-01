// lib/civic/reporting.ts — Phase 3 domain layer: citizen evidence & reporting.
//
// Mirrors db/schema.sql v0.4 (migration 0005). This module owns the REPORT
// side of the two-axis model:
//
//   Report workflow (report_status): reported → under_review → verified* →
//     in_progress → resolved | rejected | duplicate
//   Claim information state (information_state): the 7-state Phase 1 canon.
//
// * report status 'verified' = "accepted as a legitimate citizen submission"
//   — NEVER factual verification. User-facing wording: "Submission accepted".
//
// Verification authority stays in lib/provenance.ts: this module REUSES
// canTransition / canBecomeVerified / channelInitialState and never
// duplicates them.
import type { InformationState } from '../provenance';
import {
  channelInitialState,
  type IngestChannel,
} from '../provenance';

/** Report handling workflow (db: report_status). NOT an epistemic state. */
export type ReportStatus =
  | 'reported'      // citizen submitted; awaiting triage
  | 'under_review'  // a moderator is looking at it
  | 'verified'      // ACCEPTED as a legitimate citizen submission (NOT a verified fact)
  | 'in_progress'   // an authority is acting on it
  | 'resolved'      // closed with a resolution note
  | 'rejected'      // reviewed and rejected as a submission; preserved
  | 'duplicate';    // merged into another report via duplicate_of

export const REPORT_STATUSES: ReportStatus[] = [
  'reported', 'under_review', 'verified', 'in_progress',
  'resolved', 'rejected', 'duplicate',
];

/**
 * User-facing labels. 'verified' is NEVER shown as a bare "VERIFIED" badge —
 * that would read as factual verification. The wording is deliberate.
 */
export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  reported: 'Reported',
  under_review: 'Under review',
  verified: 'Submission accepted',
  in_progress: 'In progress',
  resolved: 'Resolved',
  rejected: 'Rejected',
  duplicate: 'Duplicate',
};

export const REPORT_STATUS_DESCRIPTION: Record<ReportStatus, string> = {
  reported: 'Submitted by a citizen. Awaiting moderator triage.',
  under_review: 'A moderator is reviewing this submission.',
  verified: 'Accepted as a legitimate citizen submission. This does NOT mean the underlying claim has been independently verified.',
  in_progress: 'An authority is acting on this report.',
  resolved: 'Closed with a recorded resolution.',
  rejected: 'Reviewed and rejected as a submission. Preserved for the record.',
  duplicate: 'Linked as a duplicate of another report. Preserved for the record.',
};

/** Honest location vocabulary (db: reports.location_status). */
export type LocationStatus = 'provided' | 'unavailable' | 'imprecise';

export const LOCATION_STATUS_LABEL: Record<LocationStatus, string> = {
  provided: 'Location provided',
  unavailable: 'Location unavailable',
  imprecise: 'Approximate location',
};

export type EvidenceType =
  | 'photo' | 'video' | 'document' | 'audio' | 'location_pin' | 'metadata_only';

export type EvidenceReviewState = 'pending' | 'accepted' | 'rejected';

export type ReportActorType = 'citizen' | 'verifier' | 'admin' | 'authority' | 'system';

/** report_events.event values (TEXT column — documented, not enum-constrained). */
export type ReportEventKind =
  | 'created' | 'acknowledged' | 'assigned' | 'evidence_requested'
  | 'evidence_added' | 'claim_linked' | 'status_changed' | 'resolved'
  | 'reopened' | 'escalated' | 'moderated' | 'note';

export type ReportClaimRelationship = 'originated_from' | 'supports' | 'contradicts';

export type Severity = 'low' | 'medium' | 'high' | 'critical';

/** A citizen report — mirrors the reports table (v0.4). */
export interface CitizenReport {
  id: string;
  sectorId?: string | null;
  category: string;
  title: string;
  description: string;
  /** When the citizen says the condition held. Null = not stated. */
  observedAt: string | null;
  locationStatus: LocationStatus;
  /** Real coordinate or null. Never invented — see locationStatus. */
  geom: { lng: number; lat: number } | null;
  geoEntityId?: string | null;
  reporterId?: string | null; // internal only; never exposed publicly
  isAnonymous: boolean;
  status: ReportStatus;
  informationState: InformationState;
  severity: Severity;
  assignedInstitutionId?: string | null;
  resolutionNote?: string | null;
  resolvedAt?: string | null;
  duplicateOf?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Evidence material — mirrors report_evidence. Metadata only, never the bytes. */
export interface ReportEvidence {
  id: string;
  reportId: string;
  evidenceType: EvidenceType;
  /** Opaque storage pointer. Never a fabricated URL. */
  storageRef: string;
  originalFilename?: string | null;
  mimeType?: string | null;
  byteSize?: number | null;
  /** When the material was captured. Null = unknown, never guessed. */
  capturedAt: string | null;
  submittedAt: string;
  hasLocation: boolean;
  capturedGeom?: { lng: number; lat: number } | null;
  isOriginal: boolean;
  metadata: Record<string, unknown>;
  reviewState: EvidenceReviewState;
  submittedBy?: string | null; // internal only
  createdAt: string;
}

/** One row of the moderation audit trail — mirrors report_events. */
export interface ReportEvent {
  id: string;
  reportId: string;
  actorType: ReportActorType;
  actorId?: string | null;
  event: ReportEventKind;
  note?: string | null;
  oldStatus?: ReportStatus | null;
  newStatus?: ReportStatus | null;
  createdAt: string;
}

/** Explicit Claim → Report provenance — mirrors report_claims. */
export interface ReportClaimLink {
  reportId: string;
  claimId: string;
  relationship: ReportClaimRelationship;
  createdBy?: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Report workflow lifecycle — the legal status transitions.
// Rejection/duplication are terminal-ish: a rejected report is preserved,
// never deleted; reopening goes through under_review again.
// ---------------------------------------------------------------------------
const REPORT_TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  reported: ['under_review', 'rejected', 'duplicate'],
  under_review: ['verified', 'rejected', 'duplicate', 'reported'],
  verified: ['in_progress', 'resolved', 'rejected', 'duplicate', 'under_review'],
  in_progress: ['resolved', 'verified', 'under_review'],
  resolved: ['under_review'], // reopen → back to review, never silently
  rejected: ['under_review'], // appeal → back to review, history preserved
  duplicate: ['under_review'], // unlink → back to review, history preserved
};

/** Is this report workflow transition legal? */
export function canTransitionReport(from: ReportStatus, to: ReportStatus): boolean {
  if (from === to) return true;
  return REPORT_TRANSITIONS[from].includes(to);
}

/** Legal workflow destinations from a status (for moderator UIs). */
export function allowedReportTransitions(from: ReportStatus): ReportStatus[] {
  return [...REPORT_TRANSITIONS[from]];
}

// ---------------------------------------------------------------------------
// Intake validation — mirrors the RLS WITH CHECK pins AND the honesty rules.
// The database enforces these; the service validates first for clear errors.
// ---------------------------------------------------------------------------
export const MAX_TITLE_LENGTH = 140;
export const MAX_DESCRIPTION_LENGTH = 5000;
export const MAX_EVIDENCE_PER_REPORT = 10;
export const MAX_EVIDENCE_BYTES = 50 * 1024 * 1024; // 50 MB per item
export const MAX_REPORTS_PER_HOUR = 10; // per fingerprint; operational, not a score

/** MIME allowlist for evidence intake. Anything else is rejected, not stored. */
export const EVIDENCE_MIME_ALLOWLIST: { type: EvidenceType; mimes: string[] }[] = [
  { type: 'photo', mimes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] },
  { type: 'video', mimes: ['video/mp4', 'video/webm', 'video/quicktime'] },
  { type: 'document', mimes: ['application/pdf', 'text/plain', 'text/csv'] },
  { type: 'audio', mimes: ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm'] },
];

export function mimeAllowedFor(type: EvidenceType, mime: string): boolean {
  if (type === 'location_pin' || type === 'metadata_only') return true;
  const entry = EVIDENCE_MIME_ALLOWLIST.find((e) => e.type === type);
  return !!entry && entry.mimes.includes(mime.toLowerCase());
}

export interface ReportSubmissionInput {
  category: string;
  title: string;
  description: string;
  observedAt?: string | null;
  locationStatus: LocationStatus;
  /** Real coordinate or null. The validator cross-checks honesty. */
  geom?: { lng: number; lat: number } | null;
  geoEntityId?: string | null;
  severity?: Severity;
  isAnonymous?: boolean;
  /** When the backend is present, the category must be validated against
   *  sectors.report_categories. In the dev build the list is caller-supplied. */
  allowedCategories?: string[];
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

/** Validate a citizen report submission. Mirrors reports_intake + honesty CHECK. */
export function validateReportSubmission(input: ReportSubmissionInput): ValidationResult {
  const errors: string[] = [];
  const title = input.title?.trim() ?? '';
  const description = input.description?.trim() ?? '';
  if (!title) errors.push('A title is required.');
  else if (title.length > MAX_TITLE_LENGTH) errors.push(`Title must be ${MAX_TITLE_LENGTH} characters or fewer.`);
  if (!description) errors.push('A description of the observation is required.');
  else if (description.length > MAX_DESCRIPTION_LENGTH) errors.push(`Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`);
  const category = input.category?.trim() ?? '';
  if (!category) errors.push('A category is required.');
  else if (input.allowedCategories && !input.allowedCategories.includes(category)) {
    errors.push('Unknown category for this sector.');
  }
  if (input.severity && !['low', 'medium', 'high', 'critical'].includes(input.severity)) {
    errors.push('Invalid severity.');
  }
  if (input.observedAt) {
    const t = Date.parse(input.observedAt);
    if (Number.isNaN(t)) errors.push('Observed date is not a valid date.');
    else if (t > Date.now() + 24 * 3600 * 1000) errors.push('Observed date cannot be in the future.');
  }
  // The honesty invariant (db: reports_location_honesty): a coordinate is
  // either real or absent — never invented to satisfy the schema.
  const hasGeom = !!input.geom;
  if (!hasGeom && input.locationStatus !== 'unavailable') {
    errors.push('No coordinate was provided, so the location must be marked unavailable — not given an invented point.');
  }
  if (hasGeom && input.locationStatus === 'unavailable') {
    errors.push('A coordinate was provided but the location was marked unavailable.');
  }
  if (hasGeom) {
    const { lng, lat } = input.geom!;
    if (!Number.isFinite(lng) || !Number.isFinite(lat) || lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      errors.push('Coordinate is out of range.');
    }
  }
  return { ok: errors.length === 0, errors };
}

export interface EvidenceSubmissionInput {
  evidenceType: EvidenceType;
  storageRef: string;
  originalFilename?: string | null;
  mimeType?: string | null;
  byteSize?: number | null;
  capturedAt?: string | null;
  hasLocation?: boolean;
  capturedGeom?: { lng: number; lat: number } | null;
  isOriginal?: boolean;
  metadata?: Record<string, unknown>;
}

/** Validate evidence metadata. Mirrors report_evidence_intake WITH CHECK. */
export function validateEvidenceMetadata(input: EvidenceSubmissionInput): ValidationResult {
  const errors: string[] = [];
  if (!['photo', 'video', 'document', 'audio', 'location_pin', 'metadata_only'].includes(input.evidenceType)) {
    errors.push('Unsupported evidence type.');
  }
  if (!input.storageRef || !input.storageRef.trim()) {
    errors.push('A storage reference is required — material without a pointer cannot be retrieved for review.');
  }
  if (input.mimeType && !mimeAllowedFor(input.evidenceType, input.mimeType)) {
    errors.push(`File type ${input.mimeType} is not accepted for ${input.evidenceType}.`);
  }
  if (input.byteSize != null) {
    if (!Number.isFinite(input.byteSize) || input.byteSize < 0) errors.push('Invalid file size.');
    else if (input.byteSize > MAX_EVIDENCE_BYTES) errors.push(`File exceeds the ${MAX_EVIDENCE_BYTES / 1024 / 1024} MB limit.`);
  }
  if (input.capturedAt && Number.isNaN(Date.parse(input.capturedAt))) {
    errors.push('Captured date is not a valid date.');
  }
  if (input.capturedGeom && !input.hasLocation) {
    errors.push('Location metadata on the material requires explicit location consent.');
  }
  return { ok: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Report → claim provenance helpers. The claim ALWAYS enters through the
// Phase 1 intake mapping — a citizen report can never mint `verified`.
// ---------------------------------------------------------------------------
const REPORT_INGEST_CHANNEL: IngestChannel = 'citizen_portal';

/** The information state a claim originating from a report enters. */
export function claimInitialStateForReport(hasIdentifiableSource: boolean): InformationState {
  return channelInitialState(REPORT_INGEST_CHANNEL, hasIdentifiableSource);
}

/** Guard: refuse to construct a verified-from-citizen claim, loudly. */
export function assertClaimNotVerifiedFromReport(state: InformationState): void {
  if (state === 'verified') {
    throw new Error('civic: citizen_portal claims may never be created as verified');
  }
}

// ---------------------------------------------------------------------------
// Discovery — grouped search over submitted reports. Only used when the
// report service actually holds records; empty → no group, honest empty.
// ---------------------------------------------------------------------------
export interface ReportSearchItem {
  reportId: string;
  title: string;
  category: string;
  status: ReportStatus;
  context: string; // jurisdiction lineage or location honesty label
}

export function searchReports(
  reports: CitizenReport[],
  resolveContext: (r: CitizenReport) => string,
  query: string,
  limit = 8,
): { group: string; items: ReportSearchItem[] } | null {
  const q = query.trim().toLowerCase();
  if (q.length < 2 || reports.length === 0) return null;
  const hits = reports.filter(
    (r) =>
      r.title.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q),
  );
  if (!hits.length) return null;
  return {
    group: 'Citizen reports',
    items: hits.slice(0, limit).map((r) => ({
      reportId: r.id,
      title: r.title,
      category: r.category,
      status: r.status,
      context: resolveContext(r),
    })),
  };
}
