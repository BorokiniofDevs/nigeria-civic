# PHASE 3 PLAN — Citizen Evidence & Reporting System

**Status:** PLAN ONLY — awaiting Lawal's approval before any code is written.
**Date:** 2026-09-25
**Frozen:** Phase 2 is formally frozen. Phase 3 makes only minimal compatibility
changes to Phase 2 files (listed in §9), no redesigns, no refactors.

**Core model:** Citizen observation → Report → Evidence → Claim →
Source/Provenance → Moderation/Verification → History.

A citizen submission is evidence of an observation. It is NEVER automatically
an established fact.

---

## 1. What Phase 1 already gives us (do not rebuild)

| Asset | Location | Phase 3 reuse |
|---|---|---|
| `information_state` 7-state enum | 0002 | Claim/report epistemic axis — reused as-is |
| `claims` / `claim_sources` / `claim_events` | 0002 | Claims generated from reports live here — no parallel tables |
| `ingest_channel` (`citizen_portal` exists) | 0002 | Report intake channel |
| `reports` table (title, description, geom, geo_entity_id, reporter_id, is_anonymous, severity, assigned_institution_id, resolution_note, resolved_at, duplicate_of) | 0001 | The report table — extended, not replaced |
| `reports.information_state` DEFAULT `citizen_submitted` | 0002 §7 | Report epistemic axis — already separate from workflow status |
| `report_status` enum (reported, under_review, verified, in_progress, resolved, rejected, duplicate) | 0001 | Report *workflow* lifecycle — reused with documented semantics |
| `report_events` (append-only, actor_type/actor_id/event/note/old_status/new_status) | 0001 | Moderation audit trail — reused as-is |
| `reports.evidence` JSONB | 0001 | REPLACED by a proper `report_evidence` table (see §3) |
| RLS: citizen INSERT-only on reports/report_events with pinned WITH CHECK | 0003 + 0004 | Intake security — extended to new tables, same pattern |
| `canTransition()` / `canBecomeVerified()` / `channelInitialState()` | `lib/provenance.ts` | Verification authority — reused, never duplicated |
| `sectors.report_categories` (configurable `[{key,label,severity_default}]`) | 0001 | Report categories — configurable, never hardcoded |

**The single most important existing distinction:** migration 0002 §7 —
"`reports.status` = handling workflow … `information_state` = what we actually
know. A report is an allegation until evidence says otherwise; the two axes are
never merged." Phase 3 is the operationalization of that sentence.

---

## 2. Architecture

### 2.1 Entities & relationships

```
users (existing)
  │ 1 reporter → 0..1 (NULL when anonymous; never exposed publicly)
  ▼
reports (existing, extended) ──1:N──▶ report_evidence (NEW)
  │ status: report_status            evidence_type, storage_ref, captured_at,
  │ information_state: 7-state       submitted_at, has_location, captured_geom,
  │ (workflow ≠ epistemic)           is_original, metadata, review_state
  │
  │ 1:N (moderation audit)
  ▼
report_events (existing, reused)
  │ event ∈ created | acknowledged | assigned | evidence_requested |
  │           evidence_added | claim_linked | status_changed | resolved |
  │           reopened | escalated | moderated | note
  │ (TEXT column — new values need documentation only, no migration)
  │
  │ M:N (explicit, traceable)
  ▼
report_claims (NEW junction) ──▶ claims (existing, Phase 1)
  │ relationship ∈ originated_from | supports | contradicts
  ▼
claim_sources (existing) ──▶ sources (existing, Phase 1 taxonomy)
claim_events (existing, append-only)

reports ──▶ geo_entities (existing, via geo_entity_id; national hierarchy)
reports ──▶ sectors (existing, via sector_id → report_categories)
reports ──▶ institutions (existing, via assigned_institution_id)
reports ──▶ reports.duplicate_of (existing self-FK; dedup linkage)
```

**Traceability answer:** Claim → `report_claims` → Report → `report_evidence`
→ submitter (`users.id`, internal only) → `report_events` + `claim_events`
timestamps. Every hop is a real row, never an embedded blob.

### 2.2 Report lifecycle (workflow axis — `report_status`)

