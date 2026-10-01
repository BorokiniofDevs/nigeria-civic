-- ============================================================================
-- MIGRATION 0002 — Canonical provenance architecture (Phase 1)
--
-- Establishes:
--   1. information_state — the 7-state canonical vocabulary. Nothing is a
--      boolean. A record is never "verified" because an AI, scraper, user,
--      search result or confidence score produced it.
--   2. claims / claim_sources / claim_events — the entity ↔ claim ↔ source ↔
--      state ↔ history distinction. Claims are canonical; entity-table
--      information_state/source_id columns are a maintained published view.
--   3. Universal ingestion — change_requests generalized: every future source
--      enters here; approval creates claims (never verified, never direct
--      entity writes).
--   4. Jurisdiction integrity — constitutional LGA vs state-created LCDA as
--      data (constitutional_status), legal parentage enforced by trigger.
--      No Lagos-specific assumptions anywhere in the model.
--   5. Five-stage public finance (budgeted/released/awarded/paid/verified).
--   6. Configurable score-based escalation (AI Studio mechanism, not constants).
--
-- Enum-value mapping for verification_status → information_state:
--   verified   → verified
--   disputed   → disputed
--   stale      → outdated
--   rejected   → rejected
--   pending/unverified WITH source_id    → source_backed
--       (it was "source-backed but pending verification" all along)
--   pending/unverified WITHOUT source_id → unknown
--       (honest: we hold no identifiable evidence)
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. New canonical enums
-- --------------------------------------------------------------------------
CREATE TYPE information_state AS ENUM (
  'unknown',            -- no information / not available. Distinct from "unchecked".
  'citizen_submitted',  -- citizen allegation/report/evidence. Not reviewed. Never
                        -- presented as fact.
  'source_backed',      -- supported by identifiable source(s); pending human verification.
  'verified',           -- human-verified against identifiable source evidence, with a
                        -- recorded verification event. See verification rules below.
  'disputed',           -- conflicting claims or active challenge; under resolution.
  'outdated',           -- previously verified/source-backed; superseded or stale.
  'rejected'            -- reviewed and rejected. Preserved, never deleted, never current.
);

-- How a claim/change-request arrived. Distinct from sources.source_type
-- (the evidence). Verification rules key off this: no channel mints `verified`
-- on its own, and ai_extraction alone caps at `source_backed`.
CREATE TYPE ingest_channel AS ENUM (
  'citizen_portal',     -- in-app citizen submission
  'verifier_console',   -- human verifier working from evidence
  'document_upload',    -- PDF/image/document supplied by anyone
  'web_ingest',         -- scraper/crawler of an identifiable source
  'dataset_import',     -- structured dataset (CSV/GeoJSON/API dump)
  'api_feed',           -- recurring machine feed
  'satellite_pipeline', -- earth-observation ingestion (future)
  'ai_extraction',      -- AI-extracted or AI-generated. Always labelled. Never
                        -- authoritative on its own.
  'system_migration'    -- bulk load from a previous system, with provenance notes
);

CREATE TYPE ingest_status AS ENUM (
  'submitted', 'under_review', 'needs_info', 'approved', 'rejected', 'withdrawn'
);

-- --------------------------------------------------------------------------
-- 2. Enum additions to existing types
-- NOTE (AUTOCOMMIT): ALTER TYPE … ADD VALUE cannot run inside a transaction
-- block. Apply these two statements in autocommit mode.
-- --------------------------------------------------------------------------
-- AUTOCOMMIT
ALTER TYPE geo_level ADD VALUE IF NOT EXISTS 'senatorial_district';
-- AUTOCOMMIT
ALTER TYPE source_type ADD VALUE IF NOT EXISTS 'satellite_imagery';

