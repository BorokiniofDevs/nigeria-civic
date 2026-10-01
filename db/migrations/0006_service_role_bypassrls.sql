-- ============================================================================
-- MIGRATION 0006 — service_role BYPASSRLS (Phase 3 architecture correction)
--
-- Implements the security model already documented by migration 0003:
--   "service_role: full authority. Every privileged write flows through the
--    ingestion service, which enforces the verification lifecycle.
--    (Table owners already bypass RLS; these grants make the contract
--    explicit.)"
--
-- 0003 granted service_role ALL on every table but created NO RLS policy for
-- it. That combination is only coherent if service_role bypasses RLS — which
-- the design assumed via table ownership. In deployments where the service
-- connects as service_role (NOLOGIN) rather than as the migration owner,
-- ordinary service operations were rejected by RLS. This migration makes the
-- intended bypass explicit and least-privilege:
--
--   - service_role REMAINS NOLOGIN (no direct login).
--   - service_role does NOT become table owner: it gains no DDL rights
--     (no ALTER/DROP, no disabling triggers, no dropping policies).
--   - No RLS policy is added or changed: anon/authenticated remain
--     constrained exactly as 0003/0004/0005 defined.
--   - BYPASSRLS bypasses row-level security ONLY. It does NOT bypass
--     triggers: claims_citizen_gate still fires for service_role, so a
--     citizen-originated claim can never be born 'verified' even by the
--     service. It does NOT bypass CHECK constraints, foreign keys, or the
--     report geometry/location honesty invariant.
--
-- Idempotent: safe to re-run.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'service_role' AND rolbypassrls
  ) THEN
    ALTER ROLE service_role BYPASSRLS;
  END IF;
END $$;

-- --------------------------------------------------------------------------
-- Verification block (run after applying):
--   1. SELECT rolbypassrls FROM pg_roles WHERE rolname='service_role' → t.
--   2. As service_role: INSERT/UPDATE/SELECT across reports, report_evidence,
--      report_claims, claims succeed (service operations work).
--   3. As service_role: pg_tables.tableowner for Phase 3 tables is NOT
--      service_role (ownership unchanged).
--   4. As service_role: INSERT INTO claims (ingest_channel='citizen_portal',
--      information_state='verified') still FAILS via claims_citizen_gate
--      (trigger fires despite BYPASSRLS).
--   5. As anon: INSERT into claims / UPDATE on geo_entities / DELETE
--      anywhere still FAIL (RLS unchanged).
--   6. As anon: INSERT report_evidence with review_state='accepted' still
--      FAILS; with defaults succeeds as pending.
-- ============================================================================