```
reported ──▶ under_review ──▶ verified* ──▶ in_progress ──▶ resolved
    │              │              │                              ▲
    │              ▼              │                              │
    │          rejected ──────────┤                              │
    │              │              │                              │
    └──────────────┴──▶ duplicate ──────────────────────────────┘
                   (linked via duplicate_of)

* 'verified' here = "accepted by a moderator as a legitimate citizen
  submission". It is a WORKFLOW state. It NEVER implies the underlying
  factual claim is verified. This will be enforced in documentation AND
  by the claim-creation gate (§5).
```

Claim creation can happen from `under_review` or `verified` (workflow).
The resulting claim enters at `citizen_submitted` or `source_backed` ONLY —
via `channelInitialState('citizen_portal', hasIdentifiableSource)` — never
`verified`. The claim then follows the standard Phase 1 verification
lifecycle independently of the report's workflow state.

### 2.3 Provenance flow (intake → truth)

```
1. Citizen submits (intake service / RLS):
   reports(status='reported', information_state='citizen_submitted')  ← PINNED
   report_events(event='created', actor_type='citizen')
   report_evidence(review_state='pending')                            ← PINNED

2. Moderator triages (service_role):
   reports.status → under_review | rejected | duplicate
   report_events(event='status_changed'|'moderated', old/new_status, note)

3. Moderator accepts & structures (service_role):
   claims INSERT (ingest_channel='citizen_portal',
                  information_state = channelInitialState(...) — never 'verified')
   claim_events(event='submitted', actor_type='system' or moderator)
   report_claims(report_id, claim_id, 'originated_from')
   report_events(event='claim_linked')
   evidence examined → claim_sources(source_role='corroborating'|..., source_id)

4. Independent verification (Phase 1 rules, unchanged):
   canBecomeVerified(...) must pass: primary non-AI evidence + human
   verifier event. A citizen photo alone can NEVER satisfy this.
```

### 2.4 Moderation flow

Moderator console (explicitly labelled; role is backend-assigned in
production — see §7):

- **Queue:** reports in `reported` / `under_review`, filterable by sector,
  severity, geography, age. No citizen ranking, no trust scores.
- **Inspect one report:** title, description, observed_at vs submitted_at,
  location (jurisdiction + point, or honest "no precise location"),
  evidence list with metadata, linked claims, current workflow status,
  current information state, full `report_events` history.
- **Legitimate actions only:** request info (`needs_info`-equivalent →
  `under_review` + `evidence_requested` event), accept (`verified`
  workflow), reject (with reason), mark duplicate (link `duplicate_of`),
  assign institution, link/create claim, resolve with `resolution_note`,
  reopen. Every action appends to `report_events`. Nothing is deleted.
- **Evidence review:** accept/reject individual evidence items
  (`review_state`); rejected evidence is preserved, never deleted.

### 2.5 Map integration (minimum)

- Report markers reuse the existing `mk-rep` / `reports` marker group and
  the existing LayerRail "Reports" toggle — both already exist as Phase 2
  seams. Markers render at LGA/LCDA/ward level for reports attached to the
  visible jurisdiction. Zero reports → zero markers (honest empty map).
- Report detail opens via the existing `showDetail`/`DetailBody` path
  (extended minimally with a report renderer).
- Intake location picker: a minimal map "pick a point" mode in the report
  flow. No location → report stored with `geom = NULL` + UI says so.
- Search: a "Citizen reports" group appears only when reports exist;
  selecting one travels to its jurisdiction, then opens the report detail.
- No redesign of the map. No new basemaps. No satellite. No fake markers.

### 2.6 Abuse / duplication safeguards (operational, neutral)

- **Rate limiting:** `report_intake_log` table (fingerprint + timestamp);
  service enforces a per-fingerprint cap per window. No scoring, no ranking.
- **Duplicates:** moderator links via existing `duplicate_of`; repeated
  identical submissions surface in the queue by (category, jurisdiction,
  time-window) grouping — operational, not reputational.
- **Malformed submissions:** validated at intake (non-empty title/
  description within length bounds, category ∈ sector categories,
  severity ∈ low|medium|high|critical).
