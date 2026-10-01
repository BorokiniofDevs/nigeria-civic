// ============================================================================
// PROVENANCE — canonical data/provenance authority module (Phase 1).
//
// Mirrors db/schema.sql v0.2 + docs/PHASE1_PLAN.md. This is the service-layer
// enforcement point for the verification lifecycle: the database expresses
// what it can in CHECKs/triggers, and these pure functions decide every
// state transition the ingestion service performs.
//
// THE DISTINCTION (fundamental to the Civic OS):
//   Entity  = the thing itself (geo, institution, official, facility, …)
//   Claim   = one assertion about one entity  ← canonical truth lives here
//   Source  = identifiable evidence supporting the claim
//   State   = InformationState on the claim (7 states — never a boolean)
//   History = claim events, append-only; supersede, never overwrite/delete
//
// Nothing in this module trusts AI output, scraper hits, user submissions,
// search results, or confidence scores as verification. Ever.
// ============================================================================

/** The canonical 7-state vocabulary. No booleans. */
export type InformationState =
  | 'unknown'           // no information / not available
  | 'citizen_submitted' // citizen allegation/evidence; not reviewed; never fact
  | 'source_backed'     // identifiable source(s); pending human verification
  | 'verified'          // human-verified against source evidence + recorded event
  | 'disputed'          // conflicting claims / active challenge
  | 'outdated'          // previously verified/backed; superseded or stale
  | 'rejected';         // reviewed and rejected; preserved, never current

export const INFORMATION_STATES: InformationState[] = [
  'unknown', 'citizen_submitted', 'source_backed',
  'verified', 'disputed', 'outdated', 'rejected',
];

export const INFORMATION_STATE_LABEL: Record<InformationState, string> = {
  unknown: 'Not available',
  citizen_submitted: 'Citizen-submitted',
  source_backed: 'Source-backed · pending verification',
  verified: 'Verified',
  disputed: 'Disputed',
  outdated: 'Outdated',
  rejected: 'Rejected',
};

export const INFORMATION_STATE_DESCRIPTION: Record<InformationState, string> = {
  unknown: 'We hold no information about this. Not the same as "checked and false".',
  citizen_submitted: 'Submitted by a citizen. An allegation, not a fact. Awaiting review.',
  source_backed: 'Supported by identifiable source evidence. Awaiting human verification.',
  verified: 'Verified by an accountable human against identifiable source evidence, with a recorded verification event.',
  disputed: 'Conflicting claims or an active challenge. Under resolution.',
  outdated: 'Previously verified or source-backed; superseded by newer information or gone stale.',
  rejected: 'Reviewed and rejected. Preserved for the record; never shown as current.',
};

/** How a claim/change-request arrived. Distinct from the evidence (source). */
export type IngestChannel =
  | 'citizen_portal' | 'verifier_console' | 'document_upload' | 'web_ingest'
  | 'dataset_import' | 'api_feed' | 'satellite_pipeline' | 'ai_extraction'
  | 'system_migration';

/** Universal ingestion lifecycle. Approval creates claims — never verified. */
export type IngestStatus =
  | 'submitted' | 'under_review' | 'needs_info'
  | 'approved' | 'rejected' | 'withdrawn';

export type ClaimSourceRole = 'primary_evidence' | 'corroborating' | 'contradicting';
export type ClaimActorType = 'citizen' | 'verifier' | 'admin' | 'authority' | 'system';
export type ClaimEventKind =
  | 'submitted' | 'source_attached' | 'verified' | 'disputed'
  | 'rejected' | 'superseded' | 'expired' | 'restored' | 'note';

/** Mirrors the sources.source_type enum in db/schema.sql. */
export type SourceType =
  | 'official_government' | 'gazette_legislation' | 'official_social'
  | 'reputable_third_party' | 'geo_service' | 'citizen_evidence'
  | 'satellite_imagery' | 'procurement_record' | 'court_record'
  | 'third_party_dataset' | 'ai_generated';

