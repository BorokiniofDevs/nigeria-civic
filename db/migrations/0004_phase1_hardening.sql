-- ============================================================================
-- MIGRATION 0004 — Phase 1 hardening (post architecture review)
--
-- Closes the four must-fix items. No redesign, no new tables, no UI impact.
--
--   1. RLS INTAKE HARDENING — enforced in WITH CHECK, not application code.
--      Citizens could previously spoof workflow/epistemic state at intake
--      (e.g. INSERT a report with status='resolved', information_state=
--      'verified'). Now pinned:
--        reports:         status='reported', information_state='citizen_submitted'
--        change_requests: status='submitted', resulting_claim_ids='{}'
--        report_events:   citizen inserts limited to event='note' with
--                         old_status/new_status NULL (no fake resolutions)
--   2. SOURCES += published_at, last_checked_at (provenance timeline —
--      "what did we know at time T"; staleness anchor).
--   3. source_type += procurement_record, court_record, third_party_dataset
--      (first-class taxonomy values).
--   4. Verification-gate strengthening (ai_generated can never satisfy the
--      primary_evidence requirement) is enforced in
--      platform/src/lib/provenance.ts → canBecomeVerified, which now takes
--      the primary sources' types as input. See that module's doc comment.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. RLS intake hardening — drop and recreate with pinned WITH CHECK
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS reports_intake ON reports;
CREATE POLICY reports_intake ON reports
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    title <> '' AND description <> '' AND geom IS NOT NULL
    AND status = 'reported'::report_status
    AND information_state = 'citizen_submitted'::information_state
  );

DROP POLICY IF EXISTS change_requests_intake ON change_requests;
CREATE POLICY change_requests_intake ON change_requests
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    reason <> '' AND
    jsonb_typeof(proposed_claims) = 'array' AND
    status = 'submitted'::ingest_status AND
    resulting_claim_ids = '{}'::uuid[]
  );

DROP POLICY IF EXISTS report_events_intake ON report_events;
CREATE POLICY report_events_intake ON report_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    actor_type = 'citizen' AND
    event = 'note' AND
    old_status IS NULL AND
    new_status IS NULL
  );

-- 'note' is now the documented citizen follow-up event on report_events.
COMMENT ON COLUMN report_events.event IS
  'created | acknowledged | assigned | evidence_requested | status_changed | resolved | reopened | escalated | moderated | note. note = citizen follow-up: the ONLY event citizens may insert (RLS report_events_intake).';

-- --------------------------------------------------------------------------
-- 2. Source provenance timestamps
-- published_at:    when the source document itself was published.
--                  NULL when unknown — never guessed.
-- last_checked_at: when we last confirmed the source still supports what we
--                  cite it for. The staleness anchor.
-- (created_at remains the row-registration time, ≈ when we obtained it.)
-- --------------------------------------------------------------------------
ALTER TABLE sources
  ADD COLUMN published_at TIMESTAMPTZ,
  ADD COLUMN last_checked_at TIMESTAMPTZ;
COMMENT ON COLUMN sources.published_at IS
  'Publication date of the source document itself. NULL when unknown — never guessed.';
COMMENT ON COLUMN sources.last_checked_at IS
  'When this source was last re-validated against the claims citing it. Staleness anchor.';

-- --------------------------------------------------------------------------
-- 3. Source taxonomy — first-class values
-- NOTE (AUTOCOMMIT): ALTER TYPE … ADD VALUE cannot run inside a transaction
-- block. Apply each flagged statement in autocommit mode.
-- --------------------------------------------------------------------------
-- AUTOCOMMIT
ALTER TYPE source_type ADD VALUE IF NOT EXISTS 'procurement_record';
-- AUTOCOMMIT
ALTER TYPE source_type ADD VALUE IF NOT EXISTS 'court_record';
-- AUTOCOMMIT
ALTER TYPE source_type ADD VALUE IF NOT EXISTS 'third_party_dataset';

-- --------------------------------------------------------------------------
-- Verification block (run after applying):
--   1. \d sources → published_at, last_checked_at present (nullable).
--   2. SELECT enum_range(NULL::source_type) → contains procurement_record,
--      court_record, third_party_dataset.
--   3. As anon: INSERT INTO reports (…) with status='resolved' FAILS;
--      with defaults SUCCEEDS and lands as reported/citizen_submitted.
--   4. As anon: INSERT INTO change_requests (…) with status='approved'
--      FAILS; with defaults SUCCEEDS as submitted with '{}' claim ids.
--   5. As anon: INSERT INTO report_events (…, event='resolved') FAILS;
--      event='note' with NULL old/new_status SUCCEEDS.
--   6. No other anon/authenticated INSERT/UPDATE/DELETE policies exist beyond
--      the three intake tables (+ users self-update): 
--      SELECT policyname, cmd FROM pg_policies WHERE roles && '{anon}'.
-- ============================================================================