- **Evidence guards:** MIME allowlist (image/video/document/audio),
  size caps, `storage_ref` required non-empty, `review_state` pinned
  `pending` at intake. No trust scores, no citizen ranking.

---

## 3. Schema proposal — migration `0005_phase3_reporting.sql`

### 3.1 `report_evidence` (NEW)

```sql
CREATE TABLE report_evidence (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id     UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  evidence_type TEXT NOT NULL
    CHECK (evidence_type IN ('photo','video','document','audio','location_pin','metadata_only')),
  storage_ref   TEXT NOT NULL CHECK (storage_ref <> ''),
  -- opaque pointer issued by the storage layer. Never a fabricated URL.
  original_filename TEXT,
  mime_type     TEXT,  -- validated against allowlist at intake
  byte_size     BIGINT CHECK (byte_size IS NULL OR byte_size >= 0),
  captured_at   TIMESTAMPTZ,  -- when the material was captured (EXIF/user). NULL = unknown, never guessed.
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  has_location  BOOLEAN NOT NULL DEFAULT FALSE,
  captured_geom GEOMETRY(Point, 4326),  -- device/EXIF location, consent-gated
  is_original   BOOLEAN NOT NULL DEFAULT TRUE,  -- FALSE when derived/edited
  metadata      JSONB NOT NULL DEFAULT '{}',    -- dimensions, duration, etc. (user-provided, never trusted as fact)
  review_state  TEXT NOT NULL DEFAULT 'pending'
    CHECK (review_state IN ('pending','accepted','rejected')),
  submitted_by  UUID,  -- users.id; NULL when anonymous. Never exposed publicly.
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX report_evidence_report_idx ON report_evidence (report_id);
CREATE INDEX report_evidence_review_idx ON report_evidence (review_state);
```

**Receiving a photograph proves nothing.** `review_state='accepted'` means "a
moderator judged this material relevant and intact" — it is NOT claim
verification and is never presented as such.

### 3.2 `report_claims` (NEW junction — explicit over embedded)

```sql
CREATE TABLE report_claims (
  report_id    UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  claim_id     UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL DEFAULT 'originated_from'
    CHECK (relationship IN ('originated_from','supports','contradicts')),
  created_by   UUID,  -- moderator/service identity
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (report_id, claim_id)
);
CREATE INDEX report_claims_claim_idx ON report_claims (claim_id);
```

One report may originate several claims; one claim may cite several reports.
The investigator's question "Where did this claim come from?" is answered by
this table — never by embedding the report inside the claim.

### 3.3 `report_intake_log` (NEW — rate-limit seam)

```sql
CREATE TABLE report_intake_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID,            -- NULL when anonymous
  fingerprint TEXT NOT NULL,   -- session/device fingerprint, hashed at the API
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX report_intake_log_fp_time_idx ON report_intake_log (fingerprint, created_at);
```

Append-only. The service enforces the per-fingerprint/per-window cap.
Operational only — no scores, no citizen ranking.

### 3.4 `reports` alterations (documented, non-destructive)

```sql
-- Observation time ≠ submission time (provenance distinction).
ALTER TABLE reports ADD COLUMN observed_at TIMESTAMPTZ;
COMMENT ON COLUMN reports.observed_at IS
  'When the citizen says the observed condition held. NULL = not stated. Never guessed; distinct from created_at (submission time).';

-- Honest geography: a report without usable location must not be forced
-- onto the map with an invented point.
ALTER TABLE reports ALTER COLUMN geom DROP NOT NULL;
COMMENT ON COLUMN reports.geom IS
  'Observation point. NULL when the submitter could not or would not provide a location — the UI must say so honestly, never invent one.';

-- Workflow semantics, stated once, authoritatively:
COMMENT ON TABLE reports IS
  'status = HANDLING WORKFLOW (reported→under_review→verified|rejected|duplicate→in_progress→resolved). information_state = EPISTEMIC state (the 7-state canon). The two axes are never merged: a report with status=verified is an ACCEPTED SUBMISSION, not a verified fact. Claims from reports enter via ingest_channel=citizen_portal at citizen_submitted/source_backed — never verified.';

-- The baseline JSONB evidence column is superseded by report_evidence.
COMMENT ON COLUMN reports.evidence IS
  'LEGACY intake blob. Superseded by the report_evidence table (migration 0005). Retained for backward compatibility; new writes go to report_evidence.';
```

