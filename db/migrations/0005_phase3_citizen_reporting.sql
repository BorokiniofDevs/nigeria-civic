-- ============================================================================
-- MIGRATION 0005 — Phase 3: citizen evidence & reporting system
--
-- Operationalizes migration 0002 §7: "reports.status = handling workflow …
-- information_state = what we actually know. A report is an allegation until
-- evidence says otherwise; the two axes are never merged."
--
--   1. reports: observed_at (observation ≠ submission), geom NULLABLE
--      (honest no-location reports), location_status + a DB honesty
--      invariant (geom NULL ⟺ location unavailable). The baseline JSONB
--      `evidence` column is documented LEGACY, superseded by report_evidence.
--   2. report_evidence — proper evidence table: type, storage_ref pointer
--      (never a fabricated URL), captured/submitted timestamps, location
--      metadata, originality, review_state. Receiving material proves
--      nothing: review_state='accepted' means "relevant and intact", never
--      claim verification.
--   3. report_claims — explicit M:N junction: Claim → Report provenance.
--      One report may originate several claims; one claim may cite several
--      reports. Prefer explicit relationships over embedding.
--   4. report_intake_log — operational rate-limit/abuse log ONLY.
--      Minimum data, documented retention. No behavioral profiling, no
--      citizen scoring, no ranking.
--   5. Defense in depth: citizen_portal claims can never be born `verified`
--      (trigger), even if every other layer failed.
--   6. RLS: citizen INSERT-only on report_evidence with pinned WITH CHECK;
--      report_claims writes are moderator/service only; report_intake_log
--      is service_role only. reports_intake is relaxed to allow NULL geom
--      (the ONE deliberate change to an existing intake policy) while
--      keeping every 0004 pin.
--
-- No fabricated data. No Phase 4 finance. No satellite. No AI assistant.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. reports — observation time, honest location, workflow documentation
-- --------------------------------------------------------------------------

-- Observation time ≠ submission time (created_at). NULL = not stated, never guessed.
ALTER TABLE reports ADD COLUMN IF NOT EXISTS observed_at TIMESTAMPTZ;
COMMENT ON COLUMN reports.observed_at IS
  'When the citizen says the observed condition held. NULL = not stated — never guessed. Distinct from created_at (submission time).';

-- A citizen must be able to submit a legitimate observation without a usable
-- coordinate. No invented points, no derived fake coordinates.
ALTER TABLE reports ALTER COLUMN geom DROP NOT NULL;

-- Honest location vocabulary (per approval decision):
--   provided    — a real coordinate was supplied (user-picked or device)
--   unavailable — no usable location; the report is preserved without a point
--   imprecise   — a location was given but is approximate (area-level, landmark)
ALTER TABLE reports ADD COLUMN IF NOT EXISTS location_status TEXT;
UPDATE reports
  SET location_status = CASE WHEN geom IS NOT NULL THEN 'provided' ELSE 'unavailable' END
  WHERE location_status IS NULL;
ALTER TABLE reports ALTER COLUMN location_status SET NOT NULL;
ALTER TABLE reports ALTER COLUMN location_status SET DEFAULT 'unavailable';

