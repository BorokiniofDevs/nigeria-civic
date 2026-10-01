# Phase 1 Implementation Plan — Authoritative Data & Provenance Architecture

**Status:** PLAN (written before implementation, per directive §10)
**Scope:** data/provenance architecture only. No UI changes (Phase 2).
**Principle:** nothing becomes public truth without identifiable source evidence
and an explicit, reviewable verification history. AI output, scraper hits, user
submissions, search results, and confidence scores can *enter* the system — none
of them can *verify*.

---

## 1. Schema changes (overview)

| # | Change | Reason |
|---|---|---|
| 1 | New enum `information_state`: `unknown`, `citizen_submitted`, `source_backed`, `verified`, `disputed`, `outdated`, `rejected` | Replaces the 6-value `verification_status` enum. Old `unverified` conflated "we have nothing" with "we have something unchecked"; old `pending` was meaningless. The 7 states are Lawal's required vocabulary, one-to-one. |
| 2 | New enum `ingest_channel`: `citizen_portal`, `verifier_console`, `document_upload`, `web_ingest`, `dataset_import`, `api_feed`, `satellite_pipeline`, `ai_extraction`, `system_migration` | Records *how* a claim arrived, distinct from *what evidence* supports it (`sources.source_type`). The verification rules key off this. |
| 3 | New enum `ingest_status`: `submitted`, `under_review`, `needs_info`, `approved`, `rejected`, `withdrawn` | Replaces freeform TEXT status on `change_requests`. |
| 4 | New tables `claims`, `claim_sources`, `claim_events` | The canonical provenance layer: entity ↔ claim ↔ source ↔ state ↔ history (directive §5). |
| 5 | `geo_level` += `senatorial_district`; `source_type` += `satellite_imagery` | Senatorial districts are nationally uniform (109), not Lagos-specific. Satellite source type reserved now so the enum isn't reopened later. |
| 6 | `geo_entities` += `constitutional_status` (`constitutional` \| `state_created` \| `customary` \| `statistical`), plus parent-tier validation trigger | Encodes the constitutional-LGA vs state-created-LCDA distinction **as data**, with a DB trigger enforcing legal parentage (country→state→lga→lcda→ward→community→street). No Lagos logic in code paths. |
| 7 | All `verification_status` columns → `information_state` type, renamed to `information_state` (11 tables) | One vocabulary everywhere. Data migration maps old→new (see §7). |
| 8 | `reports` += `information_state` DEFAULT `citizen_submitted` | Reports are allegations. `reports.status` remains the *handling workflow*; `information_state` is the *epistemic state*. The two are different axes — documented, not merged. |
| 9 | `budget_lines` += `awarded`, += `verified_spent`; `projects` += `awarded_value`, += `verified_expenditure_value` | The 5-stage money trail: budgeted → released → awarded → paid(reported) → independently verified. Never infer expenditure from budget. (AI Studio's allocated/disbursed/tranche concepts map here.) |
| 10 | `escalation_rules` += `score_threshold`, += `score_weights` (JSONB, nullable) | Lets a score-based rule (the AI Studio mechanism) be expressed *configurably* instead of hardcoded. Time/threshold rules keep working. |
| 11 | `change_requests` generalized: `ingest_channel`, `source_id`, `proposed_claims` JSONB, `resulting_claim_ids` UUID[], status enum | The universal ingestion pattern (directive §4). Approval creates *claims*, never writes entity attributes directly, never mints `verified`. |
| 12 | `geo_lineage` view (recursive) | Materializes the full Nigeria→…→Street path per entity for the future API. |
| 13 | RLS policies (migration 0003) | Public read; writes only via service role except validated citizen intake (`change_requests`, `reports` INSERT). |

## 2. New tables / relations

```sql
claims (
  id UUID PK,
  entity_type TEXT NOT NULL,            -- geo_entity | institution | official |
                                        -- office_holding | facility | project |
                                        -- budget_line | road | legislative_item | ...
  entity_id UUID NOT NULL,
  claim_key TEXT NOT NULL,              -- 'office_holder' | 'phone' | 'budgeted_value' |
                                        -- 'project_status' | 'boundary' | ...
  claim_value JSONB NOT NULL,
  ingest_channel ingest_channel NOT NULL,
  information_state information_state NOT NULL DEFAULT 'unknown',
  confidence NUMERIC CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  -- metadata ONLY. Never a verification trigger. See §4.
  effective_from DATE, effective_to DATE,
  superseded_by UUID REFERENCES claims(id),
  created_by UUID,                      -- users.id; NULL for system ingestion
  created_at / updated_at TIMESTAMPTZ
)
-- indexes: (entity_type, entity_id, claim_key), (information_state), GIN(claim_value)

claim_sources (
  claim_id UUID REFERENCES claims(id) ON DELETE CASCADE,
  source_id UUID REFERENCES sources(id),
  source_role TEXT NOT NULL CHECK (source_role IN
    ('primary_evidence','corroborating','contradicting')),
  note TEXT,
  PRIMARY KEY (claim_id, source_id)
)
-- A claim with contradicting sources is a candidate for `disputed`.

claim_events (
  id UUID PK,
  claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL CHECK (actor_type IN
    ('citizen','verifier','admin','authority','system')),
  actor_id UUID,
  event TEXT NOT NULL CHECK (event IN
    ('submitted','source_attached','verified','disputed','rejected',
     'superseded','expired','restored','note')),
  old_state information_state, new_state information_state,
  note TEXT,
  evidence_ref JSONB,                   -- pointers to evidence examined
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)
-- Append-only. No UPDATE/DELETE via RLS for any interactive role.
```

**Provenance relationships (directive §5), stated once:**

- **Entity** (`geo_entities`, `institutions`, `officials`, `facilities`, `projects`, …)
  = the thing itself. Holds identity + geometry. Carries a *denormalized*
  `information_state`/`source_id` pair = the currently published view, maintained
  by the ingestion service from the authoritative claim. Documented as a cache;
  never hand-edited.
- **Claim** (`claims`) = one assertion about one entity (`claim_key`/`claim_value`).
  Multiple claims may exist per key (conflict → `disputed`); the published view
  follows the latest non-rejected claim.
- **Source** (`sources`, via `claim_sources`) = identifiable evidence. A claim
  without a `primary_evidence` source can never be `verified`.
- **Verification state** (`claims.information_state`) = the 7-state vocabulary.
- **History** (`claim_events` + `claims.superseded_by`) = every transition,
  preserved. Supersede, never overwrite, never delete.

## 3. Modified tables

`geo_entities` (new enum value, `constitutional_status`, trigger, column rename);
`institutions`, `office_holdings`, `public_offices`, `social_accounts`,
`facilities`, `roads`, `projects` (+2 money columns), `budget_lines` (+2 money
columns), `legislative_items`, `news_items` (column rename + type change);
`reports` (+`information_state`); `escalation_rules` (+2 nullable columns);
`change_requests` (generalized — see §5). Untouched: `sources` (stable),
`geo_aliases`, `sectors`, `report_events`, `escalations`, `users`,
`institution_claims`, `social_accounts` (rename only), `search_index` (no
verification columns referenced).

## 4. Verification lifecycle (the canonical rules — directive §2)

```
unknown ─┬─▶ citizen_submitted ─┬─▶ source_backed ─┬─▶ verified ─┬─▶ disputed
         │                      │                  │             ├─▶ outdated
         └─▶ source_backed ─────┘                  ├─▶ disputed  │
                                                   └─▶ outdated ─┴─▶ source_backed (re-verify)
                                                                  └─▶ verified (re-verify)
disputed ─┬─▶ verified ─▶ (as above)
          ├─▶ source_backed
          └─▶ rejected (terminal: supersede with a new claim, never revive)
citizen_submitted ─▶ rejected (reviewed, preserved)
```

**A claim may enter `verified` only if ALL hold:**
1. ≥1 linked `claim_sources` row with `source_role = 'primary_evidence'`
   (identifiable source evidence — a URL, document ref, or field record);
2. a `claim_events` row `event='verified'` by `actor_type ∈ {verifier, admin, authority}`
   recorded in the same operation (a named human or accountable authority — never "the system");
3. `ingest_channel = 'ai_extraction'` is **never sufficient alone** — AI-origin
   claims cap at `source_backed` until (1)+(2) are satisfied independently;
4. `confidence` is metadata and is never consulted by the transition rules.

These rules are encoded three ways: SQL comments + CHECKs where expressible,
the `provenance.ts` authority module (pure functions, unit-testable), and this
document. DB triggers cannot fully enforce multi-table preconditions without
transaction-ordering pain — the service layer is the enforcement point, and a
scheduled consistency report (`claims` in `verified` missing primary evidence
or verifying event) is the backstop.

## 5. Ingestion / change-request lifecycle (directive §4)

```
submitted → under_review → approved ─▶ creates claims (citizen_submitted or
    │            │          source_backed — NEVER verified, NEVER direct
    │            │          entity writes) ─▶ resulting_claim_ids recorded
    │            └▶ needs_info → under_review
    └▶ rejected / withdrawn (preserved with reason)
```

- **Any** future source (government document, official site, citizen report,
  uploaded evidence, dataset, API, satellite observation) enters through
  `change_requests` with its `ingest_channel` and optional `source_id`.
- `proposed_claims` JSONB: array of `{entity_type, entity_id, claim_key, claim_value}`.
- On approval the service inserts `claims` rows + `claim_events(submitted)` rows
  and stores their IDs in `resulting_claim_ids`. Entity published views update
  only when a claim later passes the verification lifecycle (§4).
- Pure citizen allegations (no source): claims enter as `citizen_submitted`.
  With an identifiable source: `source_backed`. Nothing else is possible at intake.

## 6. Jurisdiction model (directives §6–§7)

- Levels: `country → state → {senatorial_district | lga → lcda} → ward → community → street`.
  LCDA is an **optional** tier: `ward.parent_id` may be an LGA *or* an LCDA.
- `constitutional_status`: `lga` ⇒ `constitutional` (the 774);
  `lcda` ⇒ `state_created` (DB-enforced); other equivalents use the same two
  levels with the honest status — no state-specific branches anywhere.
- Trigger `validate_geo_parent()` enforces the legal parentage matrix above;
  unknown future tiers fail closed.
- `geo_lineage` recursive view exposes the full path
  `Nigeria → State → LGA → (LCDA) → Ward → Community → Street` per entity —
  the chain Lawal specified, with project AOIs remaining geometry on `projects`
  (coordinates), not hierarchy levels.

## 7. Migration considerations

- Greenfield database: no production data. Migration 0001 = v0.1 baseline
  verbatim; 0002 = all changes above; 0003 = RLS.
- Enum surgery: `ALTER TYPE … ADD VALUE` cannot run inside a transaction block —
  flagged in-file; the runner must apply those statements in autocommit mode.
- `verification_status` → `information_state` data mapping (per-column USING):
  `verified→verified`, `disputed→disputed`, `stale→outdated`, `rejected→rejected`,
  `pending→source_backed` **only if** `source_id IS NOT NULL` else `unknown`,
  `unverified→source_backed` **only if** `source_id IS NOT NULL` else `unknown`.
  (Rationale: a row that *has* an identifiable source was "source-backed but
  pending verification" all along; a row with no source is honestly `unknown`.)
- Old `verification_status` type is dropped after the last column migrates.
- `db/schema.sql` becomes the v0.2 canonical snapshot (post-migration state).

## 8. API implications (future backend; no code in Phase 1)

- Every read endpoint exposes `information_state` (+ `source` summary) — never a
  boolean; clients render the 7 states distinctly.
- `GET /claims?entity=…` exposes the claim history per entity (transparency).
- `POST /change-requests` is the single write intake for civic data; direct
  entity writes are service-role only.
- `GET /geo/:id/lineage` serves the hierarchy path from `geo_lineage`.
- `search_index` gains no new columns in Phase 1 (it references no verification
  columns); a future pass will surface state labels in results.

## 9. Security implications

- RLS on all tables. `anon`: SELECT everywhere (public civic data);
  INSERT on `change_requests`, `reports`, `report_events` with column validation
  (CHECKs: title/description non-empty, valid `geo_entity_id`);
  no UPDATE/DELETE anywhere; no access to `claim_events` writes or `claims`
  writes. `authenticated`: + INSERT on `claim_sources` notes? No — keep minimal:
  same as anon. All promotion/verification writes are `service_role` only,
  performed by the ingestion service that enforces §4.
- `claim_events` is append-only by policy (no UPDATE/DELETE granted to any
  interactive role) — the history cannot be rewritten.
- Rejected data is preserved but stays labelled `rejected`; it never surfaces
  as current.
- Abuse notes: intake rate-limiting and reporter-identity for votes are service
  concerns (Phase 3), but the schema already keeps `reporter_id` internal and
  `is_anonymous` explicit.

## 10. Files to create / change

| File | Action |
|---|---|
| `docs/PHASE1_PLAN.md` | CREATE (this file) |
| `db/migrations/README.md` | CREATE — runner conventions |
| `db/migrations/0001_baseline.sql` | CREATE — v0.1 verbatim baseline |
| `db/migrations/0002_provenance_canon.sql` | CREATE — §1–§6 |
| `db/migrations/0003_rls_policies.sql` | CREATE — §9 |
| `db/schema.sql` | MODIFY — v0.2 canonical snapshot |
| `platform/src/lib/provenance.ts` | CREATE — TS authority module: 7 states, lifecycle state machine (`canTransition`), verification gate (`canBecomeVerified` with reasons), intake mapping (`channelInitialState`), jurisdiction parentage map, budget stages |

## 11. Post-implementation verification checklist

1. `npx tsc --noEmit` clean in `platform/`.
2. Static SQL audit script: balanced statements, types-before-use, every migrated
   table present in v0.2 snapshot, no `verification_status` remnants, enum values
   referenced exist.
3. Fabrication quarantine: grep `db/` + `platform/src` for AI Studio identifiers
   (`off_fed_`, `lga_lagos_`, `lcda_lagos_`, `ward_`, unsplash, invented names) —
   expect zero hits.
4. Deletion check: file manifest diff — only the 7 files above change; no
   `platform/` UI file touched.
5. Honest limitation: no live PostgreSQL/PostGIS in this environment — migration
   *execution* testing is deferred to provisioning and stated as such.