### 3.5 Defense-in-depth trigger: citizen claims can never be born `verified`

```sql
-- Even if every other layer failed, the database refuses.
CREATE OR REPLACE FUNCTION forbid_verified_citizen_claim() RETURNS trigger AS $$
BEGIN
  IF NEW.ingest_channel = 'citizen_portal'
     AND NEW.information_state = 'verified' THEN
    RAISE EXCEPTION 'civic: citizen_portal claims may never be created as verified';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS claims_citizen_gate ON claims;
CREATE TRIGGER claims_citizen_gate
  BEFORE INSERT OR UPDATE OF ingest_channel, information_state ON claims
  FOR EACH ROW EXECUTE FUNCTION forbid_verified_citizen_claim();
```

### 3.6 Indexes summary

`report_evidence(report_id)`, `report_evidence(review_state)`,
`report_claims(claim_id)`, `report_intake_log(fingerprint, created_at)`.
Existing `reports`/`report_events` indexes already cover status/geo/time.

### 3.7 Deletion/retention

- `report_evidence.report_id` and `report_claims` FKs: `ON DELETE CASCADE`
  (report deletion cascades to its evidence/links — but reports are
  **never hard-deleted**; rejection/closure is a status transition with
  history. The cascade exists only for data-hygiene operations by
  service_role).
- `claims` / `claim_events` / `report_events`: append-only; no DELETE for
  any interactive role (existing RLS already guarantees this).

### 3.8 Canonical snapshot

- Update `db/schema.sql` to the post-0005 snapshot.
- Append the 0005 verification block (same style as 0001–0004).
- Note in `db/migrations/README.md`: 0005 is the Phase 3 reporting migration.

---

## 4. Security proposal

### 4.1 Role → operation matrix

| Operation | Citizen (anon/authenticated) | Moderator (via console → service_role) | Service-role only |
|---|---|---|---|
| INSERT `reports` | ✅ pinned: `status='reported'`, `information_state='citizen_submitted'` | — | — |
| UPDATE `reports` (status, assignment, resolution, duplicate_of) | ❌ | ✅ via API role check | ✅ |
| INSERT `report_evidence` | ✅ pinned: `review_state='pending'`, allowlisted type, non-empty `storage_ref` | — | — |
| UPDATE `report_evidence.review_state` | ❌ | ✅ | ✅ |
| INSERT `report_events` | ✅ `event='note'` only, `actor_type='citizen'`, NULL old/new status (existing 0004 pin) | ✅ all events | ✅ |
| UPDATE/DELETE `report_events` | ❌ | ❌ (append-only for everyone but table owner) | — |
| INSERT `report_claims` | ❌ | ✅ (claim-linking action) | ✅ |
| INSERT `claims` from a report | ❌ | ✅ service path only; state forced by `channelInitialState('citizen_portal', …)`; trigger forbids `verified` | ✅ |
| INSERT `claim_sources` / `claim_events` | ❌ | ✅ via verification workflow | ✅ |
| SELECT civic data incl. reports | ✅ (public by design; `reporter_id` never exposed — no users access) | ✅ | ✅ |
| Rate-limit log | append via service | read | ✅ |

### 4.2 New RLS policies (migration 0005)

```sql
-- report_evidence: public read; citizen INSERT pinned; moderator writes via service_role.
ALTER TABLE report_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY report_evidence_pub_read ON report_evidence
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY report_evidence_intake ON report_evidence
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    storage_ref <> '' AND
    evidence_type IN ('photo','video','document','audio','location_pin','metadata_only') AND
    review_state = 'pending'
  );

-- report_claims: public read; writes are moderator/service only (no citizen policy).
ALTER TABLE report_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY report_claims_pub_read ON report_claims
  FOR SELECT TO anon, authenticated USING (true);

-- report_intake_log: service_role only (citizens must not read or game it).
ALTER TABLE report_intake_log ENABLE ROW LEVEL SECURITY;
-- (no anon/authenticated policies → default deny)

GRANT SELECT ON report_evidence, report_claims TO anon, authenticated;
GRANT INSERT ON report_evidence TO anon, authenticated;
GRANT ALL ON report_evidence, report_claims, report_intake_log TO service_role;
```

