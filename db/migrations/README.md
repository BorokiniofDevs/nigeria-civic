# Database migrations

Convention for the Nigeria Civic Intelligence Platform:

- Files are applied **in numeric order** by the provisioning runner.
- `0001_baseline.sql` is the v0.1 schema, verbatim, as the canonical baseline.
  Every later migration transforms it; `db/schema.sql` is always the
  post-migration canonical snapshot (regenerate it when a migration lands).
- One logical change-set per file. Prefer `IF NOT EXISTS` / `OR REPLACE` so a
  half-applied migration can be re-run safely.
- **Enum additions are special:** `ALTER TYPE … ADD VALUE` cannot run inside a
  transaction block. Statements flagged `-- AUTOCOMMIT` must be applied in
  autocommit mode (or split into their own file by the runner).
- Data migrations must be explicit about value mapping — see 0002's
  `verification_status` → `information_state` mapping table. Never silently
  coerce unknown values; fail closed with a raised exception.
- Migrations never insert fixture civic data (no officials, no contacts, no
  budgets, no projects). Reference data (sectors, roles) arrives via reviewed
  seed manifests, not migrations.
- Every migration ends with a verification block comment stating what to check.
- 0005 (Phase 3) is the citizen evidence & reporting migration: report_evidence,
  report_claims, report_intake_log, reports honesty/location changes, the
  claims_citizen_gate trigger, and the RLS extension. It also relaxes
  reports_intake to allow NULL geom — the one deliberate change to an
  existing intake policy, documented in the migration.
