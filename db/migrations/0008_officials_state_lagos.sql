-- ============================================================================
-- MIGRATION 0008 — Officials directory: state tier, Lagos pilot
--
-- Extends migration 0007 with the first state-tier offices: Governor and
-- Deputy Governor of Lagos State. Same epistemic rules as 0007:
--   1. Seed holder records enter as `source_backed` — NEVER `verified`.
--   2. term_end IS NULL + is_incumbent = in office as of source_checked_at;
--      the UI renders "as of <date>", never live knowledge.
--   3. No photographs, biographies, or remuneration without a sourced
--      ingestion record — names + offices + terms only.
--   4. jurisdiction_id uses the platform's stable geo ids
--      (geoEntities.ts: stateId('NGA.25_1') = 'geo:state:NGA.25_1').
--
-- Lagos is the pilot state. Other states follow the same pattern in later
-- migrations; each new state's records cite their own public sources.
-- RLS: tables already created in 0007; policies unchanged.
-- ============================================================================

INSERT INTO offices (id, title, tier, arm, jurisdiction_id, constitutional_basis, sort_order) VALUES
  ('office:governor-lagos',        'Governor of Lagos State',        'state', 'executive', 'geo:state:NGA.25_1', 'Constitution of the FRN 1999 (as amended), s.176', 10),
  ('office:deputy-governor-lagos', 'Deputy Governor of Lagos State', 'state', 'executive', 'geo:state:NGA.25_1', 'Constitution of the FRN 1999 (as amended), s.187', 20)
ON CONFLICT (id) DO NOTHING;

INSERT INTO office_holders
  (id, office_id, person_name, term_start, term_end, is_incumbent, appointment_method, party_affiliation,
   information_state, source_label, source_url, source_checked_at, notes)
VALUES
  ('holder:sanwo-olu-2023', 'office:governor-lagos', 'Babajide Sanwo-Olu', '2023-05-29', NULL, TRUE,
   'general_election', 'APC', 'source_backed',
   'Lagos Eye News state government report, Sept 2026; Lagos APC campaign council list, Sept 2026',
   'https://lagoseyemedia.com/2026/09/29/sanwo-olu-meets-security-chiefs-assures-lagosians-of-stronger-security-ahead-of-year-end-activitieslagos-eye-news/',
   '2026-09-29T00:00:00Z',
   'Second term; first sworn in 29 May 2019. Chairs the Lagos APC 2027 campaign council (Sept 2026).'),
  ('holder:hamzat-2023', 'office:deputy-governor-lagos', 'Kadri Obafemi Hamzat', '2023-05-29', NULL, TRUE,
   'general_election', 'APC', 'source_backed',
   'TheCable report, Sept 2026; Lagos APC campaign council list, Sept 2026',
   'https://www.thecable.ng/lagos-deputy-governor-to-headline-podfest-naija-2026/',
   '2026-09-29T00:00:00Z',
   'Deputy Governor since 29 May 2019; re-elected 2023. Named deputy chairman of the Lagos APC 2027 campaign council (Sept 2026).')
ON CONFLICT (id) DO NOTHING;