The `reports_intake` / `report_events_intake` policies from 0004 are
**unchanged** (they already pin the correct values). The existing
`geom IS NOT NULL` pin in `reports_intake` must be **relaxed** to allow
NULL geom (honest no-location reports) — the single deliberate change to an
existing policy, documented in the migration:

```sql
DROP POLICY IF EXISTS reports_intake ON reports;
CREATE POLICY reports_intake ON reports
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    title <> '' AND description <> '' AND
    status = 'reported'::report_status AND
    information_state = 'citizen_submitted'::information_state
  );
```

### 4.3 What the database enforces (not just the frontend)

1. Citizen cannot set report status / information_state (WITH CHECK pins).
2. Citizen cannot set evidence review_state (WITH CHECK pin).
3. Citizen cannot insert moderation/claim/resolution events
   (`report_events_intake` pin: `event='note'` only, NULL old/new status).
4. Citizen cannot write claims, claim_sources, claim_events, report_claims
   (no policies → default deny).
5. `citizen_portal` claims cannot be created `verified` (trigger §3.5),
   even by service_role — a second lock on the same door.
6. `claim_events` remains append-only (no UPDATE/DELETE policies).
7. Reporter identity: `reports.reporter_id` / `report_evidence.submitted_by`
   reference `users.id`; anon has no SELECT on `users` (existing 0003).

### 4.4 Authentication note

No new authentication architecture. The app currently has none; intake
accepts anonymous + pseudonymous submissions (baseline supports
`is_anonymous`). Moderator actions in the shipped build run through an
explicitly labelled moderator console whose role check is a **service-side
parameter** — in production this is the API's session role, enforced by the
RLS above. The UI never decides authority; the database does.

---

## 5. Frontend plan (Phase 2 design language, no redesign)

### 5.1 New modules

- `platform/src/lib/civic/reporting.ts` — domain types
  (`CitizenReport`, `ReportEvidence`, `ReportEvent`, `ReportStatus`,
  `EvidenceType`), pure lifecycle helpers
  (`allowedReportTransitions()`, `isTerminalReportStatus()`),
  intake validators (`validateReportSubmission()`, `validateEvidenceMetadata()`,
  MIME allowlist, size caps), and the report→claim provenance helpers.
  Reuses `canTransition` / `canBecomeVerified` / `channelInitialState` from
  `lib/provenance.ts` — never duplicates them.
- `platform/src/lib/civic/reportService.ts` — the intake + moderation
  service. Implements the §4 matrix client-side with strict validation and
  role gating. **Backed by an in-memory store seeded with NOTHING** —
  clearly documented as the local dev intake until the Postgres backend
  (migration 0005) replaces it 1:1 behind the same interface. A citizen's
  own submitted reports appear for that citizen (their real submissions);
  nothing is invented.

### 5.2 Minimal Phase 2 compatibility changes (the complete list)

- `lib/civic/store.ts` — add an optional, separate `ReportStore`
  interface (new file); the frozen `CivicStore` interface is untouched.
- `lib/civic/search.ts` — add a "Citizen reports" group sourced from the
  report service; appears only when reports exist.
- `lib/mapController.ts` — render report markers from a provided list
  (reuses `mk-rep` / `reports` group); add a minimal location-pick mode
  for the intake flow.
- `state/CivicContext.tsx` — wire the report service: report list state,
  intake flow state, moderation state, marker sync, search integration.
- `components/LayerRail.tsx` — add a "Report an observation" entry point.
- `app/globals.css` — styles for the new components only.

### 5.3 New components