-- --------------------------------------------------------------------------
-- 3. Claims — the canonical provenance layer
--
-- THE DISTINCTION (read once, enforce everywhere):
--   Entity  = the thing itself (geo_entities, institutions, officials, …).
--             Holds identity + geometry.
--   Claim   = one assertion about one entity (this table).
--   Source  = identifiable evidence, via claim_sources (many-to-many; a claim
--             may cite several sources, one source may back several claims).
--   State   = information_state on the claim: the 7-state vocabulary.
--   History = claim_events (every transition) + superseded_by links.
--             Append-only. Supersede, never overwrite, never delete.
--
-- Entity tables keep information_state/source_id columns as the PUBLISHED VIEW:
-- a denormalized cache of the latest authoritative claim, maintained by the
-- ingestion service. They are never hand-edited; the claims tables are truth.
-- --------------------------------------------------------------------------
CREATE TABLE claims (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type       TEXT NOT NULL,  -- geo_entity | institution | official |
                                    -- office_holding | facility | project |
                                    -- budget_line | road | legislative_item |
                                    -- news_item | public_office | ...
  entity_id         UUID NOT NULL,  -- polymorphic; no FK by design
  claim_key         TEXT NOT NULL,  -- office_holder | phone | email | address |
                                    -- budgeted_value | released_value |
                                    -- project_status | boundary | name | ...
  claim_value       JSONB NOT NULL, -- the asserted value (schema per claim_key)
  ingest_channel    ingest_channel NOT NULL,
  information_state information_state NOT NULL DEFAULT 'unknown',
  confidence        NUMERIC,        -- 0..1. METADATA ONLY. It is never read by
                                    -- any verification rule. A score is not evidence.
  effective_from    DATE,
  effective_to      DATE,
  superseded_by     UUID REFERENCES claims(id),
  created_by        UUID,           -- users.id; NULL for system ingestion
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT claims_confidence_range
    CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1))
);
CREATE INDEX claims_entity_key_idx ON claims (entity_type, entity_id, claim_key);
CREATE INDEX claims_state_idx      ON claims (information_state);
CREATE INDEX claims_value_gin      ON claims USING GIN (claim_value);

-- Supporting / contradicting evidence per claim.
-- A claim linked ONLY to contradicting sources is a dispute candidate.
-- A claim with NO primary_evidence source may never enter `verified`.
CREATE TABLE claim_sources (
  claim_id    UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  source_id   UUID NOT NULL REFERENCES sources(id),
  source_role TEXT NOT NULL
    CHECK (source_role IN ('primary_evidence','corroborating','contradicting')),
  note        TEXT,
  PRIMARY KEY (claim_id, source_id)
);
CREATE INDEX claim_sources_source_idx ON claim_sources (source_id);

-- Verification history. APPEND-ONLY (see RLS in 0003: no UPDATE/DELETE for any
-- interactive role). Every state transition lands here with who/what/why.
CREATE TABLE claim_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id    UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  actor_type  TEXT NOT NULL
    CHECK (actor_type IN ('citizen','verifier','admin','authority','system')),
  actor_id    UUID,
  event       TEXT NOT NULL
    CHECK (event IN ('submitted','source_attached','verified','disputed',
                     'rejected','superseded','expired','restored','note')),
  old_state   information_state,
  new_state   information_state,
  note        TEXT,
  evidence_ref JSONB,               -- pointers to the evidence examined
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX claim_events_claim_idx ON claim_events (claim_id, created_at);

-- --------------------------------------------------------------------------
-- Verification lifecycle — canonical transition rules.
-- (DB-enforced where expressible; the ingestion service in
-- platform/src/lib/provenance.ts enforces the multi-table rules, with a
-- scheduled consistency report as backstop.)
--
--   unknown → citizen_submitted | source_backed
--   citizen_submitted → source_backed | disputed | rejected
--   source_backed → verified | disputed | rejected | outdated
--   verified → disputed | outdated
--   disputed → verified | source_backed | rejected
--   outdated → source_backed | verified
--   rejected → (terminal; supersede with a new claim, never revive)
--
-- A claim may enter `verified` ONLY IF:
--   (a) ≥1 claim_sources row with source_role='primary_evidence';
--   (b) a claim_events row event='verified' by actor_type ∈
--       {verifier, admin, authority}, recorded in the same operation
--       (a named, accountable human — never "the system");
--   (c) ingest_channel='ai_extraction' is never sufficient alone: AI-origin
--       claims cap at `source_backed` until (a)+(b) are met independently;
--   (d) `confidence` is not consulted. Ever.
-- --------------------------------------------------------------------------

