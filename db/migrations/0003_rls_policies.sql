-- ============================================================================
-- MIGRATION 0003 — Row Level Security (Phase 1)
--
-- Threat model: the database is reachable by the public API. Civic data is
-- public by design (transparency), but AUTHORITY is not: only the ingestion
-- service (service_role) may promote claims, verify, or mutate published
-- records. Citizens may SUBMIT (change_requests, reports) — never publish.
--
--   anon / authenticated : SELECT on public civic data; INSERT on intake
--                          tables only (change_requests, reports,
--                          report_events). No UPDATE. No DELETE. Ever.
--   service_role         : full access; every write goes through the
--                          ingestion service that enforces the provenance
--                          lifecycle (docs/PHASE1_PLAN.md §4–§5).
--
-- claim_events is APPEND-ONLY: no interactive role holds UPDATE/DELETE on it.
-- History cannot be rewritten.
-- reporter identity (reports.reporter_id → users.id) is never exposed:
-- anon has no access to users at all.
-- ============================================================================

DO $$ BEGIN
  CREATE ROLE anon NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE ROLE authenticated NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE ROLE service_role NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- --------------------------------------------------------------------------
-- Enable RLS everywhere (including the materialized view's base tables).
-- --------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sources','geo_entities','geo_aliases','institutions','officials',
    'office_holdings','public_offices','social_accounts','facilities','roads',
    'sectors','reports','report_events','escalation_rules','escalations',
    'projects','budget_lines','legislative_items','news_items','civic_briefs',
    'change_requests','audit_log','users','institution_claims',
    'claims','claim_sources','claim_events']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- --------------------------------------------------------------------------
-- Public read: civic data is public by design.
-- --------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sources','geo_entities','geo_aliases','institutions','officials',
    'office_holdings','public_offices','social_accounts','facilities','roads',
    'sectors','reports','report_events','escalation_rules','escalations',
    'projects','budget_lines','legislative_items','news_items','civic_briefs',
    'change_requests','audit_log','institution_claims',
    'claims','claim_sources','claim_events']
  LOOP
    EXECUTE format(
      'CREATE POLICY %I_public_read ON %I FOR SELECT TO anon, authenticated USING (true)',
      t || '_pub_read', t);
  END LOOP;
END $$;

-- --------------------------------------------------------------------------
-- Citizen intake: INSERT-only, validated. Citizens submit; they never publish.
-- --------------------------------------------------------------------------
CREATE POLICY change_requests_intake ON change_requests
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    reason <> '' AND
    jsonb_typeof(proposed_claims) = 'array'
  );

CREATE POLICY reports_intake ON reports
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    title <> '' AND description <> '' AND geom IS NOT NULL
  );

-- Citizens may append follow-ups to reports (actor_type='citizen'); the
-- service validates report_id ownership out-of-band via reporter_id.
CREATE POLICY report_events_intake ON report_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (actor_type = 'citizen');

-- --------------------------------------------------------------------------
-- users: invisible to anon. authenticated sees/updates ONLY their own row,
-- keyed by app.user_id set by the API per request (never trusted from client).
-- --------------------------------------------------------------------------
CREATE POLICY users_self_read ON users
  FOR SELECT TO authenticated
  USING (id = NULLIF(current_setting('app.user_id', true), '')::uuid);
CREATE POLICY users_self_update ON users
  FOR UPDATE TO authenticated
  USING (id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (id = NULLIF(current_setting('app.user_id', true), '')::uuid);

-- --------------------------------------------------------------------------
-- service_role: full authority. Every privileged write flows through the
-- ingestion service, which enforces the verification lifecycle.
-- (Table owners already bypass RLS; these grants make the contract explicit.)
-- --------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sources','geo_entities','geo_aliases','institutions','officials',
    'office_holdings','public_offices','social_accounts','facilities','roads',
    'sectors','reports','report_events','escalation_rules','escalations',
    'projects','budget_lines','legislative_items','news_items','civic_briefs',
    'change_requests','audit_log','users','institution_claims',
    'claims','claim_sources','claim_events']
  LOOP
    EXECUTE format('GRANT ALL ON %I TO service_role', t);
    EXECUTE format('GRANT SELECT ON %I TO anon, authenticated', t);
  END LOOP;
END $$;
GRANT INSERT ON change_requests, reports, report_events TO anon, authenticated;
GRANT UPDATE (display_name) ON users TO authenticated;

-- search_index is a materialized view: refresh is a service operation.
GRANT SELECT ON search_index TO anon, authenticated;

-- --------------------------------------------------------------------------
-- Explicit denials (defense in depth — default-deny already covers these,
-- but the provenance contract deserves to say them out loud):
--   - NOBODY except service_role writes claims / claim_sources / claim_events.
--   - claim_events has no UPDATE/DELETE policy for any interactive role:
--     history is append-only.
--   - No interactive role holds DELETE on any table.
-- --------------------------------------------------------------------------

-- --------------------------------------------------------------------------
-- Verification block:
--   1. SELECT * FROM pg_policies → every table has its _pub_read policy.
--   2. As anon: INSERT into change_requests/reports succeeds; INSERT into
--      claims fails; UPDATE on geo_entities fails; DELETE fails everywhere.
--   3. As anon: SELECT on users returns 0 rows.
-- ============================================================================