export interface Claim {
  id: string;
  entityType: string;
  entityId: string;
  claimKey: string;
  claimValue: unknown;
  ingestChannel: IngestChannel;
  informationState: InformationState;
  /** 0..1. Metadata only — never consulted by any verification rule. */
  confidence: number | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  supersededBy: string | null;
  createdBy: string | null;
}

export interface ClaimSourceLink {
  claimId: string;
  sourceId: string;
  sourceRole: ClaimSourceRole;
  note: string | null;
}

export interface ClaimEvent {
  id: string;
  claimId: string;
  actorType: ClaimActorType;
  actorId: string | null;
  event: ClaimEventKind;
  oldState: InformationState | null;
  newState: InformationState | null;
  note: string | null;
}

// ---------------------------------------------------------------------------
// Verification lifecycle — the canonical transition table.
// Mirrors the trigger/documented rules in migration 0002.
// ---------------------------------------------------------------------------
const TRANSITIONS: Record<InformationState, InformationState[]> = {
  unknown: ['citizen_submitted', 'source_backed'],
  citizen_submitted: ['source_backed', 'disputed', 'rejected'],
  source_backed: ['verified', 'disputed', 'rejected', 'outdated'],
  verified: ['disputed', 'outdated'],
  disputed: ['verified', 'source_backed', 'rejected'],
  outdated: ['source_backed', 'verified'],
  rejected: [], // terminal — supersede with a new claim, never revive
};

/** Is this state transition legal? `rejected` is terminal. */
export function canTransition(from: InformationState, to: InformationState): boolean {
  if (from === to) return true; // idempotent re-application
  return TRANSITIONS[from].includes(to);
}

/** Legal destinations from a state (for UIs driving verifier workflows). */
export function allowedTransitions(from: InformationState): InformationState[] {
  return [...TRANSITIONS[from]];
}

export interface VerificationCheck {
  hasPrimaryEvidence: boolean;      // ≥1 claim_sources row, role='primary_evidence'
  /** source_type of each primary-evidence source. AI-generated material can
   *  never satisfy the primary-evidence requirement (see canBecomeVerified). */
  primaryEvidenceSourceTypes: SourceType[];
  hasVerifyingEvent: boolean;       // claim_events event='verified'
  verifyingActor: ClaimActorType | null; // actor of that event
  ingestChannel: IngestChannel;
}

export interface VerificationVerdict {
  ok: boolean;
  reasons: string[];
}

/**
 * THE gate. A claim may enter `verified` only if ALL hold:
 *  (a) identifiable primary source evidence is linked;
 *  (b) NONE of that primary evidence is AI-generated — ai_generated material
 *      can never satisfy the primary-evidence requirement, no matter who
 *      links it or what role it is given. "AI verifies AI" is impossible;
 *  (c) a verification event by an accountable human (verifier/admin/authority)
 *      exists — never "the system", never an AI, never the submitter;
 *  (d) AI-origin claims additionally satisfy (a)+(b) independently —
 *      ai_extraction alone caps at `source_backed`;
 *  (e) `confidence` is metadata and is never consulted (note: it is not even
 *      an input to this function — that is deliberate). Scraper hits, search
 *      results, and citizen submissions likewise confer nothing by themselves.
 */
export function canBecomeVerified(check: VerificationCheck): VerificationVerdict {
  const reasons: string[] = [];
  if (!check.hasPrimaryEvidence) {
    reasons.push('No primary source evidence linked. Verification requires identifiable source evidence (URL, document ref, or field record).');
  }
  if (check.primaryEvidenceSourceTypes.includes('ai_generated')) {
    reasons.push('AI-generated material cannot serve as primary evidence. Verification requires independent, non-AI primary source evidence.');
  }
  if (!check.hasVerifyingEvent) {
    reasons.push('No verification event recorded. Verification requires an explicit, recorded review — it is never implicit.');
  } else if (check.verifyingActor === 'system' || check.verifyingActor === 'citizen') {
    reasons.push(`Verification by '${check.verifyingActor}' is not sufficient. It must come from an accountable verifier, admin, or authority.`);
  }
  if (check.ingestChannel === 'ai_extraction' && !check.hasPrimaryEvidence) {
    reasons.push('AI-extracted content cannot verify itself. Independent primary evidence is required.');
  }
  return { ok: reasons.length === 0, reasons };
}