-- --------------------------------------------------------------------------
-- 4. change_requests → universal ingestion pattern
-- Every future source enters here. Approval CREATES CLAIMS (in
-- citizen_submitted or source_backed — never verified) and records their IDs.
-- It NEVER writes entity attributes directly.
-- --------------------------------------------------------------------------
ALTER TABLE change_requests ALTER COLUMN status DROP DEFAULT;
ALTER TABLE change_requests
  ALTER COLUMN status TYPE ingest_status
  USING (
    CASE status::text
      WHEN 'approved' THEN 'approved'::ingest_status
      WHEN 'rejected' THEN 'rejected'::ingest_status
      ELSE 'submitted'::ingest_status
    END
  );
ALTER TABLE change_requests ALTER COLUMN status SET DEFAULT 'submitted';

ALTER TABLE change_requests
  ADD COLUMN ingest_channel ingest_channel NOT NULL DEFAULT 'citizen_portal',
  ADD COLUMN source_id UUID REFERENCES sources(id),       -- identifiable source, when one exists
  ADD COLUMN proposed_claims JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- [{entity_type, entity_id, claim_key, claim_value}] — assertions to stage
  ADD COLUMN resulting_claim_ids UUID[] NOT NULL DEFAULT '{}';
COMMENT ON COLUMN change_requests.proposed_claims IS
  'Claim assertions staged by this request. On approval the ingestion service inserts them into claims (state: citizen_submitted or source_backed — never verified) and records the IDs in resulting_claim_ids.';
COMMENT ON COLUMN change_requests.resulting_claim_ids IS
  'claims.id values created when this request was approved. Empty until approval.';

-- --------------------------------------------------------------------------
-- 5. verification_status → information_state (11 tables)
-- Column renamed AND re-typed with the explicit value mapping from the header.
-- --------------------------------------------------------------------------

-- Helper pattern applied per table:
--   1. DROP DEFAULT (old default 'unverified' is not a valid new value)
--   2. ALTER TYPE with USING mapping (explicit value map — fail closed)
--   3. RENAME to information_state
--   4. SET DEFAULT 'unknown' (honest default: we hold no evidence)

-- geo_entities
ALTER TABLE geo_entities ALTER COLUMN verification_status DROP DEFAULT;
ALTER TABLE geo_entities ALTER COLUMN verification_status TYPE information_state USING (
  CASE
    WHEN verification_status::text = 'verified' THEN 'verified'::information_state
    WHEN verification_status::text = 'disputed' THEN 'disputed'::information_state
    WHEN verification_status::text = 'stale'    THEN 'outdated'::information_state
    WHEN verification_status::text = 'rejected' THEN 'rejected'::information_state
    WHEN verification_status::text IN ('pending','unverified') AND source_id IS NOT NULL
      THEN 'source_backed'::information_state
    ELSE 'unknown'::information_state
  END);
ALTER TABLE geo_entities RENAME COLUMN verification_status TO information_state;
ALTER TABLE geo_entities ALTER COLUMN information_state SET DEFAULT 'unknown';

-- institutions
ALTER TABLE institutions ALTER COLUMN verification_status DROP DEFAULT;
ALTER TABLE institutions ALTER COLUMN verification_status TYPE information_state USING (
  CASE
    WHEN verification_status::text = 'verified' THEN 'verified'::information_state
    WHEN verification_status::text = 'disputed' THEN 'disputed'::information_state
    WHEN verification_status::text = 'stale'    THEN 'outdated'::information_state
    WHEN verification_status::text = 'rejected' THEN 'rejected'::information_state
    WHEN verification_status::text IN ('pending','unverified') AND source_id IS NOT NULL
      THEN 'source_backed'::information_state
    ELSE 'unknown'::information_state
  END);