DO $$ BEGIN
  ALTER TABLE reports ADD CONSTRAINT reports_location_status_check
    CHECK (location_status IN ('provided','unavailable','imprecise'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- The honesty invariant, enforced by the database: a report either carries a
-- real coordinate or honestly says it has none. Never both, never neither.
DO $$ BEGIN
  ALTER TABLE reports ADD CONSTRAINT reports_location_honesty
    CHECK (
      (geom IS NULL AND location_status = 'unavailable') OR
      (geom IS NOT NULL AND location_status IN ('provided','imprecise'))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN reports.location_status IS
  'provided | unavailable | imprecise. DB-enforced: geom IS NULL ⟺ unavailable. The UI must render each value honestly and never invent a point.';

-- Workflow semantics, stated once, authoritatively. status='verified' means
-- "accepted as a legitimate citizen submission" — NEVER factual verification
-- of the underlying claim. The claim continues on information_state alone.
COMMENT ON TABLE reports IS
  'Citizen observations. TWO AXES, NEVER MERGED: status = HANDLING WORKFLOW (reported → under_review → verified|rejected|duplicate → in_progress → resolved); information_state = EPISTEMIC state (the 7-state canon, default citizen_submitted). A report with status=verified is an ACCEPTED SUBMISSION, not a verified fact. Claims originating from reports enter via ingest_channel=citizen_portal at citizen_submitted/source_backed — never verified (see claims_citizen_gate trigger).';

COMMENT ON COLUMN reports.status IS
  'Handling workflow. verified = "accepted as a legitimate citizen submission" — NOT factual verification. User-facing wording: "Submission accepted".';

-- The baseline JSONB evidence blob is superseded by the report_evidence table.
COMMENT ON COLUMN reports.evidence IS
  'LEGACY intake blob. Superseded by the report_evidence table (migration 0005). Retained for backward compatibility; new writes go to report_evidence.';

-- --------------------------------------------------------------------------
-- 2. report_evidence — proper evidence representation
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS report_evidence (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id     UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  evidence_type TEXT NOT NULL
    CHECK (evidence_type IN
      ('photo','video','document','audio','location_pin','metadata_only')),
  storage_ref   TEXT NOT NULL CHECK (storage_ref <> ''),
  -- Opaque pointer issued by the storage layer (e.g. object key). Never a
  -- fabricated URL. The storage implementation evolves independently.
  original_filename TEXT,
  mime_type     TEXT,   -- validated against an allowlist at intake
  byte_size     BIGINT CHECK (byte_size IS NULL OR byte_size >= 0),
  captured_at   TIMESTAMPTZ,
  -- When the material was captured (EXIF / user-stated). NULL = unknown —
  -- never guessed, never backfilled from submission time.
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  has_location  BOOLEAN NOT NULL DEFAULT FALSE,
  captured_geom GEOMETRY(Point, 4326),
  -- Device/EXIF location attached to the material itself. Consent-gated:
  -- only stored when the submitter explicitly allowed it.
  is_original   BOOLEAN NOT NULL DEFAULT TRUE,
  -- FALSE when the material is derived/edited (cropped, compiled, transcribed).
  metadata      JSONB NOT NULL DEFAULT '{}',
  -- Dimensions, duration, device info as supplied. User-provided metadata is
  -- never trusted as fact; it is provenance context only.
  review_state  TEXT NOT NULL DEFAULT 'pending'
    CHECK (review_state IN ('pending','accepted','rejected')),
  -- Moderator judgement on the MATERIAL (relevant? intact?). 'accepted' is
  -- NOT claim verification and is never presented as such. Rejected material
  -- is preserved, never deleted.
  submitted_by  UUID,  -- users.id; NULL when anonymous. Never exposed publicly.
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS report_evidence_report_idx ON report_evidence (report_id);
CREATE INDEX IF NOT EXISTS report_evidence_review_idx ON report_evidence (review_state);

COMMENT ON TABLE report_evidence IS
  'Material supporting a report. Receiving a photograph proves nothing: review_state=accepted means a moderator judged the material relevant and intact — it is NOT claim verification.';

-- --------------------------------------------------------------------------
-- 3. report_claims — explicit Claim → Report provenance
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS report_claims (
  report_id    UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  claim_id     UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL DEFAULT 'originated_from'
    CHECK (relationship IN ('originated_from','supports','contradicts')),
  created_by   UUID,  -- moderator / service identity that made the link
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (report_id, claim_id)
);
CREATE INDEX IF NOT EXISTS report_claims_claim_idx ON report_claims (claim_id);

COMMENT ON TABLE report_claims IS
  'Explicit M:N provenance: which claims came from / are supported or contradicted by which reports. Answers "Where did this claim come from?" without embedding the report inside the claim.';

-- --------------------------------------------------------------------------
-- 4. report_intake_log — operational rate limiting ONLY
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS report_intake_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID,            -- NULL when anonymous
  fingerprint TEXT NOT NULL,   -- session/device fingerprint, hashed at the API
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS report_intake_log_fp_time_idx
  ON report_intake_log (fingerprint, created_at);

COMMENT ON TABLE report_intake_log IS
  'OPERATIONAL ABUSE CONTROL ONLY: intake rate limiting and duplicate/abuse triage. Minimum data. NOT a behavioral-tracking system: no citizen scoring, no ranking, no profiling. Retention: rows older than 90 days may be purged by the service_role maintenance job; aggregates for abuse triage only.';

-- --------------------------------------------------------------------------
-- 5. Defense in depth — citizen_portal claims can never be born `verified`
-- --------------------------------------------------------------------------
-- Even if the service layer and RLS both failed, the database refuses.
CREATE OR REPLACE FUNCTION forbid_verified_citizen_claim() RETURNS trigger AS $$
BEGIN
  IF NEW.ingest_channel = 'citizen_portal'
     AND NEW.information_state = 'verified' THEN
    RAISE EXCEPTION 'civic: citizen_portal claims may never be created as verified';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS claims_citizen_gate ON claims;
CREATE TRIGGER claims_citizen_gate
  BEFORE INSERT OR UPDATE OF ingest_channel, information_state ON claims
  FOR EACH ROW EXECUTE FUNCTION forbid_verified_citizen_claim();

COMMENT ON FUNCTION forbid_verified_citizen_claim() IS
  'Phase 3 gate: a citizen submission is evidence of an observation, never automatic factual verification. Complements RLS (citizens cannot write claims at all) and the service layer (channelInitialState never returns verified for citizen_portal).';

-- --------------------------------------------------------------------------
-- 6. RLS — extend the Phase 1 contract to the new tables
-- --------------------------------------------------------------------------
ALTER TABLE report_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_claims   ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_intake_log ENABLE ROW LEVEL SECURITY;

-- Public read: civic evidence metadata is public by design (the material
-- itself is served by the storage layer under its own access rules).
DROP POLICY IF EXISTS report_evidence_pub_read ON report_evidence;
CREATE POLICY report_evidence_pub_read ON report_evidence
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS report_claims_pub_read ON report_claims;
CREATE POLICY report_claims_pub_read ON report_claims
  FOR SELECT TO anon, authenticated USING (true);

-- Citizen evidence intake: INSERT-only, pinned. Citizens submit material;
-- they never approve it.
DROP POLICY IF EXISTS report_evidence_intake ON report_evidence;
CREATE POLICY report_evidence_intake ON report_evidence
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    storage_ref <> '' AND
    evidence_type IN
      ('photo','video','document','audio','location_pin','metadata_only') AND
    review_state = 'pending'
  );

-- report_claims: NO citizen write policy — links are moderator/service only.
-- report_intake_log: NO anon/authenticated policy at all — default deny.

-- The ONE deliberate change to an existing intake policy: reports may now be
-- submitted without a coordinate (honest no-location reports). Every 0004
-- pin (status, information_state) is preserved.
DROP POLICY IF EXISTS reports_intake ON reports;
CREATE POLICY reports_intake ON reports
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    title <> '' AND description <> '' AND
    status = 'reported'::report_status AND
    information_state = 'citizen_submitted'::information_state
  );

-- Grants (mirroring the 0003 contract).
GRANT SELECT ON report_evidence, report_claims TO anon, authenticated;
GRANT INSERT ON report_evidence TO anon, authenticated;
GRANT ALL ON report_evidence, report_claims, report_intake_log TO service_role;

-- --------------------------------------------------------------------------
-- Verification block (run after applying):
--   1. \d reports → observed_at, location_status present; geom nullable.
--   2. report_evidence / report_claims / report_intake_log exist with indexes.
--   3. claims_citizen_gate trigger exists on claims.
--   4. As anon: INSERT report with status='resolved' FAILS; with defaults
--      SUCCEEDS as reported/citizen_submitted — with or without geom
--      (geom NULL requires location_status='unavailable' via the honesty
--      CHECK; geom set requires 'provided'/'imprecise').
--   5. As anon: INSERT report_evidence with review_state='accepted' FAILS;
--      with defaults SUCCEEDS as pending.
--   6. As anon: INSERT/UPDATE/DELETE on report_claims and report_intake_log
--      FAIL (no policies → default deny).
--   7. As service_role: INSERT INTO claims (ingest_channel='citizen_portal',
--      information_state='verified') FAILS (trigger).
--   8. SELECT policyname, cmd FROM pg_policies WHERE tablename IN
--      ('report_evidence','report_claims','report_intake_log') shows exactly
--      the policies above.
-- ============================================================================
