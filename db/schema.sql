-- ============================================================================
-- Nigeria Civic Intelligence Platform — Core Data Model (v0.3)
-- PostgreSQL + PostGIS. CANONICAL SNAPSHOT — the post-migration state.
-- History: db/migrations/0001_baseline.sql (v0.1) → 0002_provenance_canon →
--          0003_rls_policies → 0004_phase1_hardening. When a migration lands,
--          regenerate this file.
--
-- PROVENANCE CONTRACT (Phase 1):
--   Entity  = the thing itself (geo_entities, institutions, …). Identity + geometry.
--   Claim   = one assertion about one entity (claims table). Canonical truth.
--   Source  = identifiable evidence (sources, via claim_sources).
--   State   = information_state: unknown | citizen_submitted | source_backed |
--             verified | disputed | outdated | rejected. NEVER a boolean.
--   History = claim_events (append-only) + superseded_by links.
-- Entity-table information_state/source_id columns are the PUBLISHED VIEW: a
-- maintained cache of the latest authoritative claim. Never hand-edited.
--
-- Nothing becomes `verified` because an AI generated it, a scraper found it, a
-- user submitted it, a search result returned it, or a confidence score was
-- assigned. Verification = identifiable source evidence + a recorded
-- verification event by an accountable human (verifier/admin/authority).
--
-- SRID 4326 (WGS84) throughout.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()

-- --------------------------------------------------------------------------
-- Enumerations
-- --------------------------------------------------------------------------
CREATE TYPE geo_level AS ENUM (
  'country', 'state', 'senatorial_district', 'lga', 'lcda', 'ward',
  'community', 'street'
);
-- senatorial_district: nationally uniform (109), optional tier under state.
-- lcda: optional tier under lga, ONLY where a state created it. The
-- constitutional LGA vs state-created LCDA distinction lives in
-- geo_entities.constitutional_status (data, not code).

-- The canonical 7-state vocabulary. One enum, everywhere. No booleans.
CREATE TYPE information_state AS ENUM (
  'unknown',            -- no information / not available
  'citizen_submitted',  -- citizen allegation/evidence; not reviewed; never fact
  'source_backed',      -- identifiable source(s); pending human verification
  'verified',           -- human-verified against source evidence + recorded event
  'disputed',           -- conflicting claims / active challenge
  'outdated',           -- previously verified/backed; superseded or stale
  'rejected'            -- reviewed and rejected; preserved, never current
);

CREATE TYPE source_type AS ENUM (
  'official_government',    -- govt portals, MDAs: authoritative for institutional facts
  'gazette_legislation',    -- gazettes, laws, public records
  'official_social',        -- verified institutional social accounts
  'reputable_third_party',  -- reputable media/research: enrichment + cross-checking
  'geo_service',            -- maps/geographic enrichment ONLY (never office-holders)
  'citizen_evidence',       -- citizen-submitted ground evidence
  'satellite_imagery',      -- earth-observation providers (evidence, not proof)
  'procurement_record',     -- procurement/tender/award records: first-class finance evidence
  'court_record',           -- court judgments, filings, legal proceedings
  'third_party_dataset',    -- structured third-party datasets (not scraped single pages)
  'ai_generated'            -- AI extraction/summary: always labelled, never authoritative
);

-- How a claim/change-request ARRIVED. Distinct from source_type (the evidence).
-- No channel mints `verified` on its own; ai_extraction alone caps at
-- `source_backed`.
CREATE TYPE ingest_channel AS ENUM (
  'citizen_portal', 'verifier_console', 'document_upload', 'web_ingest',
  'dataset_import', 'api_feed', 'satellite_pipeline', 'ai_extraction',
  'system_migration'
);

-- Universal ingestion lifecycle: submitted → under_review → approved/rejected;
-- under_review → needs_info → under_review. Approval creates claims — never
-- writes entity attributes directly, never mints `verified`.
CREATE TYPE ingest_status AS ENUM (
  'submitted', 'under_review', 'needs_info', 'approved', 'rejected', 'withdrawn'
);

CREATE TYPE report_status AS ENUM (
  'reported', 'under_review', 'verified', 'in_progress', 'resolved', 'rejected', 'duplicate'
);
-- reports.status = HANDLING WORKFLOW. reports.information_state = what we know.
-- Different axes; never merged.

CREATE TYPE term_status AS ENUM (
  'current', 'previous', 'elect', 'acting', 'vacant'
);