ALTER TABLE institutions RENAME COLUMN verification_status TO information_state;
ALTER TABLE institutions ALTER COLUMN information_state SET DEFAULT 'unknown';

-- office_holdings
ALTER TABLE office_holdings ALTER COLUMN verification_status DROP DEFAULT;
ALTER TABLE office_holdings ALTER COLUMN verification_status TYPE information_state USING (
  CASE
    WHEN verification_status::text = 'verified' THEN 'verified'::information_state
    WHEN verification_status::text = 'disputed' THEN 'disputed'::information_state
    WHEN verification_status::text = 'stale'    THEN 'outdated'::information_state
    WHEN verification_status::text = 'rejected' THEN 'rejected'::information_state
    WHEN verification_status::text IN ('pending','unverified') AND source_id IS NOT NULL
      THEN 'source_backed'::information_state
    ELSE 'unknown'::information_state
  END);
ALTER TABLE office_holdings RENAME COLUMN verification_status TO information_state;
ALTER TABLE office_holdings ALTER COLUMN information_state SET DEFAULT 'unknown';

-- public_offices
ALTER TABLE public_offices ALTER COLUMN verification_status DROP DEFAULT;
ALTER TABLE public_offices ALTER COLUMN verification_status TYPE information_state USING (
  CASE
    WHEN verification_status::text = 'verified' THEN 'verified'::information_state
    WHEN verification_status::text = 'disputed' THEN 'disputed'::information_state
    WHEN verification_status::text = 'stale'    THEN 'outdated'::information_state
    WHEN verification_status::text = 'rejected' THEN 'rejected'::information_state
    WHEN verification_status::text IN ('pending','unverified') AND source_id IS NOT NULL
      THEN 'source_backed'::information_state
    ELSE 'unknown'::information_state
  END);
ALTER TABLE public_offices RENAME COLUMN verification_status TO information_state;
ALTER TABLE public_offices ALTER COLUMN information_state SET DEFAULT 'unknown';

-- social_accounts
ALTER TABLE social_accounts ALTER COLUMN verification_status DROP DEFAULT;
ALTER TABLE social_accounts ALTER COLUMN verification_status TYPE information_state USING (
  CASE
    WHEN verification_status::text = 'verified' THEN 'verified'::information_state
    WHEN verification_status::text = 'disputed' THEN 'disputed'::information_state
    WHEN verification_status::text = 'stale'    THEN 'outdated'::information_state
    WHEN verification_status::text = 'rejected' THEN 'rejected'::information_state
    WHEN verification_status::text IN ('pending','unverified') AND source_id IS NOT NULL
      THEN 'source_backed'::information_state
    ELSE 'unknown'::information_state
  END);
ALTER TABLE social_accounts RENAME COLUMN verification_status TO information_state;
ALTER TABLE social_accounts ALTER COLUMN information_state SET DEFAULT 'unknown';

-- facilities
ALTER TABLE facilities ALTER COLUMN verification_status DROP DEFAULT;
ALTER TABLE facilities ALTER COLUMN verification_status TYPE information_state USING (
  CASE
    WHEN verification_status::text = 'verified' THEN 'verified'::information_state
    WHEN verification_status::text = 'disputed' THEN 'disputed'::information_state
    WHEN verification_status::text = 'stale'    THEN 'outdated'::information_state
    WHEN verification_status::text = 'rejected' THEN 'rejected'::information_state
    WHEN verification_status::text IN ('pending','unverified') AND source_id IS NOT NULL
      THEN 'source_backed'::information_state
    ELSE 'unknown'::information_state
  END);
ALTER TABLE facilities RENAME COLUMN verification_status TO information_state;
ALTER TABLE facilities ALTER COLUMN information_state SET DEFAULT 'unknown';