- `components/ReportFlow.tsx` — the 6-step intake:
  1. Select/report a location (map pick or jurisdiction; honest "no precise
     location" option) → 2. Describe the observation (category from
     `sectors.report_categories`, title, description, observed_at) →
  3. Attach evidence (file metadata + storage ref; never presented as proof)
  → 4. Review submission → 5. Submit → 6. Result: the report's honest state
  (`reported` / `citizen_submitted`) with the explicit notice:
  **"Submitting a report does not mean the claim has been independently
  verified."**
- `components/ReportDetail.tsx` — report → evidence → linked claims →
  provenance → full history, reusing `StateBadge`, `SourceLine`,
  `History`-style timeline and the honest-empty pattern.
- `components/ModerationConsole.tsx` — queue + single-report inspection +
  legitimate actions (§2.4). Explicitly labelled as the moderator console;
  every action appends to `report_events`.

### 5.4 Design language

Existing Phase 2 components, serious GIS/public-sector tone, no
sensational language, no allegation-as-fact presentation, no fake
verification badges, no invented records for visual purposes.

---

## 6. Test plan

New tests (same harness pattern as the existing behavioral suite —
`platform/scripts/phase3.test.js` run via node against compiled output;
fixtures live only in the test file, never in the production store):

**Submission**
- valid citizen report submits → `reported` / `citizen_submitted` pinned.
- malformed report rejected (empty title, empty description, overlong fields,
  unknown category, bad severity).
- forged `status='resolved'` at intake → rejected.
- forged `information_state='verified'` at intake → rejected.
- anonymous submission accepted with `is_anonymous=true`, no identity leaked.

**Evidence**
- evidence metadata links to its report; invalid `evidence_type` rejected;
  empty `storage_ref` rejected; unsupported MIME rejected; oversize rejected;
  `review_state` pinned `pending` at intake; evidence without location is
  stored honestly (`captured_geom` NULL, `has_location` false).

**Claims**
- report can originate claim(s) via `report_claims`; claim enters at
  `citizen_submitted`/`source_backed` per `channelInitialState`
  (`citizen_portal`) — never `verified`.
- claim retains provenance: `report_claims` row traces Claim → Report.
- citizen submission does not auto-verify (no `verified` event exists).

**Verification**
- Phase 1 rules remain authoritative: `canTransition`/`canBecomeVerified`
  unchanged and called, not duplicated.
- AI-generated evidence as primary → `canBecomeVerified` fails
  (existing gate, exercised with a citizen-report fixture).
- `forbid_verified_citizen_claim` trigger logic mirrored in tests.

**Moderation**
- authorized transition (`reported`→`under_review`→`verified`(workflow))
  succeeds and appends `report_events`.
- citizen attempt to transition status → denied.
- `report_events` append-only: UPDATE/DELETE denied for interactive roles.
- duplicate linking via `duplicate_of` + `duplicate` status.

**Security (forgery attempts)**
- forge `verified` information_state on a report → denied.
- forge moderator status transition as citizen → denied.
- forge resulting claim IDs on intake → denied.
- forge moderation/resolution/historical events as citizen → denied
  (intake pin: `event='note'` only).

**Geography**
- report links to `geo_entity_id` (ward/LGA/state); lineage resolves.
- report without coordinates stored with NULL geom; UI copy asserts honesty.
- national structure intact: no Lagos-only branches in any new code.

**Production cleanliness**
- zero fabricated civic records; zero demonstration records (existing audit,
  extended to new tables/IDs).

---

## 7. Static audit (extended for Phase 3)

Existing checks (is_verified, demo IDs, AI Studio identifiers, fake
phones/emails/money, Google embeds, SVG primary map, fabricated names,
fake "live" claims) **plus**:

- hardcoded report coordinates
- fake evidence URLs / invented storage refs
- accidental Phase 4 finance UI (budget/award/payment workflows)
- satellite functionality beyond the existing Phase 2 stub
- AI assistant/chatbot functionality
- `confidence` used as verification (must remain metadata-only)

---

## 8. What Phase 3 deliberately does NOT build

Phase 4 finance/budget workflows · satellite imagery & change detection ·
AI assistant/chatbot · news ingestion · government data ingestion ·
procurement ingestion · notifications/push · elections/campaigns · political
persuasion · social feeds · messaging · reputation/citizen scoring ·
payments/subscriptions/advertising · new auth architecture · any fabricated
civic records. Each gets a clean seam and nothing more.

