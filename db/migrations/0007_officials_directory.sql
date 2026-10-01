-- ============================================================================
-- MIGRATION 0007 — Officials directory (government office-holders)
--
-- The office ≠ the holder. `offices` describes enduring offices (the thing);
-- `office_holders` records tenures (claims about who holds the office, when,
-- on whose authority). Every holder record carries its own provenance and
-- information_state — never a bare is_verified boolean.
--
-- EPISTEMIC RULES (mirrors the Civic OS provenance gate):
--   1. Seed holder records enter as `source_backed` — NEVER `verified`.
--      `verified` requires the staging/change-request process with
--      identifiable source evidence and an explicit verification event.
--   2. `term_end IS NULL AND is_incumbent` = in office as of
--      `source_checked_at`. The UI must render "as of <date>", never imply
--      live knowledge.
--   3. No photographs, biographies, or remuneration figures enter without a
--      sourced ingestion record. This migration seeds names + offices +
--      terms only.
--   4. Constitutional LGAs / state-created LCDAs remain structurally
--      distinct; offices below federal tier link to `jurisdiction_id`
--      (`geo:…` stable ids) when that tier is seeded.
--
-- RLS: public read (civic directory), writes are service_role only.
-- No fabricated data: every seed row cites the public source it came from.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. offices — the enduring office
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS offices (
  id                 TEXT PRIMARY KEY,  -- 'office:president-frn'
  title              TEXT NOT NULL,     -- 'President of the Federal Republic of Nigeria'
  tier               TEXT NOT NULL CHECK (tier IN ('federal','state','lga','lcda','ward','community')),
  arm                TEXT NOT NULL CHECK (arm IN ('executive','legislative','judiciary','traditional','other')),
  jurisdiction_id    TEXT,              -- 'geo:…' stable id; NULL for federal offices
  constitutional_basis TEXT,           -- e.g. 'Constitution of the FRN 1999 (as amended), s.130'
  sort_order         INT  NOT NULL DEFAULT 100,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE offices IS
  'Enduring government offices. The office is the entity; office_holders records who holds it and when. Seeded federal tier only in this migration.';

-- --------------------------------------------------------------------------
-- 2. office_holders — tenures (who, when, on whose authority)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS office_holders (
  id                 TEXT PRIMARY KEY,
  office_id          TEXT NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  person_name        TEXT NOT NULL,
  term_start         DATE,              -- NULL = not stated, never guessed
  term_end           DATE,              -- NULL + is_incumbent = currently in office as of source_checked_at
  is_incumbent       BOOLEAN NOT NULL DEFAULT TRUE,
  appointment_method TEXT,             -- 'general_election' | 'legislative_election' | 'presidential_appointment' | NULL
  party_affiliation  TEXT,              -- as reported by the source; NULL = not stated
  information_state  information_state NOT NULL DEFAULT 'source_backed',
  source_label       TEXT NOT NULL,     -- human-readable, e.g. 'OSGF official appellation statement, May 2026'
  source_url         TEXT,              -- the public page the record was read from
  source_checked_at  TIMESTAMPTZ,       -- when the source was last read
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE office_holders IS
  'Tenures: claims that a person holds/held an office. TWO AXES never merged: the office is the entity, the tenure is the claim. Seed rows are source_backed, never verified — verification requires the staging/change-request process.';

-- Honesty invariant: a finished tenure must have an end date; an incumbent
-- must not have one.
DO $$ BEGIN
  ALTER TABLE office_holders ADD CONSTRAINT office_holders_tenure_honesty
    CHECK ((is_incumbent AND term_end IS NULL) OR (NOT is_incumbent AND term_end IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- One incumbent per office at a time.
CREATE UNIQUE INDEX IF NOT EXISTS office_holders_one_incumbent
  ON office_holders (office_id) WHERE is_incumbent;

CREATE INDEX IF NOT EXISTS office_holders_office_idx ON office_holders (office_id);
CREATE INDEX IF NOT EXISTS office_holders_state_idx ON office_holders (information_state);

-- --------------------------------------------------------------------------
-- 3. RLS — public directory read; writes are service_role only
-- --------------------------------------------------------------------------
ALTER TABLE offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE office_holders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY offices_public_read ON offices FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY office_holders_public_read ON office_holders FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- No INSERT/UPDATE/DELETE policies: service_role bypasses RLS (migration 0006).

-- --------------------------------------------------------------------------
-- 4. Seed — federal tier, September 2026. Every row cites its source.
--    information_state = 'source_backed' (never verified at seed).
-- --------------------------------------------------------------------------
INSERT INTO offices (id, title, tier, arm, constitutional_basis, sort_order) VALUES
  ('office:president-frn',        'President of the Federal Republic of Nigeria', 'federal', 'executive',   'Constitution of the FRN 1999 (as amended), s.130', 10),
  ('office:vice-president-frn',   'Vice-President of the Federal Republic of Nigeria', 'federal', 'executive','Constitution of the FRN 1999 (as amended), s.141', 20),
  ('office:senate-president',     'President of the Senate', 'federal', 'legislative', 'Constitution of the FRN 1999 (as amended), s.50', 30),
  ('office:deputy-senate-president', 'Deputy President of the Senate', 'federal', 'legislative', 'Constitution of the FRN 1999 (as amended), s.50', 40),
  ('office:speaker-hor',          'Speaker of the House of Representatives', 'federal', 'legislative', 'Constitution of the FRN 1999 (as amended), s.50', 50),
  ('office:deputy-speaker-hor',   'Deputy Speaker of the House of Representatives', 'federal', 'legislative', 'Constitution of the FRN 1999 (as amended), s.50', 60),
  ('office:sgf',                  'Secretary to the Government of the Federation', 'federal', 'executive', NULL, 70),
  ('office:cos-president',        'Chief of Staff to the President', 'federal', 'executive', NULL, 80)
ON CONFLICT (id) DO NOTHING;

INSERT INTO office_holders
  (id, office_id, person_name, term_start, term_end, is_incumbent, appointment_method, party_affiliation,
   information_state, source_label, source_url, source_checked_at, notes)
VALUES
  ('holder:tinubu-2023', 'office:president-frn', 'Bola Ahmed Tinubu', '2023-05-29', NULL, TRUE,
   'general_election', 'APC', 'source_backed',
   'OSGF official appellation statement, May 2026; FG press statement, Sept 2026',
   'https://www.national.com.ng/2026/05/08/sgf-clarifies-official-title-of-president-tinubu-orders-correction-in-media-reports/',
   '2026-09-29T00:00:00Z',
   'Official appellation: His Excellency, Bola Ahmed Tinubu, GCFR, President and Commander-in-Chief of the Armed Forces, Federal Republic of Nigeria.'),
  ('holder:shettima-2023', 'office:vice-president-frn', 'Kashim Shettima', '2023-05-29', NULL, TRUE,
   'general_election', 'APC', 'source_backed',
   'Federal Government press statement via GlobeNewswire, Sept 2026',
   'https://www.globenewswire.com/news-release/2026/09/23/3367354/0/en/nigeria-fully-represented-at-81st-un-general-assembly-as-vice-president-shettima-leads-delegation.html',
   '2026-09-29T00:00:00Z', NULL),
  ('holder:akpabio-2023', 'office:senate-president', 'Godswill Akpabio', '2023-06-13', NULL, TRUE,
   'legislative_election', 'APC', 'source_backed',
   'National Assembly resumption coverage, Sept 2026',
   'https://politicsnigeria.com/2026/09/29/top-agenda-revealed-as-natl-assembly-resumes-today/',
   '2026-09-29T00:00:00Z', '10th National Assembly; elected by senators 13 June 2023.'),
  ('holder:barau-2023', 'office:deputy-senate-president', 'Barau Jibrin', '2023-06-13', NULL, TRUE,
   'legislative_election', 'APC', 'source_backed',
   'State House press release via Abuja Amebo, Feb 2026; Punch IPU coverage, Sept 2026',
   'https://punchng.com/akpabio-backs-australian-speaker-for-ipu-presidency/',
   '2026-09-29T00:00:00Z', 'Senator representing Kano North.'),
  ('holder:abbas-2023', 'office:speaker-hor', 'Tajudeen Abbas', '2023-06-13', NULL, TRUE,
   'legislative_election', 'APC', 'source_backed',
   'National Assembly resumption coverage, Sept 2026',
   'https://politicsnigeria.com/2026/09/29/top-agenda-revealed-as-natl-assembly-resumes-today/',
   '2026-09-29T00:00:00Z', '10th House of Representatives; elected by members 13 June 2023.'),
  ('holder:kalu-2023', 'office:deputy-speaker-hor', 'Benjamin Kalu', '2023-06-13', NULL, TRUE,
   'legislative_election', 'APC', 'source_backed',
   'Punch IPU coverage, Sept 2026',
   'https://punchng.com/akpabio-backs-australian-speaker-for-ipu-presidency/',
   '2026-09-29T00:00:00Z', NULL),
  ('holder:akume-2023', 'office:sgf', 'George Akume', '2023-06-02', NULL, TRUE,
   'presidential_appointment', NULL, 'source_backed',
   'Federal Ministry of Information report, Jan 2026; OSGF statements, May 2026',
   'https://fmino.gov.ng/vice-president-sgf-chief-of-staff-others-shower-encomiums-on-hadiza-bala-as-she-marks-50th-birthday-anniversary/',
   '2026-09-29T00:00:00Z', 'Appointed by the President, 2 June 2023.'),
  ('holder:gbajabiamila-2023', 'office:cos-president', 'Femi Gbajabiamila', '2023-06-02', NULL, TRUE,
   'presidential_appointment', NULL, 'source_backed',
   'Federal Ministry of Information report, Jan 2026',
   'https://fmino.gov.ng/vice-president-sgf-chief-of-staff-others-shower-encomiums-on-hadiza-bala-as-she-marks-50th-birthday-anniversary/',
   '2026-09-29T00:00:00Z', 'Appointed by the President, 2 June 2023; immediate past Speaker of the House of Representatives.')
ON CONFLICT (id) DO NOTHING;