-- roads
ALTER TABLE roads ALTER COLUMN verification_status DROP DEFAULT;
ALTER TABLE roads ALTER COLUMN verification_status TYPE information_state USING (
  CASE
    WHEN verification_status::text = 'verified' THEN 'verified'::information_state
    WHEN verification_status::text = 'disputed' THEN 'disputed'::information_state
    WHEN verification_status::text = 'stale'    THEN 'outdated'::information_state
    WHEN verification_status::text = 'rejected' THEN 'rejected'::information_state
    WHEN verification_status::text IN ('pending','unverified') AND source_id IS NOT NULL
      THEN 'source_backed'::information_state
    ELSE 'unknown'::information_state
  END);
ALTER TABLE roads RENAME COLUMN verification_status TO information_state;
ALTER TABLE roads ALTER COLUMN information_state SET DEFAULT 'unknown';

-- projects
ALTER TABLE projects ALTER COLUMN verification_status DROP DEFAULT;
ALTER TABLE projects ALTER COLUMN verification_status TYPE information_state USING (
  CASE
    WHEN verification_status::text = 'verified' THEN 'verified'::information_state
    WHEN verification_status::text = 'disputed' THEN 'disputed'::information_state
    WHEN verification_status::text = 'stale'    THEN 'outdated'::information_state
    WHEN verification_status::text = 'rejected' THEN 'rejected'::information_state
    WHEN verification_status::text IN ('pending','unverified') AND source_id IS NOT NULL
      THEN 'source_backed'::information_state
    ELSE 'unknown'::information_state
  END);
ALTER TABLE projects RENAME COLUMN verification_status TO information_state;
ALTER TABLE projects ALTER COLUMN information_state SET DEFAULT 'unknown';

-- budget_lines
ALTER TABLE budget_lines ALTER COLUMN verification_status DROP DEFAULT;
ALTER TABLE budget_lines ALTER COLUMN verification_status TYPE information_state USING (
  CASE
    WHEN verification_status::text = 'verified' THEN 'verified'::information_state
    WHEN verification_status::text = 'disputed' THEN 'disputed'::information_state
    WHEN verification_status::text = 'stale'    THEN 'outdated'::information_state
    WHEN verification_status::text = 'rejected' THEN 'rejected'::information_state
    WHEN verification_status::text IN ('pending','unverified') AND source_id IS NOT NULL
      THEN 'source_backed'::information_state
    ELSE 'unknown'::information_state
  END);
ALTER TABLE budget_lines RENAME COLUMN verification_status TO information_state;
ALTER TABLE budget_lines ALTER COLUMN information_state SET DEFAULT 'unknown';

-- legislative_items
ALTER TABLE legislative_items ALTER COLUMN verification_status DROP DEFAULT;
ALTER TABLE legislative_items ALTER COLUMN verification_status TYPE information_state USING (
  CASE
    WHEN verification_status::text = 'verified' THEN 'verified'::information_state
    WHEN verification_status::text = 'disputed' THEN 'disputed'::information_state
    WHEN verification_status::text = 'stale'    THEN 'outdated'::information_state
    WHEN verification_status::text = 'rejected' THEN 'rejected'::information_state
    WHEN verification_status::text IN ('pending','unverified') AND source_id IS NOT NULL
      THEN 'source_backed'::information_state
    ELSE 'unknown'::information_state
  END);
ALTER TABLE legislative_items RENAME COLUMN verification_status TO information_state;
ALTER TABLE legislative_items ALTER COLUMN information_state SET DEFAULT 'unknown';

-- news_items
ALTER TABLE news_items ALTER COLUMN verification_status DROP DEFAULT;
ALTER TABLE news_items ALTER COLUMN verification_status TYPE information_state USING (
  CASE
    WHEN verification_status::text = 'verified' THEN 'verified'::information_state
    WHEN verification_status::text = 'disputed' THEN 'disputed'::information_state
    WHEN verification_status::text = 'stale'    THEN 'outdated'::information_state
    WHEN verification_status::text = 'rejected' THEN 'rejected'::information_state
    WHEN verification_status::text IN ('pending','unverified') AND source_id IS NOT NULL
      THEN 'source_backed'::information_state
    ELSE 'unknown'::information_state
  END);
