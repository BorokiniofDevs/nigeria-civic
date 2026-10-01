-- 0010_officials_media.sql — Sourced portraits/bios (officials) and sourced amounts (projects).
--
-- Civic OS rules (Lagos pilot, item 3):
--   1. Portraits and biographical details render ONLY when every provenance
--      field is present: image URL, credit, licence, source page, check date.
--      Federal holders keep NULLs — the UI shows no photo rather than an
--      unsourced one.
--   2. Project amounts are sourced funding figures, NEVER presented as total
--      contract sums unless the source says so. No published figure → NULL →
--      the UI omits the amount block entirely.
--   3. information_state stays 'source_backed'. Adding media does not verify.
--
-- Depends on: 0007 (office_holders), 0009 (projects).

BEGIN;

-- Portraits / bios on holders. All nullable: unsourced = absent.
ALTER TABLE office_holders
  ADD COLUMN IF NOT EXISTS headshot_url         TEXT,
  ADD COLUMN IF NOT EXISTS headshot_caption    TEXT,
  ADD COLUMN IF NOT EXISTS headshot_credit     TEXT,
  ADD COLUMN IF NOT EXISTS headshot_license    TEXT,
  ADD COLUMN IF NOT EXISTS headshot_source_url TEXT,
  ADD COLUMN IF NOT EXISTS headshot_checked_at DATE,
  ADD COLUMN IF NOT EXISTS bio_summary         TEXT,
  ADD COLUMN IF NOT EXISTS bio_source_url      TEXT,
  ADD COLUMN IF NOT EXISTS bio_checked_at      DATE;

-- Sourced amounts on projects. All nullable: unpublished = absent.
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS amount_text         TEXT,
  ADD COLUMN IF NOT EXISTS amount_note         TEXT,
  ADD COLUMN IF NOT EXISTS amount_source_label TEXT,
  ADD COLUMN IF NOT EXISTS amount_source_url   TEXT,
  ADD COLUMN IF NOT EXISTS amount_checked_at   DATE;

-- Honesty invariant: a headshot row must carry its full provenance, or none.
-- (Enforced as a CHECK so a half-filled row can never be served.)
ALTER TABLE office_holders DROP CONSTRAINT IF EXISTS headshot_provenance_complete;
ALTER TABLE office_holders ADD CONSTRAINT headshot_provenance_complete CHECK (
  (headshot_url IS NULL AND headshot_credit IS NULL AND headshot_license IS NULL
    AND headshot_source_url IS NULL AND headshot_checked_at IS NULL)
  OR
  (headshot_url IS NOT NULL AND headshot_credit IS NOT NULL AND headshot_license IS NOT NULL
    AND headshot_source_url IS NOT NULL AND headshot_checked_at IS NOT NULL)
);

-- Governor of Lagos State — official portrait (CC BY-SA 4.0, Ademola Olaniran,
-- via Wikimedia Commons). Checked 2026-09-29.
UPDATE office_holders
SET headshot_url         = 'https://upload.wikimedia.org/wikipedia/commons/9/93/Babajide_sanwo_olu_official_portrait.jpg',
    headshot_caption     = 'Official portrait',
    headshot_credit      = 'Ademola Olaniran',
    headshot_license     = 'CC BY-SA 4.0',
    headshot_source_url  = 'https://commons.wikimedia.org/wiki/File:Babajide_sanwo_olu_official_portrait.jpg',
    headshot_checked_at  = DATE '2026-09-29',
    bio_summary          = 'Born 25 June 1965. Governor of Lagos State since 29 May 2019; re-elected 2023.',
    bio_source_url       = 'https://en.wikipedia.org/wiki/Babajide_Sanwo-Olu',
    bio_checked_at       = DATE '2026-09-29'
WHERE id = 'holder:sanwo-olu-2023';

-- Deputy Governor — event photograph (CC BY-SA 4.0, Kaizenify, via Wikimedia
-- Commons). Captioned honestly: this is NOT an official portrait. Checked 2026-09-29.
UPDATE office_holders
SET headshot_url         = 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Femi_Hamzat_at_the_Lagos_Hackathon_2020_10.jpg',
    headshot_caption     = 'Photographed at the Lagos Hackathon, 2020 — not an official portrait',
    headshot_credit      = 'Kaizenify',
    headshot_license     = 'CC BY-SA 4.0',
    headshot_source_url  = 'https://commons.wikimedia.org/wiki/File:Femi_Hamzat_at_the_Lagos_Hackathon_2020_10.jpg',
    headshot_checked_at  = DATE '2026-09-29',
    bio_summary          = 'Born 19 September 1964. Deputy Governor of Lagos State since 29 May 2019.',
    bio_source_url       = 'https://en.wikipedia.org/wiki/Femi_Hamzat',
    bio_checked_at       = DATE '2026-09-29'
WHERE id = 'holder:hamzat-2023';

-- Blue Line Phase 2 — sourced funding allocation (Independent Nigeria, Nov 2025).
UPDATE projects
SET amount_text         = '₦34.635 billion',
    amount_note         = 'LAMATA allocation from the Lagos N200bn 10-year bond (Nov 2025), to be spent over 24 months raising completion from 32% to 50%. A funding allocation — not the total contract sum.',
    amount_source_label = 'Independent Nigeria, Nov 2025',
    amount_source_url   = 'https://independent.ng/lagos-earmarks-n34-635bn-for-mile-2-okoko-rail-line-from-n200bn-10-year-bond/',
    amount_checked_at   = DATE '2026-09-29'
WHERE id = 'lagos-blue-line-phase-2';

-- Red Line Phase 2 — sourced funding allocation (same bond, same reporting).
UPDATE projects
SET amount_text         = '₦21.646 billion',
    amount_note         = 'LAMATA allocation from the same N200bn bond for the Oyingbo–National Theatre section. A funding allocation — not the total contract sum.',
    amount_source_label = 'Independent Nigeria, Nov 2025',
    amount_source_url   = 'https://independent.ng/lagos-earmarks-n34-635bn-for-mile-2-okoko-rail-line-from-n200bn-10-year-bond/',
    amount_checked_at   = DATE '2026-09-29'
WHERE id = 'lagos-red-line-phase-2';

-- Lekki–Epe Expressway rehabilitation: no published contract sum was found in
-- 2026 reporting, so its amount columns stay NULL and the UI omits the block.

COMMIT;

-- Verification:
--   SELECT id, headshot_url IS NOT NULL AS has_photo, bio_summary IS NOT NULL AS has_bio FROM office_holders WHERE office_id LIKE '%lagos%';
--     → 2 rows, both true; all 8 federal rows false.
--   SELECT id, amount_text FROM projects;
--     → 2 rows with amounts, Lekki–Epe NULL.
--   SELECT count(*) FROM office_holders WHERE information_state = 'verified'; → 0.