---

## 9. Files expected to change (complete list)

**Database**
- NEW `db/migrations/0005_phase3_reporting.sql`
- EDIT `db/schema.sql` (canonical post-0005 snapshot)
- EDIT `db/migrations/README.md` (0005 note)

**Platform — new**
- `platform/src/lib/civic/reporting.ts` (domain types, lifecycle, validators)
- `platform/src/lib/civic/reportService.ts` (intake + moderation service)
- `platform/src/components/ReportFlow.tsx` (6-step intake UI)
- `platform/src/components/ReportDetail.tsx` (report detail panel)
- `platform/src/components/ModerationConsole.tsx` (moderator console)
- `platform/scripts/phase3.test.js` (Phase 3 behavioral tests)

**Platform — minimal compatibility edits (Phase 2 otherwise frozen)**
- `platform/src/lib/civic/store.ts` (add `ReportStore` interface alongside)
- `platform/src/lib/civic/search.ts` ("Citizen reports" group, only when non-empty)
- `platform/src/lib/mapController.ts` (report markers from list; location-pick mode)
- `platform/src/state/CivicContext.tsx` (wire report service)
- `platform/src/components/LayerRail.tsx` ("Report an observation" entry)
- `platform/src/app/globals.css` (new-component styles only)

**Docs**
- `docs/PHASE3_PLAN.md` (this file)

No other Phase 2 files will be touched. No visual-identity changes.

---

## 10. Open questions for Lawal (approval checkpoint)

1. **Moderator console in the shipped build:** proposed as an explicitly
   labelled console with a clearly-marked dev role switch, since there is
   no auth architecture yet and the database RLS is the real authority.
   Acceptable, or should the console be hidden behind a build flag until
   the API layer lands?
2. **Location-optional reports:** proposed `geom` nullable + honest
   "no precise location" UI. Confirm this relaxation of the baseline
   `NOT NULL` is acceptable (it is the one deliberate baseline change).
3. **`report_status='verified'` semantics:** keeping the baseline enum
   value with the documented meaning "accepted as a legitimate submission"
   (never factual verification). Alternative: leave the value unused and
   use `in_progress` for accepted reports. Preference?
4. **Test harness:** proposed `platform/scripts/phase3.test.js` (node,
   same pattern as the current suite) so Phase 3 tests live in the repo.
   Acceptable?

**STOP — awaiting approval before writing any code.**

---

## Decisions (2026-09-25) — approved by Lawal via decision.docx

1. **Moderator console: SHIP, DEV-ONLY.** Clearly labelled `DEV MODERATOR`; visible dev role
   switch acceptable as a testing aid (NOT a security boundary); RLS + service-role remain
   authoritative; no fake moderator identities; clean seam (`ServiceContext.role`) for the
   eventual authenticated moderator system.
2. **Location-optional reports: APPROVED.** `reports.geom` is now NULLABLE. The system
   distinguishes `location_status = provided | unavailable | imprecise`, enforced by the
   `reports_location_honesty` CHECK (geom NULL ⟺ unavailable). Never invent coordinates;
   never derive fake coordinates from a jurisdiction.
3. **`report_status = 'verified'`:** enum value KEPT for schema compatibility. Semantics
   documented everywhere: "accepted as a legitimate citizen submission" — NEVER factual
   verification. User-facing wording: **"Submission accepted"**. The two-axis model
   (workflow vs information state) is never merged. `.st-verified` styling deliberately
   avoids the green of `.ist-verified`.
4. **Tests: APPROVED.** `platform/scripts/phase3.test.js`, Node-based pattern, covers normal
   behavior + deliberate forgery attempts.
5. **`report_intake_log`: operational ONLY.** Minimum data (fingerprint, reporter_id, time);
   documented 90-day retention; no profiling, no scoring, no ranking.

## Implementation record (2026-09-25)

Implemented exactly per this plan + the decisions above. See STOP report for file list,
migration summary, security/RLS changes, UI changes, test results, and audits.
