-- 0009_projects.sql — Projects directory (Lagos pilot).
--
-- Civic OS rules mirrored from the client service (lib/civic/projectService.ts):
--   1. The project entity ≠ claims about it ≠ sources supporting the claims.
--   2. information_state is never a bare boolean; seed claims are
--      'source_backed', NEVER 'verified'. Verification requires the
--      staging/change-request process.
--   3. Locations are corridor-level approximations unless a surveyed point is
--      sourced; coordinate_precision is explicit on every row.
--   4. New information enters via staging (project_claims with
--      information_state='citizen_submitted' or 'unknown'), never directly
--      as public truth.
--
-- Depends on: 0002 (information_state enum), 0007/0008 (officials, unrelated but ordered).

BEGIN;

-- The project itself: a named undertaking in a jurisdiction.
CREATE TABLE IF NOT EXISTS projects (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  sector            TEXT NOT NULL CHECK (sector IN ('rail','road','water','power','housing','health','education','other')),
  jurisdiction_id   TEXT NOT NULL,
  approx_lat        DOUBLE PRECISION NOT NULL,
  approx_lng        DOUBLE PRECISION NOT NULL,
  coordinate_precision TEXT NOT NULL DEFAULT 'approximate'
    CHECK (coordinate_precision IN ('approximate','precise')),
  location_note     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One assertion about one project (status, budget, contractor, ...).
CREATE TABLE IF NOT EXISTS project_claims (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  claim_type        TEXT NOT NULL,
  claim_text        TEXT NOT NULL,
  information_state information_state NOT NULL DEFAULT 'source_backed',
  valid_from        DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_claims_project_idx ON project_claims (project_id);
CREATE INDEX IF NOT EXISTS project_claims_state_idx ON project_claims (information_state);

-- Identifiable evidence supporting a project's claims.
CREATE TABLE IF NOT EXISTS project_sources (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_name       TEXT NOT NULL,
  source_url        TEXT NOT NULL,
  checked_at        DATE NOT NULL,
  note              TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_sources_project_idx ON project_sources (project_id);

-- RLS: public read; writes go through the service role / staging process.
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS projects_public_read ON projects;
CREATE POLICY projects_public_read ON projects FOR SELECT USING (true);
DROP POLICY IF EXISTS project_claims_public_read ON project_claims;
CREATE POLICY project_claims_public_read ON project_claims FOR SELECT USING (true);
DROP POLICY IF EXISTS project_sources_public_read ON project_sources;
CREATE POLICY project_sources_public_read ON project_sources FOR SELECT USING (true);

-- Seed honesty gate: no seeded claim may be born 'verified'.
-- (Enforced here for the seed batch; the staging process enforces it generally.)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM project_claims
    WHERE information_state = 'verified'
      AND id LIKE 'seed-%'
  ) THEN
    RAISE EXCEPTION 'seed claims must never be verified';
  END IF;
END $$;

-- ---------------------------------------------------------------- seeds ---
-- All seeds: information_state = 'source_backed', coordinates approximate.

INSERT INTO projects (id, name, sector, jurisdiction_id, approx_lat, approx_lng,
                      coordinate_precision, location_note)
VALUES
  ('lagos-blue-line-phase-2',
   'Lagos Blue Line Rail — Phase 2 (Mile 2 → Okokomaiko)',
   'rail', 'geo:state:NGA.25_1', 6.46, 3.25, 'approximate',
   'Approximate corridor midpoint (Mile 2–Okokomaiko) for viewing; not a surveyed point.'),
  ('lagos-red-line-phase-2',
   'Lagos Red Line Rail — Phase 2 (Oyingbo → National Theatre)',
   'rail', 'geo:state:NGA.25_1', 6.49, 3.39, 'approximate',
   'Approximate corridor midpoint (Oyingbo–National Theatre, Iganmu) for viewing; not a surveyed point.'),
  ('lekki-epe-expressway-rehab',
   'Lekki–Epe Expressway rehabilitation (Admiralty → Jubilee Bridge)',
   'road', 'geo:state:NGA.25_1', 6.45, 3.51, 'approximate',
   'Approximate midpoint of the ~20 km Admiralty–Jubilee Bridge rehabilitation stretch; not a surveyed point.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO project_claims (id, project_id, claim_type, claim_text, information_state, valid_from)
VALUES
  ('seed-blue2-status', 'lagos-blue-line-phase-2', 'status',
   'Under construction: track construction, station development and power installation reported ongoing (Commissioner for Transportation, May 2026).',
   'source_backed', '2026-05-01'),
  ('seed-red2-status', 'lagos-red-line-phase-2', 'status',
   'Under construction: LAMATA–CCECC Phase 2 agreement signed Feb 2024; 2026 reporting describes Phase 2 works toward the Blue Line interchange. Exact endpoint and pace not independently verified.',
   'source_backed', '2024-02-01'),
  ('seed-lekki-status', 'lekki-epe-expressway-rehab', 'status',
   'Under construction: phased rehabilitation began 25 Jan 2026 across ~20 km; several sections reported complete Feb–Mar 2026, remaining works described as ongoing.',
   'source_backed', '2026-01-25')
ON CONFLICT (id) DO NOTHING;

INSERT INTO project_sources (id, project_id, source_name, source_url, checked_at, note)
VALUES
  ('seed-blue2-src1', 'lagos-blue-line-phase-2',
   'The Nation — Lagos records major gains in road, rail, water transport',
   'https://thenationonlineng.net/lagos-records-major-gains-in-road-rail-water-transport-commissioner/',
   '2026-09-30', 'Commissioner: Phase 2 Mile 2→Okokomaiko; track, stations, power works ongoing.'),
  ('seed-blue2-src2', 'lagos-blue-line-phase-2',
   'Heinrich Böll Stiftung — Moving Lagos: The Blue Line and the Future of Mass Transit',
   'https://ng.boell.org/sites/default/files/2025-03/moving-lagos_the-blue-line-and-the-future-of-mass-transit.pdf',
   '2026-09-30', 'LAMATA interviews; Phase 2 targeted 2026, financing unclear.'),
  ('seed-red2-src1', 'lagos-red-line-phase-2',
   'Nairametrics — Sanwo-Olu confirms plans to extend Red Line rail',
   'https://nairametrics.com/2026/04/23/sanwo-olu-confirms-plans-to-extend-red-line-rail-into-ogun-state/',
   '2026-09-30', 'Phase 1 Oyingbo–Agbado; Phase 2 under construction toward Marina/Blue Line interchange.'),
  ('seed-red2-src2', 'lagos-red-line-phase-2',
   'The Nation — Triumph of vision',
   'https://thenationonlineng.net/triumph-of-vision/',
   '2026-09-30', 'Contract signed for Red Line Phase 2: Oyingbo to National Theatre (Iganmu).'),
  ('seed-lekki-src1', 'lekki-epe-expressway-rehab',
   'Nairametrics — Lekki–Ajah carriageway rehabilitation works',
   'https://nairametrics.com/2026/02/27/lagos-to-close-epe-bound-lekki-ajah-carriageway-for-rehabilitation-works/',
   '2026-09-30', 'Works began 25 Jan 2026, planned 64 days across ~20 km Admiralty→Jubilee Bridge.'),
  ('seed-lekki-src2', 'lekki-epe-expressway-rehab',
   'Nairametrics — Chevron–Admiralty stretch completed',
   'https://nairametrics.com/2026/02/25/lagos-completes-rehabilitation-of-chevron-admiralty-stretch-of-lekki-ajah-road/',
   '2026-09-30', 'Chevron–Chisco sections (4.51 km) completed.')
ON CONFLICT (id) DO NOTHING;

COMMIT;