/**
 * Intake mapping — the state a new claim/change-request enters.
 * NOTHING enters as `verified`. AI extraction caps at `source_backed`.
 */
export function channelInitialState(
  channel: IngestChannel,
  hasIdentifiableSource: boolean,
): InformationState {
  switch (channel) {
    case 'citizen_portal':
      return hasIdentifiableSource ? 'source_backed' : 'citizen_submitted';
    case 'document_upload':
      return 'source_backed'; // an uploaded document IS identifiable evidence
    case 'verifier_console':
      return hasIdentifiableSource ? 'source_backed' : 'unknown';
    case 'web_ingest':
    case 'dataset_import':
    case 'api_feed':
    case 'satellite_pipeline':
      // A scraper finding it, a feed delivering it, or a satellite observing it
      // is not verification. Source-backed at best.
      return hasIdentifiableSource ? 'source_backed' : 'unknown';
    case 'ai_extraction':
      // AI output is never authoritative on its own — even with a citation,
      // the citation itself must be human-checked before it counts.
      return 'source_backed';
    case 'system_migration':
      return hasIdentifiableSource ? 'source_backed' : 'unknown';
  }
}

// ---------------------------------------------------------------------------
// Jurisdiction model — mirrors validate_geo_parent() in migration 0002.
// country → state → {senatorial_district | lga → lcda} → ward → community → street
// ---------------------------------------------------------------------------
export type JurisdictionLevel =
  | 'country' | 'state' | 'senatorial_district' | 'lga' | 'lcda'
  | 'ward' | 'community' | 'street';

export type ConstitutionalStatus =
  | 'constitutional' | 'state_created' | 'customary' | 'statistical';

const ALLOWED_PARENTS: Record<JurisdictionLevel, (JurisdictionLevel | null)[]> = {
  country: [null],
  state: ['country'],
  senatorial_district: ['state'],
  lga: ['state'],
  lcda: ['lga'],
  ward: ['lga', 'lcda'],
  community: ['ward'],
  street: ['ward', 'community'],
};

/** Is this parentage legal? Unknown tiers fail closed. */
export function isLegalParentage(
  level: JurisdictionLevel,
  parentLevel: JurisdictionLevel | null,
): boolean {
  return ALLOWED_PARENTS[level].includes(parentLevel);
}

/**
 * Structural LGA/LCDA rule: lga ⇒ constitutional (the 774);
 * lcda ⇒ state_created. Data, not branching logic.
 */
export function constitutionalStatusFor(level: JurisdictionLevel): ConstitutionalStatus | null {
  if (level === 'lga') return 'constitutional';
  if (level === 'lcda') return 'state_created';
  return null; // other levels carry no standing claim
}

// ---------------------------------------------------------------------------
// Public finance — the five stages. Distinct columns, never inferred.
// budgeted → released → awarded → paid (reported) → independently verified.
// Only the verified figure may ever be presented as confirmed spend.
// ---------------------------------------------------------------------------
export const BUDGET_STAGES = [
  'budgeted',
  'released',
  'awarded',
  'paid',               // reported/claimed — NOT confirmed
  'verified_expenditure', // independently verified — the only confirmed figure
] as const;
export type BudgetStage = (typeof BUDGET_STAGES)[number];

export const BUDGET_STAGE_LABEL: Record<BudgetStage, string> = {
  budgeted: 'Budgeted',
  released: 'Released',
  awarded: 'Awarded',
  paid: 'Paid (reported)',
  verified_expenditure: 'Independently verified',
};
