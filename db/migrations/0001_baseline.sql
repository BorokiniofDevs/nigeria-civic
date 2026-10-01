-- ============================================================================
-- MIGRATION 0001 — Baseline (v0.1), verbatim.
-- Nigeria Civic Intelligence Platform — Core Data Model (v0.1)
-- PostgreSQL + PostGIS. Every civic fact carries source + verification metadata.
-- History is preserved: supersede, never destructively overwrite.
-- SRID 4326 (WGS84) throughout.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()

-- --------------------------------------------------------------------------
-- Enumerations
-- --------------------------------------------------------------------------
CREATE TYPE geo_level AS ENUM (
  'country', 'state', 'lga', 'lcda', 'ward', 'community', 'street'
);

CREATE TYPE verification_status AS ENUM (
  'unverified', 'pending', 'verified', 'disputed', 'stale', 'rejected'
);

CREATE TYPE source_type AS ENUM (
  'official_government',    -- govt portals, MDAs: authoritative for institutional facts
  'gazette_legislation',    -- gazettes, laws, public records
  'official_social',        -- verified institutional social accounts
  'reputable_third_party',  -- reputable media/research: enrichment + cross-checking
  'geo_service',            -- maps/geographic enrichment ONLY (never office-holders)
  'citizen_evidence',       -- citizen-submitted ground evidence
  'ai_generated'            -- AI extraction/summary: always labelled, never authoritative
);

CREATE TYPE report_status AS ENUM (
  'reported', 'under_review', 'verified', 'in_progress', 'resolved', 'rejected', 'duplicate'
);

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
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------------
-- Geographic hierarchy: Nigeria → State → LGA → LCDA → Ward → Community → Street (§2)
-- --------------------------------------------------------------------------
CREATE TABLE geo_entities (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id           UUID REFERENCES geo_entities(id),
  level               geo_level NOT NULL,
  name                TEXT NOT NULL,
  slug                TEXT NOT NULL,
  code                TEXT,                       -- official code where one exists
  geom                GEOMETRY(Geometry, 4326),    -- boundary / point / line
  centroid            GEOMETRY(Point, 4326),
  population          BIGINT,                     -- ONLY when sourced
  population_source_id UUID REFERENCES sources(id),
  -- State identity (§38-39): restrained, configurable, sourced — never hard-coded
  identity            JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- {flag_url, emblem_url, official_website,
  --  colors:{primary, secondary, map_accent},
  --  identity_source, identity_verified_at}
  verification_status verification_status NOT NULL DEFAULT 'unverified',
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

CREATE TABLE geo_aliases (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geo_entity_id  UUID NOT NULL REFERENCES geo_entities(id) ON DELETE CASCADE,
  alias          TEXT NOT NULL,
  source_id      UUID REFERENCES sources(id)
);
CREATE INDEX geo_aliases_trgm ON geo_aliases USING GIN (alias gin_trgm_ops);

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
  verification_status verification_status NOT NULL DEFAULT 'unverified',
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
  verification_status verification_status NOT NULL DEFAULT 'unverified',
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
  verification_status verification_status NOT NULL DEFAULT 'unverified',
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
  verification_status  verification_status NOT NULL DEFAULT 'unverified',
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
  verification_status verification_status NOT NULL DEFAULT 'unverified',
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
  verification_status        verification_status NOT NULL DEFAULT 'unverified',
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
                             -- status_changed | resolved | reopened | escalated | moderated
  note        TEXT,
  old_status  report_status,
  new_status  report_status,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX report_events_report_idx ON report_events (report_id, created_at);

-- --------------------------------------------------------------------------
-- Escalation engine — configurable rules, evaluated on schedule (§20)
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
-- --------------------------------------------------------------------------
CREATE TABLE projects (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                       TEXT NOT NULL,
  sector_id                  UUID REFERENCES sectors(id),
  geo_entity_id              UUID REFERENCES geo_entities(id),
  geom                       GEOMETRY(Geometry, 4326),
  responsible_institution_id UUID REFERENCES institutions(id),
  contractor                 TEXT, -- only where verified/public
  budgeted_value             NUMERIC,
  released_value             NUMERIC,
  paid_value                 NUMERIC, -- independently verified expenditure only
  currency                   TEXT NOT NULL DEFAULT 'NGN',
  contract_award_date        DATE,
  start_date                 DATE,
  expected_completion        DATE,
  status                     TEXT NOT NULL DEFAULT 'unknown', -- planned | ongoing |
                                                             -- completed | abandoned | unknown
  documents                  JSONB NOT NULL DEFAULT '[]'::jsonb, -- source docs w/ urls
  verification_status        verification_status NOT NULL DEFAULT 'unverified',
  source_id                  UUID REFERENCES sources(id),
  last_verified_at           TIMESTAMPTZ,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX projects_geom_idx ON projects USING GIST (geom);
CREATE INDEX projects_name_trgm ON projects USING GIN (name gin_trgm_ops);

-- --------------------------------------------------------------------------
-- Public finance — money trail (§26-27)
-- budgeted / released / spent are DISTINCT. Never infer expenditure from budget.
-- --------------------------------------------------------------------------
CREATE TABLE budget_lines (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year         INT NOT NULL,
  institution_id      UUID REFERENCES institutions(id),
  geo_entity_id       UUID REFERENCES geo_entities(id),
  category            TEXT NOT NULL,
  budgeted            NUMERIC,
  released            NUMERIC,
  spent               NUMERIC, -- only where a source supports it
  currency            TEXT NOT NULL DEFAULT 'NGN',
  document_url        TEXT,
  document_ref        TEXT,
  verification_status verification_status NOT NULL DEFAULT 'unverified',
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
  verification_status verification_status NOT NULL DEFAULT 'unverified',
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
  verification_status  verification_status NOT NULL DEFAULT 'unverified',
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
-- Correction / change requests (§36)
-- --------------------------------------------------------------------------
CREATE TABLE change_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type      TEXT NOT NULL, -- geo_entity | institution | official | facility | ...
  entity_id        UUID NOT NULL,
  proposed_changes JSONB NOT NULL,
  reason           TEXT NOT NULL,
  evidence         JSONB NOT NULL DEFAULT '[]'::jsonb,
  requester_id     UUID,
  requester_type   TEXT NOT NULL DEFAULT 'citizen', -- citizen | institution | admin
  status           TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  reviewer_id      UUID,
  reviewed_at      TIMESTAMPTZ,
  resolution_note  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
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

-- ============================================================================
-- END v0.1 — migrations, RLS policies and seed manifests arrive in Phase 1.
-- ============================================================================