ALTER TABLE news_items RENAME COLUMN verification_status TO information_state;
ALTER TABLE news_items ALTER COLUMN information_state SET DEFAULT 'unknown';

-- The old enum is now unreferenced: drop it so the two vocabularies can never mix.
DROP TYPE verification_status;

-- --------------------------------------------------------------------------
-- 6. Jurisdiction integrity — constitutional LGA vs state-created LCDA as DATA
-- --------------------------------------------------------------------------
ALTER TABLE geo_entities
  ADD COLUMN constitutional_status TEXT
  CHECK (constitutional_status IN
    ('constitutional','state_created','customary','statistical'));

COMMENT ON COLUMN geo_entities.constitutional_status IS
  'Constitutional standing of this jurisdiction. lga → constitutional (the 774); lcda → state_created (DB-enforced). "LGA / equivalent jurisdiction" in other states uses these same levels with the honest status — no state-specific branches anywhere.';

-- Backfill the standing rule for rows the baseline may already hold.
UPDATE geo_entities SET constitutional_status = 'constitutional'
  WHERE level = 'lga' AND constitutional_status IS NULL;
UPDATE geo_entities SET constitutional_status = 'state_created'
  WHERE level = 'lcda' AND constitutional_status IS NULL;

-- Legal parentage matrix. Unknown future tiers fail closed.
CREATE OR REPLACE FUNCTION validate_geo_parent() RETURNS trigger AS $$
DECLARE
  parent_level geo_level;
BEGIN
  IF NEW.parent_id IS NULL THEN
    IF NEW.level <> 'country' THEN
      RAISE EXCEPTION 'civic: only level=country may have no parent (got %)', NEW.level;
    END IF;
    RETURN NEW;
  END IF;

  SELECT level INTO parent_level FROM geo_entities WHERE id = NEW.parent_id;
  IF parent_level IS NULL THEN
    RAISE EXCEPTION 'civic: parent geo_entity % not found', NEW.parent_id;
  END IF;

  IF NOT (
    (NEW.level = 'state'               AND parent_level = 'country') OR
    (NEW.level = 'senatorial_district' AND parent_level = 'state')   OR
    (NEW.level = 'lga'                 AND parent_level = 'state')   OR
    (NEW.level = 'lcda'                AND parent_level = 'lga')     OR
    (NEW.level = 'ward'                AND parent_level IN ('lga','lcda')) OR
    (NEW.level = 'community'           AND parent_level = 'ward')    OR
    (NEW.level = 'street'              AND parent_level IN ('ward','community'))
  ) THEN
    RAISE EXCEPTION 'civic: illegal hierarchy: % cannot sit under %', NEW.level, parent_level;
  END IF;

  -- The LGA/LCDA distinction is structural, not a naming convention.
  IF NEW.level = 'lcda' AND NEW.constitutional_status IS DISTINCT FROM 'state_created' THEN
    RAISE EXCEPTION 'civic: lcda entities must carry constitutional_status=state_created';
  END IF;
  IF NEW.level = 'lga' AND NEW.constitutional_status IS DISTINCT FROM 'constitutional' THEN
    RAISE EXCEPTION 'civic: lga entities must carry constitutional_status=constitutional';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS geo_parent_check ON geo_entities;
CREATE TRIGGER geo_parent_check
  BEFORE INSERT OR UPDATE OF parent_id, level, constitutional_status ON geo_entities
  FOR EACH ROW EXECUTE FUNCTION validate_geo_parent();