-- --------------------------------------------------------------------------
-- Sources — the provenance backbone (§4)
-- --------------------------------------------------------------------------
CREATE TABLE sources (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  source_type source_type NOT NULL,
  url         TEXT,
  publisher   TEXT,
  published_at TIMESTAMPTZ,     -- when the source document itself was published;
                                -- NULL when unknown — never guessed
  last_checked_at TIMESTAMPTZ,  -- last re-validation against citing claims (staleness anchor)
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------------
-- Geographic hierarchy: Nigeria → State → LGA → (LCDA) → Ward → Community → Street
-- --------------------------------------------------------------------------
CREATE TABLE geo_entities (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id           UUID REFERENCES geo_entities(id),
  level               geo_level NOT NULL,
  name                TEXT NOT NULL,
  slug                TEXT NOT NULL,
  code                TEXT,                       -- official code where one exists
  -- Constitutional standing. lga → 'constitutional' (the 774);
  -- lcda → 'state_created' (trigger-enforced). "LGA / equivalent jurisdiction"
  -- in other states uses these same levels with the honest status.
  constitutional_status TEXT
    CHECK (constitutional_status IN
      ('constitutional','state_created','customary','statistical')),
  geom                GEOMETRY(Geometry, 4326),    -- boundary / point / line
  centroid            GEOMETRY(Point, 4326),
  population          BIGINT,                     -- ONLY when sourced
  population_source_id UUID REFERENCES sources(id),
  -- State identity (§38-39): restrained, configurable, sourced — never hard-coded
  identity            JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- {flag_url, emblem_url, official_website,
  --  colors:{primary, secondary, map_accent},
  --  identity_source, identity_verified_at}
  -- Published view: cache of the latest authoritative claim (see claims).
  information_state information_state NOT NULL DEFAULT 'unknown',
  source_id           UUID REFERENCES sources(id),
  verified_by         TEXT,
  last_verified_at    TIMESTAMPTZ,
  effective_from      DATE,
  effective_to        DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (level, slug)
);
CREATE INDEX geo_entities_geom_idx    ON geo_entities USING GIST (geom);
CREATE INDEX geo_entities_parent_idx  ON geo_entities (parent_id);
CREATE INDEX geo_entities_name_trgm   ON geo_entities USING GIN (name gin_trgm_ops);

-- Legal parentage: country→state→{senatorial_district|lga→lcda}→ward→
-- community→street. Unknown future tiers fail closed. The LGA/LCDA
-- distinction is structural, never a naming convention.
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

  IF NEW.level = 'lcda' AND NEW.constitutional_status IS DISTINCT FROM 'state_created' THEN
    RAISE EXCEPTION 'civic: lcda entities must carry constitutional_status=state_created';
  END IF;
  IF NEW.level = 'lga' AND NEW.constitutional_status IS DISTINCT FROM 'constitutional' THEN
    RAISE EXCEPTION 'civic: lga entities must carry constitutional_status=constitutional';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER geo_parent_check
  BEFORE INSERT OR UPDATE OF parent_id, level, constitutional_status ON geo_entities
  FOR EACH ROW EXECUTE FUNCTION validate_geo_parent();

CREATE TABLE geo_aliases (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geo_entity_id  UUID NOT NULL REFERENCES geo_entities(id) ON DELETE CASCADE,
  alias          TEXT NOT NULL,
  source_id      UUID REFERENCES sources(id)
);
CREATE INDEX geo_aliases_trgm ON geo_aliases USING GIN (alias gin_trgm_ops);

-- Full hierarchy path per entity (powers GET /geo/:id/lineage).
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
SELECT id AS entity_id, level, name, path_ids, path_names, depth FROM path;

-- --------------------------------------------------------------------------
-- Institutions — structured government directory (§8, §13)
-- --------------------------------------------------------------------------
CREATE TABLE institutions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  short_name          TEXT,
  kind                TEXT NOT NULL, -- presidency | national_assembly | ministry |
                                     -- department | agency | state_executive |
                                     -- state_assembly | lga_council | police_command |
                                     -- health_authority | emergency_service | court | other
  parent_id           UUID REFERENCES institutions(id),
  geo_entity_id       UUID REFERENCES geo_entities(id), -- institutional home
  website             TEXT,
  contact             JSONB NOT NULL DEFAULT '{}'::jsonb,
  responsibilities    TEXT, -- sourced role description only; NULL if unsourced
  information_state information_state NOT NULL DEFAULT 'unknown',
  source_id           UUID REFERENCES sources(id),
  verified_by         TEXT,
  last_verified_at    TIMESTAMPTZ,
  effective_from      DATE,
  effective_to        DATE,
  is_current          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX institutions_geo_idx  ON institutions (geo_entity_id);
CREATE INDEX institutions_name_trgm ON institutions USING GIN (name gin_trgm_ops);

-- --------------------------------------------------------------------------
-- Officials + office holdings with historical versioning (§7)
-- NEVER delete a holding: insert a new row with term_status='previous'.
-- --------------------------------------------------------------------------
CREATE TABLE officials (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name          TEXT NOT NULL,
  photo_url          TEXT,
  photo_attribution  TEXT, -- source/licence; never a generated face passed off as real
  biography          TEXT, -- sourced only; NULL if unsourced
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX officials_name_trgm ON officials USING GIN (full_name gin_trgm_ops);

CREATE TABLE office_holdings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  official_id         UUID NOT NULL REFERENCES officials(id),
  institution_id      UUID REFERENCES institutions(id),
  title               TEXT NOT NULL,  -- e.g. Governor, Senator, Councillor
  geo_entity_id       UUID REFERENCES geo_entities(id), -- constituency / jurisdiction
  role_class          TEXT NOT NULL,  -- administrative | legislative | elected_local |
                                      -- agency | emergency | other  (§45: never collapsed
                                      -- into a generic "leader")
  appointment_type    TEXT,           -- elected | appointed | career
  term_start          DATE,
  term_end            DATE,
  term_status         term_status NOT NULL DEFAULT 'current',
  is_current          BOOLEAN NOT NULL DEFAULT TRUE,
  information_state information_state NOT NULL DEFAULT 'unknown',
  source_id           UUID REFERENCES sources(id),
  verified_by         TEXT,
  last_verified_at    TIMESTAMPTZ,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX office_holdings_official_idx ON office_holdings (official_id);
CREATE INDEX office_holdings_geo_idx      ON office_holdings (geo_entity_id);
CREATE INDEX office_holdings_current_idx  ON office_holdings (is_current) WHERE is_current;

-- --------------------------------------------------------------------------
-- Public offices — physical, discoverable by geography (§34)
-- --------------------------------------------------------------------------
CREATE TABLE public_offices (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id      UUID NOT NULL REFERENCES institutions(id),
  geo_entity_id       UUID REFERENCES geo_entities(id),
  name                TEXT NOT NULL,
  address_text        TEXT,
  geom                GEOMETRY(Point, 4326),
  phone               TEXT,
  email               TEXT,
  hours               TEXT,
  jurisdiction_note   TEXT,
  information_state information_state NOT NULL DEFAULT 'unknown',
  source_id           UUID REFERENCES sources(id),
  last_verified_at    TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX public_offices_geom_idx ON public_offices USING GIST (geom);

-- --------------------------------------------------------------------------
-- Social accounts — official vs fan/community always distinguished (§32)
-- --------------------------------------------------------------------------
CREATE TABLE social_accounts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type           TEXT NOT NULL, -- 'institution' | 'official'
  owner_id             UUID NOT NULL,
  platform             TEXT NOT NULL, -- x | facebook | instagram | threads | youtube | tiktok | linkedin
  handle               TEXT NOT NULL,
  url                  TEXT,
  is_official_verified BOOLEAN NOT NULL DEFAULT FALSE,
  information_state  information_state NOT NULL DEFAULT 'unknown',
  source_id            UUID REFERENCES sources(id),
  last_verified_at     TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (platform, handle)
);

-- --------------------------------------------------------------------------
-- Facilities: police (§9), health (§10), emergency (§11) — one spatial table
-- --------------------------------------------------------------------------
CREATE TABLE facilities (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  facility_type       TEXT NOT NULL, -- police_command | police_area_command |
                                     -- police_division | police_station | police_post |
                                     -- hospital | primary_health_centre |
                                     -- specialist_facility | emergency_service |
                                     -- ambulance_base | fire_service | other
  institution_id      UUID REFERENCES institutions(id), -- owning/command authority
  geo_entity_id       UUID REFERENCES geo_entities(id),
  geom                GEOMETRY(Point, 4326),
  address_text        TEXT,
  services            TEXT[], -- sourced service list
  contact             JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- {emergency_phone, phone, email}: official emergency numbers clearly
  -- distinguished from ordinary contact numbers
  is_emergency_channel BOOLEAN NOT NULL DEFAULT FALSE,
  jurisdiction_geom   GEOMETRY(Geometry, 4326), -- coverage area where known
  information_state information_state NOT NULL DEFAULT 'unknown',
  source_id           UUID REFERENCES sources(id),
  last_verified_at    TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX facilities_geom_idx ON facilities USING GIST (geom);
CREATE INDEX facilities_type_idx ON facilities (facility_type);

-- --------------------------------------------------------------------------
-- Roads + transport infrastructure (§12) — routed by responsible authority
-- --------------------------------------------------------------------------
CREATE TABLE roads (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                       TEXT NOT NULL,
  code                       TEXT,
  road_class                 TEXT NOT NULL, -- federal | state | local
  geom                       GEOMETRY(LineString, 4326),
  length_km                  NUMERIC,
  responsible_institution_id UUID REFERENCES institutions(id),
  status                     TEXT, -- sourced/observed only
  surface                    TEXT,
  information_state        information_state NOT NULL DEFAULT 'unknown',
  source_id                  UUID REFERENCES sources(id),
  last_verified_at           TIMESTAMPTZ,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX roads_geom_idx ON roads USING GIST (geom);

-- --------------------------------------------------------------------------
-- Sectors — configurable civic domains, never hard-coded (§35)
-- --------------------------------------------------------------------------
CREATE TABLE sectors (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  description   TEXT,
  report_categories JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{key,label,severity_default}]
  routing_rules JSONB NOT NULL DEFAULT '{}'::jsonb,     -- default routing hints
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------------
-- Citizen reporting (§18) + evidence integrity (§23) + anonymity (§24)
-- Allegations are NEVER presented as proven fact: status is explicit.
-- reports.status = handling workflow; information_state = epistemic state.
-- A new report is citizen_submitted until evidence says otherwise.
-- --------------------------------------------------------------------------
CREATE TABLE reports (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id               UUID REFERENCES sectors(id),
  category                TEXT NOT NULL,
  title                   TEXT NOT NULL,
  description             TEXT NOT NULL,
  geom                    GEOMETRY(Point, 4326) NOT NULL,
  geo_entity_id           UUID REFERENCES geo_entities(id),
  reporter_id             UUID, -- NULL when anonymous; public UI never exposes identity
  is_anonymous            BOOLEAN NOT NULL DEFAULT FALSE,
  status                  report_status NOT NULL DEFAULT 'reported',
  information_state       information_state NOT NULL DEFAULT 'citizen_submitted',
  severity                TEXT NOT NULL DEFAULT 'medium', -- low | medium | high | critical
  assigned_institution_id UUID REFERENCES institutions(id),
  evidence                JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- [{kind:photo|video|document, storage_ref, captured_at, has_location_consent, note}]
  resolution_note         TEXT,
  resolved_at             TIMESTAMPTZ,
  duplicate_of            UUID REFERENCES reports(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX reports_geom_idx   ON reports USING GIST (geom);
CREATE INDEX reports_status_idx ON reports (status);
CREATE INDEX reports_geo_idx    ON reports (geo_entity_id);

-- Every status change / authority response / moderation action, preserved.
CREATE TABLE report_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  actor_type  TEXT NOT NULL, -- citizen | authority | admin | system
  actor_id    UUID,
  event       TEXT NOT NULL, -- created | acknowledged | assigned | evidence_requested |
                             -- status_changed | resolved | reopened | escalated | moderated |
                             -- note (citizen follow-up: the ONLY event citizens may insert —
                             -- enforced by the report_events_intake RLS policy)
  note        TEXT,
  old_status  report_status,
  new_status  report_status,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX report_events_report_idx ON report_events (report_id, created_at);
COMMENT ON COLUMN report_events.event IS
  'created | acknowledged | assigned | evidence_requested | status_changed | resolved | reopened | escalated | moderated | note. note = citizen follow-up: the ONLY event citizens may insert (RLS report_events_intake).';

-- --------------------------------------------------------------------------
-- Escalation engine — configurable rules, evaluated on schedule (§20)
-- score_threshold/score_weights let vote/evidence-driven escalation be expressed
-- as DATA on a rule (weights tuned against real moderation policy), never as
-- hardcoded constants.
-- --------------------------------------------------------------------------
CREATE TABLE escalation_rules (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                        TEXT NOT NULL,
  sector_id                   UUID REFERENCES sectors(id),       -- NULL = all sectors
  geo_entity_id               UUID REFERENCES geo_entities(id),  -- NULL = national scope
  severity                    TEXT,                              -- NULL = all severities
  no_ack_hours                INT,
  no_action_hours             INT,
  repeat_report_threshold     INT, -- N similar reports in window triggers escalation
  repeat_report_window_hours  INT,
  score_threshold             INT,   -- escalate when computed score ≥ this (NULL = unused)
  score_weights               JSONB, -- e.g. {local_vote:1.5, external_vote:0.5, media_bonus:10}
  escalate_to_institution_id  UUID REFERENCES institutions(id),
  is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
  created_by                  UUID,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE escalations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id    UUID NOT NULL REFERENCES reports(id),
  rule_id      UUID REFERENCES escalation_rules(id),
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  state        TEXT NOT NULL DEFAULT 'open', -- open | acknowledged | closed
  notes        TEXT
);

-- --------------------------------------------------------------------------
-- Public projects (§28) — map-visible where geometry exists
-- Five-stage money trail: budgeted → released → awarded → paid (reported) →
-- independently verified. paid_value = CLAIMED; verified_expenditure_value =
-- confirmed. The UI may present ONLY the verified figure as confirmed spend.
-- --------------------------------------------------------------------------
CREATE TABLE projects (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                       TEXT NOT NULL,
  sector_id                  UUID REFERENCES sectors(id),
  geo_entity_id              UUID REFERENCES geo_entities(id),
  geom                       GEOMETRY(Geometry, 4326), -- project AOI: coordinates
  responsible_institution_id UUID REFERENCES institutions(id),
  contractor                 TEXT, -- only where verified/public
  budgeted_value             NUMERIC,
  released_value             NUMERIC,
  awarded_value              NUMERIC,
  paid_value                 NUMERIC, -- reported/claimed paid. NOT confirmed.
  verified_expenditure_value NUMERIC, -- independently verified expenditure ONLY
  currency                   TEXT NOT NULL DEFAULT 'NGN',
  contract_award_date        DATE,
  start_date                 DATE,
  expected_completion        DATE,
  status                     TEXT NOT NULL DEFAULT 'unknown', -- planned | ongoing |
                                                             -- completed | abandoned | unknown
  documents                  JSONB NOT NULL DEFAULT '[]'::jsonb, -- source docs w/ urls
  information_state        information_state NOT NULL DEFAULT 'unknown',
  source_id                  UUID REFERENCES sources(id),
  last_verified_at           TIMESTAMPTZ,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX projects_geom_idx ON projects USING GIST (geom);
CREATE INDEX projects_name_trgm ON projects USING GIN (name gin_trgm_ops);

-- --------------------------------------------------------------------------
-- Public finance — money trail (§26-27)
-- budgeted / released / awarded / paid / verified are DISTINCT columns.
-- Never infer expenditure from budget.
-- --------------------------------------------------------------------------
CREATE TABLE budget_lines (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year         INT NOT NULL,
  institution_id      UUID REFERENCES institutions(id),
  geo_entity_id       UUID REFERENCES geo_entities(id),
  category            TEXT NOT NULL,
  budgeted            NUMERIC,
  released            NUMERIC,
  awarded             NUMERIC,
  spent               NUMERIC, -- reported/claimed spend — only where sourced
  verified_spent      NUMERIC, -- independently verified expenditure ONLY
  currency            TEXT NOT NULL DEFAULT 'NGN',
  document_url        TEXT,
  document_ref        TEXT,
  information_state information_state NOT NULL DEFAULT 'unknown',
  source_id           UUID REFERENCES sources(id),
  last_verified_at    TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX budget_lines_year_idx ON budget_lines (fiscal_year, geo_entity_id);

-- --------------------------------------------------------------------------
-- Legislative tracker (§29) — a bill is NEVER shown as law until verified
-- --------------------------------------------------------------------------
CREATE TABLE legislative_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title               TEXT NOT NULL,
  bill_number         TEXT,
  chamber             TEXT, -- senate | house | state_assembly | ...
  sponsor_official_id UUID REFERENCES officials(id),
  stage               TEXT,
  status              TEXT NOT NULL DEFAULT 'bill', -- bill | law
  stages              JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{stage, date, note}]
  official_document_url TEXT,
  geo_entity_id       UUID REFERENCES geo_entities(id), -- affected geography
  subject             TEXT,
  information_state information_state NOT NULL DEFAULT 'unknown',
  source_id           UUID REFERENCES sources(id),
  last_verified_at    TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX legislative_items_title_trgm ON legislative_items USING GIN (title gin_trgm_ops);

-- --------------------------------------------------------------------------
-- News engine (§30) + daily civic briefs (§31)
-- AI summaries link back to sources and introduce no unsupported claims.
-- --------------------------------------------------------------------------
CREATE TABLE news_items (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                TEXT NOT NULL,
  summary              TEXT,
  item_type            TEXT NOT NULL, -- official_announcement | independent_reporting |
                                      -- analysis | citizen_report
  source_id            UUID REFERENCES sources(id),
  source_url           TEXT,
  published_at         TIMESTAMPTZ,
  geo_entity_id        UUID REFERENCES geo_entities(id),
  ai_generated_summary BOOLEAN NOT NULL DEFAULT FALSE,
  information_state  information_state NOT NULL DEFAULT 'unknown',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX news_items_geo_time_idx ON news_items (geo_entity_id, published_at DESC);

CREATE TABLE civic_briefs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_date    DATE NOT NULL,
  geo_entity_id UUID REFERENCES geo_entities(id), -- NULL = national brief
  content_md    TEXT NOT NULL,
  source_links  JSONB NOT NULL DEFAULT '[]'::jsonb,
  generated_by  TEXT NOT NULL DEFAULT 'ai', -- ai | human | ai_assisted
  reviewed_by   UUID,
  reviewed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (brief_date, geo_entity_id)
);

-- --------------------------------------------------------------------------
-- Claims — the canonical provenance layer (Phase 1)
--
-- THE DISTINCTION:
--   Entity  = the thing itself (tables above). Identity + geometry.
--   Claim   = one assertion about one entity (this table). CANONICAL TRUTH.
--   Source  = identifiable evidence, via claim_sources (many-to-many).
--   State   = information_state on the claim.
--   History = claim_events (append-only) + superseded_by links.
--
-- Verification lifecycle:
--   unknown → citizen_submitted | source_backed
--   citizen_submitted → source_backed | disputed | rejected
--   source_backed → verified | disputed | rejected | outdated
--   verified → disputed | outdated
--   disputed → verified | source_backed | rejected
--   outdated → source_backed | verified
--   rejected → (terminal; supersede with a new claim, never revive)
--
-- A claim enters `verified` ONLY IF: (a) ≥1 claim_sources row with
-- source_role='primary_evidence'; (b) a claim_events row event='verified' by
-- actor_type ∈ {verifier,admin,authority} in the same operation; (c) AI-origin
-- claims additionally satisfy (a)+(b) independently; (d) `confidence` is
-- metadata and is never consulted.
-- --------------------------------------------------------------------------
CREATE TABLE claims (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type       TEXT NOT NULL,
  entity_id         UUID NOT NULL,
  claim_key         TEXT NOT NULL,
  claim_value       JSONB NOT NULL,
  ingest_channel    ingest_channel NOT NULL,
  information_state information_state NOT NULL DEFAULT 'unknown',
  confidence        NUMERIC
    CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  effective_from    DATE,
  effective_to      DATE,
  superseded_by     UUID REFERENCES claims(id),
  created_by        UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX claims_entity_key_idx ON claims (entity_type, entity_id, claim_key);
CREATE INDEX claims_state_idx      ON claims (information_state);
CREATE INDEX claims_value_gin      ON claims USING GIN (claim_value);

CREATE TABLE claim_sources (
  claim_id    UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  source_id   UUID NOT NULL REFERENCES sources(id),
  source_role TEXT NOT NULL
    CHECK (source_role IN ('primary_evidence','corroborating','contradicting')),
  note        TEXT,
  PRIMARY KEY (claim_id, source_id)
);
CREATE INDEX claim_sources_source_idx ON claim_sources (source_id);

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
  evidence_ref JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX claim_events_claim_idx ON claim_events (claim_id, created_at);

-- --------------------------------------------------------------------------
-- Universal ingestion — correction / change requests (§36), generalized
-- Every future source enters here. Approval CREATES CLAIMS (citizen_submitted
-- or source_backed — never verified) and records their IDs. It NEVER writes
-- entity attributes directly.
-- --------------------------------------------------------------------------
CREATE TABLE change_requests (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type        TEXT NOT NULL, -- geo_entity | institution | official | facility | ...
  entity_id          UUID NOT NULL,
  proposed_changes   JSONB NOT NULL, -- legacy shape; prefer proposed_claims
  proposed_claims    JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- [{entity_type, entity_id, claim_key, claim_value}] — assertions to stage
  reason             TEXT NOT NULL,
  evidence           JSONB NOT NULL DEFAULT '[]'::jsonb,
  ingest_channel     ingest_channel NOT NULL DEFAULT 'citizen_portal',
  source_id          UUID REFERENCES sources(id), -- identifiable source, when one exists
  requester_id       UUID,
  requester_type     TEXT NOT NULL DEFAULT 'citizen', -- citizen | institution | admin | system
  status             ingest_status NOT NULL DEFAULT 'submitted',
  resulting_claim_ids UUID[] NOT NULL DEFAULT '{}', -- claims.id created on approval
  reviewer_id        UUID,
  reviewed_at        TIMESTAMPTZ,
  resolution_note    TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX change_requests_entity_idx ON change_requests (entity_type, entity_id, status);

-- --------------------------------------------------------------------------
-- Audit trail — immutable record of important civic data changes (§37)
-- --------------------------------------------------------------------------
CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id   UUID NOT NULL,
  actor_type  TEXT NOT NULL, -- citizen | authority | verifier | admin | system
  actor_id    UUID,
  action      TEXT NOT NULL, -- create | update | archive | verify | dispute | restore
  old_value   JSONB,
  new_value   JSONB,
  reason      TEXT,
  source_id   UUID REFERENCES sources(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_entity_idx ON audit_log (entity_type, entity_id, created_at DESC);

-- --------------------------------------------------------------------------
-- Users, roles, institutional claims (§22)
-- Verified institutional accounts are clearly distinguished from ordinary users.
-- --------------------------------------------------------------------------
CREATE TABLE users (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name            TEXT,
  role                    TEXT NOT NULL DEFAULT 'citizen', -- citizen | verifier | admin | authority
  institution_id          UUID REFERENCES institutions(id), -- for authority users
  is_institution_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE institution_claims (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id),
  user_id        UUID NOT NULL REFERENCES users(id),
  evidence       JSONB NOT NULL DEFAULT '[]'::jsonb,
  status         TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  reviewer_id    UUID,
  reviewed_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Link anonymous reporters to users without exposing identity publicly:
-- reports.reporter_id → users.id (kept internal; public API never joins it out).

-- --------------------------------------------------------------------------
-- Global civic search (§16) — results carry geographic + institutional context
-- Refresh on schedule: REFRESH MATERIALIZED VIEW CONCURRENTLY search_index;
-- --------------------------------------------------------------------------
CREATE MATERIALIZED VIEW search_index AS
SELECT 'geo'::text AS entity_type, g.id AS entity_id,
       g.name AS title, initcap(g.level::text) AS subtitle,
       COALESCE(p.name,'Nigeria') AS geo_context,
       (setweight(to_tsvector('english', g.name), 'A') ||
        setweight(to_tsvector('english', COALESCE(p.name,'')), 'C')) AS document
FROM geo_entities g LEFT JOIN geo_entities p ON p.id = g.parent_id
UNION ALL
SELECT 'institution', i.id, i.name, i.kind,
       COALESCE(g.name,''),
       (setweight(to_tsvector('english', i.name), 'A') ||
        setweight(to_tsvector('english', COALESCE(i.short_name,'')), 'B'))
FROM institutions i LEFT JOIN geo_entities g ON g.id = i.geo_entity_id
UNION ALL
SELECT 'official', o.id, o.full_name, h.title,
       COALESCE(g.name,''),
       (setweight(to_tsvector('english', o.full_name), 'A') ||
        setweight(to_tsvector('english', COALESCE(h.title,'')), 'B'))
FROM officials o JOIN office_holdings h ON h.official_id = o.id AND h.is_current
                 LEFT JOIN geo_entities g ON g.id = h.geo_entity_id
UNION ALL
SELECT 'facility', f.id, f.name, f.facility_type, COALESCE(g.name,''),
       setweight(to_tsvector('english', f.name), 'A')
FROM facilities f LEFT JOIN geo_entities g ON g.id = f.geo_entity_id
UNION ALL
SELECT 'project', pr.id, pr.name, pr.status, COALESCE(g.name,''),
       setweight(to_tsvector('english', pr.name), 'A')
FROM projects pr LEFT JOIN geo_entities g ON g.id = pr.geo_entity_id
UNION ALL
SELECT 'legislation', l.id, l.title, l.status, COALESCE(g.name,''),
       (setweight(to_tsvector('english', l.title), 'A') ||
        setweight(to_tsvector('english', COALESCE(l.bill_number,'')), 'B'))
FROM legislative_items l LEFT JOIN geo_entities g ON g.id = l.geo_entity_id;
CREATE UNIQUE INDEX search_index_uidx ON search_index (entity_type, entity_id);
CREATE INDEX search_index_doc_idx ON search_index USING GIN (document);

-- --------------------------------------------------------------------------
-- Row Level Security — mirrors db/migrations/0003_rls_policies.sql
-- Public read by design; authority writes via service_role only; citizens may
-- INSERT into intake tables (change_requests, reports, report_events) but never
-- publish. claim_events is append-only for every interactive role.
-- --------------------------------------------------------------------------
DO $$ BEGIN
  CREATE ROLE anon NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE ROLE authenticated NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE ROLE service_role NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

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

CREATE POLICY change_requests_intake ON change_requests
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    reason <> '' AND
    jsonb_typeof(proposed_claims) = 'array' AND
    status = 'submitted'::ingest_status AND
    resulting_claim_ids = '{}'::uuid[]
  );

CREATE POLICY reports_intake ON reports
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    title <> '' AND description <> '' AND geom IS NOT NULL
    AND status = 'reported'::report_status
    AND information_state = 'citizen_submitted'::information_state
  );

CREATE POLICY report_events_intake ON report_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    actor_type = 'citizen' AND
    event = 'note' AND
    old_status IS NULL AND
    new_status IS NULL
  );

CREATE POLICY users_self_read ON users
  FOR SELECT TO authenticated
  USING (id = NULLIF(current_setting('app.user_id', true), '')::uuid);
CREATE POLICY users_self_update ON users
  FOR UPDATE TO authenticated
  USING (id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (id = NULLIF(current_setting('app.user_id', true), '')::uuid);

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
GRANT SELECT ON search_index TO anon, authenticated;

-- ============================================================================
-- v0.4 — Phase 3: citizen evidence & reporting (migration 0005).
-- ============================================================================

-- reports: observation time, honest location, workflow documentation.
ALTER TABLE reports ADD COLUMN observed_at TIMESTAMPTZ;
COMMENT ON COLUMN reports.observed_at IS
  'When the citizen says the observed condition held. NULL = not stated — never guessed. Distinct from created_at (submission time).';
ALTER TABLE reports ALTER COLUMN geom DROP NOT NULL;
ALTER TABLE reports ADD COLUMN location_status TEXT NOT NULL DEFAULT 'unavailable'
  CHECK (location_status IN ('provided','unavailable','imprecise'));
ALTER TABLE reports ADD CONSTRAINT reports_location_honesty
  CHECK (
    (geom IS NULL AND location_status = 'unavailable') OR
    (geom IS NOT NULL AND location_status IN ('provided','imprecise'))
  );
COMMENT ON COLUMN reports.location_status IS
  'provided | unavailable | imprecise. DB-enforced: geom IS NULL ⟺ unavailable. The UI must render each value honestly and never invent a point.';
COMMENT ON TABLE reports IS
  'Citizen observations. TWO AXES, NEVER MERGED: status = HANDLING WORKFLOW (reported → under_review → verified|rejected|duplicate → in_progress → resolved); information_state = EPISTEMIC state (the 7-state canon, default citizen_submitted). A report with status=verified is an ACCEPTED SUBMISSION, not a verified fact. Claims originating from reports enter via ingest_channel=citizen_portal at citizen_submitted/source_backed — never verified (see claims_citizen_gate trigger).';
COMMENT ON COLUMN reports.status IS
  'Handling workflow. verified = "accepted as a legitimate citizen submission" — NOT factual verification. User-facing wording: "Submission accepted".';
COMMENT ON COLUMN reports.evidence IS
  'LEGACY intake blob. Superseded by the report_evidence table (migration 0005). Retained for backward compatibility; new writes go to report_evidence.';

-- report_evidence — proper evidence representation.
CREATE TABLE report_evidence (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id     UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  evidence_type TEXT NOT NULL
    CHECK (evidence_type IN
      ('photo','video','document','audio','location_pin','metadata_only')),
  storage_ref   TEXT NOT NULL CHECK (storage_ref <> ''),
  original_filename TEXT,
  mime_type     TEXT,
  byte_size     BIGINT CHECK (byte_size IS NULL OR byte_size >= 0),
  captured_at   TIMESTAMPTZ,
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  has_location  BOOLEAN NOT NULL DEFAULT FALSE,
  captured_geom GEOMETRY(Point, 4326),
  is_original   BOOLEAN NOT NULL DEFAULT TRUE,
  metadata      JSONB NOT NULL DEFAULT '{}',
  review_state  TEXT NOT NULL DEFAULT 'pending'
    CHECK (review_state IN ('pending','accepted','rejected')),
  submitted_by  UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX report_evidence_report_idx ON report_evidence (report_id);
CREATE INDEX report_evidence_review_idx ON report_evidence (review_state);
COMMENT ON TABLE report_evidence IS
  'Material supporting a report. Receiving a photograph proves nothing: review_state=accepted means a moderator judged the material relevant and intact — it is NOT claim verification.';

-- report_claims — explicit Claim → Report provenance.
CREATE TABLE report_claims (
  report_id    UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  claim_id     UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL DEFAULT 'originated_from'
    CHECK (relationship IN ('originated_from','supports','contradicts')),
  created_by   UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (report_id, claim_id)
);
CREATE INDEX report_claims_claim_idx ON report_claims (claim_id);
COMMENT ON TABLE report_claims IS
  'Explicit M:N provenance: which claims came from / are supported or contradicted by which reports. Answers "Where did this claim come from?" without embedding the report inside the claim.';

-- report_intake_log — operational rate limiting ONLY.
CREATE TABLE report_intake_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID,
  fingerprint TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX report_intake_log_fp_time_idx
  ON report_intake_log (fingerprint, created_at);
COMMENT ON TABLE report_intake_log IS
  'OPERATIONAL ABUSE CONTROL ONLY: intake rate limiting and duplicate/abuse triage. Minimum data. NOT a behavioral-tracking system: no citizen scoring, no ranking, no profiling. Retention: rows older than 90 days may be purged by the service_role maintenance job; aggregates for abuse triage only.';

-- Defense in depth — citizen_portal claims can never be born `verified`.
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

-- RLS for the new tables (mirrors the 0003 contract).
ALTER TABLE report_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_claims   ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_intake_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY report_evidence_pub_read ON report_evidence
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY report_claims_pub_read ON report_claims
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY report_evidence_intake ON report_evidence
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    storage_ref <> '' AND
    evidence_type IN
      ('photo','video','document','audio','location_pin','metadata_only') AND
    review_state = 'pending'
  );
-- report_claims: no citizen write policy (moderator/service only).
-- report_intake_log: no anon/authenticated policy (default deny).

-- The ONE deliberate change to an existing intake policy: honest no-location
-- reports. All 0004 pins preserved.
DROP POLICY IF EXISTS reports_intake ON reports;
CREATE POLICY reports_intake ON reports
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    title <> '' AND description <> '' AND
    status = 'reported'::report_status AND
    information_state = 'citizen_submitted'::information_state
  );

GRANT SELECT ON report_evidence, report_claims TO anon, authenticated;
GRANT INSERT ON report_evidence TO anon, authenticated;
GRANT ALL ON report_evidence, report_claims, report_intake_log TO service_role;

-- ============================================================================
-- END v0.4 — Phase 3 citizen evidence & reporting (0005).
-- ============================================================================
