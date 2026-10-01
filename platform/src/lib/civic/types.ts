// lib/civic/types.ts — Frontend mirror of the Phase 1 provenance vocabulary.
// The UI speaks the canonical model: ENTITY → CLAIM → SOURCE →
// INFORMATION STATE → EVENT/HISTORY. No second verification system;
// InformationState is imported from lib/provenance.ts (single vocabulary).
import type { InformationState } from '@/lib/provenance';
import type { LngLat } from '@/lib/geo';

export type { InformationState };

/** Jurisdiction tiers from the national model (db: geo_level). */
export type GeoTier =
  | 'country'
  | 'state'
  | 'senatorial_district'
  | 'lga'
  | 'lcda'
  | 'ward'
  | 'community'
  | 'street';

/** Non-jurisdiction civic things the map can show. */
export type CivicThingKind =
  | 'facility'
  | 'project'
  | 'institution'
  | 'report'
  | 'official'
  | 'road';

export type EntityKind = GeoTier | CivicThingKind;

export type ConstitutionalStatus =
  | 'constitutional'
  | 'state_created'
  | 'customary'
  | 'statistical';

/**
 * A civic entity: a jurisdiction, facility, project, institution, report…
 * Entity tables describe the thing; claims (below) hold assertions about it.
 */
export interface CivicEntity {
  id: string; // stable: 'geo:…' for real jurisdictions
  kind: EntityKind;
  name: string;
  parentId: string | null;
  informationState: InformationState;
  /** Constitutional LGA vs state-created LCDA — structurally distinct, never interchangeable. */
  constitutionalStatus?: ConstitutionalStatus;
  /** Link into the real GADM geometry (map rendering). Absent where no boundary data is loaded. */
  geometryRef?: { collection: 'states' | 'lgas'; featureId: string };
  /** Illustrative point only — never presented as a surveyed location. */
  position?: LngLat;
  positionNote?: string;
  /** Where the geometry/name comes from, e.g. 'GADM v4.1'. */
  sourceLabel?: string;
  /** One honest line, e.g. 'LGA boundary data not loaded in this build.' */
  note?: string;
}

export type ClaimSourceRole = 'primary_evidence' | 'corroborating' | 'contradicting';

export interface CivicSource {
  id: string;
  name: string;
  /** Mirrors db source_type. */
  sourceType: string;
  url?: string | null;
  publisher?: string | null;
  publishedAt?: string | null;
}

export interface CivicSourceLink {
  source: CivicSource;
  role: ClaimSourceRole;
  note?: string;
}

export type ClaimActor = 'citizen' | 'verifier' | 'admin' | 'authority' | 'system';

export interface CivicEvent {
  id: string;
  at: string; // ISO date
  actor: ClaimActor;
  event: 'submitted' | 'source_attached' | 'verified' | 'disputed' | 'rejected' | 'superseded' | 'expired' | 'note';
  oldState?: InformationState | null;
  newState?: InformationState | null;
  note?: string;
}

/**
 * A claim: one assertion about an entity. The canonical unit of civic truth.
 * No claims are seeded in this build — the production backend supplies them.
 */
export interface CivicClaim {
  id: string;
  entityId: string;
  claimKey: string;   // e.g. 'operational_status'
  claimLabel: string; // human label
  claimValue: string; // honest rendered value
  informationState: InformationState;
  ingestChannel?: string;
  sources: CivicSourceLink[];
  events: CivicEvent[];
  supersededBy?: string | null;
}

/** Everything the detail panel needs for one entity, in canonical order. */
export interface EntityDetail {
  entity: CivicEntity;
  lineage: CivicEntity[]; // root → parent
  claims: CivicClaim[];
  children: CivicEntity[];
}

/* ---------------- search ---------------- */

export interface SearchItem {
  entityId: string;
  name: string;
  kind: EntityKind;
  context: string; // e.g. 'LGA · Lagos State'
}

export interface SearchGroup {
  group: string;
  items: SearchItem[];
}