-- Full hierarchy path per entity: Nigeria → State → LGA → (LCDA) → Ward →
-- Community → Street. Project AOIs remain geometry on projects (coordinates),
-- not hierarchy levels.
CREATE OR REPLACE VIEW geo_lineage AS
WITH RECURSIVE path AS (
  SELECT id, parent_id, level, name,
         ARRAY[id] AS path_ids, ARRAY[name] AS path_names, 1 AS depth
  FROM geo_entities WHERE parent_id IS NULL
  UNION ALL
  SELECT g.id, g.parent_id, g.level, g.name,
         p.path_ids || g.id, p.path_names || g.name, p.depth + 1
  FROM geo_entities g JOIN path p ON g.parent_id = p.id
)
SELECT id AS entity_id, level, name,
       path_ids, path_names, depth
FROM path;
COMMENT ON VIEW geo_lineage IS
  'Recursive hierarchy path for every geo entity. Powers GET /geo/:id/lineage.';

-- --------------------------------------------------------------------------
-- 7. reports — allegations carry an epistemic state distinct from workflow
-- --------------------------------------------------------------------------
-- reports.status  = handling workflow (reported → under_review → … → resolved).
-- information_state = what we actually know. A report is an allegation until
-- evidence says otherwise; the two axes are never merged.
ALTER TABLE reports
  ADD COLUMN information_state information_state NOT NULL DEFAULT 'citizen_submitted';

-- --------------------------------------------------------------------------
-- 8. Five-stage public finance
-- budgeted → released → awarded → paid (reported) → independently verified.
-- Never infer expenditure from budget. paid_value/spent = what is CLAIMED;
-- verified_* = what independent evidence supports. The stages are distinct
-- columns so they can never be confused.
-- --------------------------------------------------------------------------
ALTER TABLE budget_lines
  ADD COLUMN awarded NUMERIC,
  ADD COLUMN verified_spent NUMERIC;   -- independently verified expenditure only
COMMENT ON COLUMN budget_lines.spent IS
  'Reported/claimed spend — only where a source supports it. Distinct from verified_spent.';
COMMENT ON COLUMN budget_lines.verified_spent IS
  'Independently verified expenditure. The ONLY figure the UI may present as confirmed spend.';

ALTER TABLE projects
  ADD COLUMN awarded_value NUMERIC,
  ADD COLUMN verified_expenditure_value NUMERIC;
COMMENT ON COLUMN projects.paid_value IS
  'Reported paid amount. Distinct from verified_expenditure_value.';
COMMENT ON COLUMN projects.verified_expenditure_value IS
  'Independently verified expenditure. The ONLY figure the UI may present as confirmed spend.';

-- --------------------------------------------------------------------------
-- 9. Escalation rules — score-based rules become configurable
-- (The AI Studio mechanism: score = weighted votes + evidence bonus, threshold
--  triggers escalation. Adopted as DATA on a rule, not hardcoded constants.
--  Weights/thresholds are tuned against real moderation policy, not ported.)
-- --------------------------------------------------------------------------
ALTER TABLE escalation_rules
  ADD COLUMN score_threshold INT,          -- escalate when computed score ≥ this
  ADD COLUMN score_weights JSONB;         -- e.g. {local_vote:1.5, external_vote:0.5, media_bonus:10}
COMMENT ON COLUMN escalation_rules.score_weights IS
  'Optional scoring model for vote/evidence-driven escalation. NULL = rule is purely time/threshold based.';

-- --------------------------------------------------------------------------
-- Verification block (run after applying):
--   1. \dT → information_state, ingest_channel, ingest_status exist;
--      verification_status is gone.
--   2. Every table that had verification_status now has information_state
--      (11 tables) with DEFAULT 'unknown'.
--   3. claims / claim_sources / claim_events exist with indexes.
--   4. change_requests has ingest_channel, source_id, proposed_claims,
--      resulting_claim_ids; status is ingest_status.
--   5. geo_entities has constitutional_status + geo_parent_check trigger.
--   6. reports.information_state DEFAULT 'citizen_submitted'.
--   7. budget_lines/projects carry awarded + verified_* columns.
--   8. escalation_rules carries score_threshold + score_weights.
--   9. geo_lineage view exists.
--  10. No verification_status remnants: SELECT * FROM pg_attribute … = 0 rows.
-- ============================================================================
