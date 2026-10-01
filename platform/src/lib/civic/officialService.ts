// lib/civic/officialService.ts — Officials directory (government office-holders).
//
// Implements migrations 0007 + 0008 client-side. In production this logic lives
// behind the API with PostgreSQL RLS as the authority; here it runs against an
// in-memory store seeded ONLY with the sourced federal records (0007) and the
// Lagos State pilot records (0008). The migrations are the production target —
// this service mirrors their rules 1:1.
//
// EPISTEMIC RULES (mirrored from the migration):
//   - The office ≠ the holder. Seed records are `source_backed`, never
//     `verified`. Verification requires the staging/change-request process.
//   - term_end NULL + isIncumbent = in office as of sourceCheckedAt.
//   - Photos and bios render ONLY when every provenance field is present
//     (URL, credit, licence, source page, check date). Unsourced = absent;
//     the UI must show no photo rather than an unsourced one.
import type { InformationState } from '@/lib/provenance';

export type OfficeTier = 'federal' | 'state' | 'lga' | 'lcda' | 'ward' | 'community';
export type OfficeArm = 'executive' | 'legislative' | 'judiciary' | 'traditional' | 'other';

export interface Office {
  id: string;
  title: string;
  tier: OfficeTier;
  arm: OfficeArm;
  jurisdictionId: string | null;
  constitutionalBasis: string | null;
  sortOrder: number;
}

export interface OfficeHolder {
  id: string;
  officeId: string;
  personName: string;
  termStart: string | null; // ISO date; NULL = not stated
  termEnd: string | null;   // NULL + isIncumbent = currently in office as of sourceCheckedAt
  isIncumbent: boolean;
  appointmentMethod: string | null;
  partyAffiliation: string | null;
  informationState: InformationState;
  sourceLabel: string;
  sourceUrl: string | null;
  sourceCheckedAt: string | null; // ISO datetime
  notes: string | null;
  // Sourced portrait — all-or-nothing provenance (mirrors the
  // headshot_provenance_complete CHECK in migration 0010). Every field null
  // means "no sourced photo": the UI renders nothing.
  headshotUrl: string | null;
  headshotCaption: string | null;
  headshotCredit: string | null;
  headshotLicense: string | null;
  headshotSourceUrl: string | null;
  headshotCheckedAt: string | null; // ISO date
  // Sourced biographical summary.
  bioSummary: string | null;
  bioSourceUrl: string | null;
  bioCheckedAt: string | null; // ISO date
}

export interface OfficeWithHolder {
  office: Office;
  holder: OfficeHolder | null;
}

// ---------------------------------------------------------------------------
// Seed — federal tier, September 2026. Mirrors db/migrations/0007 exactly.
// Every record cites the public source it was read from.
// ---------------------------------------------------------------------------
const FEDERAL_OFFICES: Office[] = [
  { id: 'office:president-frn', title: 'President of the Federal Republic of Nigeria', tier: 'federal', arm: 'executive', jurisdictionId: null, constitutionalBasis: 'Constitution of the FRN 1999 (as amended), s.130', sortOrder: 10 },
  { id: 'office:vice-president-frn', title: 'Vice-President of the Federal Republic of Nigeria', tier: 'federal', arm: 'executive', jurisdictionId: null, constitutionalBasis: 'Constitution of the FRN 1999 (as amended), s.141', sortOrder: 20 },
  { id: 'office:senate-president', title: 'President of the Senate', tier: 'federal', arm: 'legislative', jurisdictionId: null, constitutionalBasis: 'Constitution of the FRN 1999 (as amended), s.50', sortOrder: 30 },
  { id: 'office:deputy-senate-president', title: 'Deputy President of the Senate', tier: 'federal', arm: 'legislative', jurisdictionId: null, constitutionalBasis: 'Constitution of the FRN 1999 (as amended), s.50', sortOrder: 40 },
  { id: 'office:speaker-hor', title: 'Speaker of the House of Representatives', tier: 'federal', arm: 'legislative', jurisdictionId: null, constitutionalBasis: 'Constitution of the FRN 1999 (as amended), s.50', sortOrder: 50 },
  { id: 'office:deputy-speaker-hor', title: 'Deputy Speaker of the House of Representatives', tier: 'federal', arm: 'legislative', jurisdictionId: null, constitutionalBasis: 'Constitution of the FRN 1999 (as amended), s.50', sortOrder: 60 },
  { id: 'office:sgf', title: 'Secretary to the Government of the Federation', tier: 'federal', arm: 'executive', jurisdictionId: null, constitutionalBasis: null, sortOrder: 70 },
  { id: 'office:cos-president', title: 'Chief of Staff to the President', tier: 'federal', arm: 'executive', jurisdictionId: null, constitutionalBasis: null, sortOrder: 80 },
];

// ---------------------------------------------------------------------------
// Seed — state tier, Lagos pilot (September 2026). Mirrors
// db/migrations/0008_officials_state_lagos.sql exactly. jurisdiction_id
// follows geoEntities.ts: stateId('NGA.25_1') = 'geo:state:NGA.25_1'.
// ---------------------------------------------------------------------------
const STATE_OFFICES: Office[] = [
  { id: 'office:governor-lagos', title: 'Governor of Lagos State', tier: 'state', arm: 'executive', jurisdictionId: 'geo:state:NGA.25_1', constitutionalBasis: 'Constitution of the FRN 1999 (as amended), s.176', sortOrder: 10 },
  { id: 'office:deputy-governor-lagos', title: 'Deputy Governor of Lagos State', tier: 'state', arm: 'executive', jurisdictionId: 'geo:state:NGA.25_1', constitutionalBasis: 'Constitution of the FRN 1999 (as amended), s.187', sortOrder: 20 },
];

const STATE_HOLDERS: OfficeHolder[] = [
  {
    id: 'holder:sanwo-olu-2023', officeId: 'office:governor-lagos', personName: 'Babajide Sanwo-Olu',
    termStart: '2023-05-29', termEnd: null, isIncumbent: true,
    appointmentMethod: 'general_election', partyAffiliation: 'APC',
    informationState: 'source_backed',
    sourceLabel: 'Lagos Eye News state government report, Sept 2026; Lagos APC campaign council list, Sept 2026',
    sourceUrl: 'https://lagoseyemedia.com/2026/09/29/sanwo-olu-meets-security-chiefs-assures-lagosians-of-stronger-security-ahead-of-year-end-activitieslagos-eye-news/',
    sourceCheckedAt: '2026-09-29T00:00:00Z',
    headshotUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/93/Babajide_sanwo_olu_official_portrait.jpg',
    headshotCaption: 'Official portrait',
    headshotCredit: 'Ademola Olaniran',
    headshotLicense: 'CC BY-SA 4.0',
    headshotSourceUrl: 'https://commons.wikimedia.org/wiki/File:Babajide_sanwo_olu_official_portrait.jpg',
    headshotCheckedAt: '2026-09-29',
    bioSummary: 'Born 25 June 1965. Governor of Lagos State since 29 May 2019; re-elected 2023.',
    bioSourceUrl: 'https://en.wikipedia.org/wiki/Babajide_Sanwo-Olu',
    bioCheckedAt: '2026-09-29',

    notes: 'Second term; first sworn in 29 May 2019. Chairs the Lagos APC 2027 campaign council (Sept 2026).',
  },
  {
    id: 'holder:hamzat-2023', officeId: 'office:deputy-governor-lagos', personName: 'Kadri Obafemi Hamzat',
    termStart: '2023-05-29', termEnd: null, isIncumbent: true,
    appointmentMethod: 'general_election', partyAffiliation: 'APC',
    informationState: 'source_backed',
    sourceLabel: 'TheCable report, Sept 2026; Lagos APC campaign council list, Sept 2026',
    sourceUrl: 'https://www.thecable.ng/lagos-deputy-governor-to-headline-podfest-naija-2026/',
    sourceCheckedAt: '2026-09-29T00:00:00Z',
    headshotUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Femi_Hamzat_at_the_Lagos_Hackathon_2020_10.jpg',
    headshotCaption: 'Photographed at the Lagos Hackathon, 2020 — not an official portrait',
    headshotCredit: 'Kaizenify',
    headshotLicense: 'CC BY-SA 4.0',
    headshotSourceUrl: 'https://commons.wikimedia.org/wiki/File:Femi_Hamzat_at_the_Lagos_Hackathon_2020_10.jpg',
    headshotCheckedAt: '2026-09-29',
    bioSummary: 'Born 19 September 1964. Deputy Governor of Lagos State since 29 May 2019.',
    bioSourceUrl: 'https://en.wikipedia.org/wiki/Femi_Hamzat',
    bioCheckedAt: '2026-09-29',

    notes: 'Deputy Governor since 29 May 2019; re-elected 2023. Named deputy chairman of the Lagos APC 2027 campaign council (Sept 2026).',
  },
];

const FEDERAL_HOLDERS: OfficeHolder[] = [
  {
    id: 'holder:tinubu-2023', officeId: 'office:president-frn', personName: 'Bola Ahmed Tinubu',
    termStart: '2023-05-29', termEnd: null, isIncumbent: true,
    appointmentMethod: 'general_election', partyAffiliation: 'APC',
    informationState: 'source_backed',
    sourceLabel: 'OSGF official appellation statement, May 2026; FG press statement, Sept 2026',
    sourceUrl: 'https://www.national.com.ng/2026/05/08/sgf-clarifies-official-title-of-president-tinubu-orders-correction-in-media-reports/',
    sourceCheckedAt: '2026-09-29T00:00:00Z',
    headshotUrl: null,
    headshotCaption: null,
    headshotCredit: null,
    headshotLicense: null,
    headshotSourceUrl: null,
    headshotCheckedAt: null,
    bioSummary: null,
    bioSourceUrl: null,
    bioCheckedAt: null,

    notes: 'Official appellation: His Excellency, Bola Ahmed Tinubu, GCFR, President and Commander-in-Chief of the Armed Forces, Federal Republic of Nigeria.',
  },
  {
    id: 'holder:shettima-2023', officeId: 'office:vice-president-frn', personName: 'Kashim Shettima',
    termStart: '2023-05-29', termEnd: null, isIncumbent: true,
    appointmentMethod: 'general_election', partyAffiliation: 'APC',
    informationState: 'source_backed',
    sourceLabel: 'Federal Government press statement via GlobeNewswire, Sept 2026',
    sourceUrl: 'https://www.globenewswire.com/news-release/2026/09/23/3367354/0/en/nigeria-fully-represented-at-81st-un-general-assembly-as-vice-president-shettima-leads-delegation.html',
    sourceCheckedAt: '2026-09-29T00:00:00Z',
    headshotUrl: null,
    headshotCaption: null,
    headshotCredit: null,
    headshotLicense: null,
    headshotSourceUrl: null,
    headshotCheckedAt: null,
    bioSummary: null,
    bioSourceUrl: null,
    bioCheckedAt: null,
    notes: null,
  },
  {
    id: 'holder:akpabio-2023', officeId: 'office:senate-president', personName: 'Godswill Akpabio',
    termStart: '2023-06-13', termEnd: null, isIncumbent: true,
    appointmentMethod: 'legislative_election', partyAffiliation: 'APC',
    informationState: 'source_backed',
    sourceLabel: 'National Assembly resumption coverage, Sept 2026',
    sourceUrl: 'https://politicsnigeria.com/2026/09/29/top-agenda-revealed-as-natl-assembly-resumes-today/',
    sourceCheckedAt: '2026-09-29T00:00:00Z',
    headshotUrl: null,
    headshotCaption: null,
    headshotCredit: null,
    headshotLicense: null,
    headshotSourceUrl: null,
    headshotCheckedAt: null,
    bioSummary: null,
    bioSourceUrl: null,
    bioCheckedAt: null,

    notes: '10th National Assembly; elected by senators 13 June 2023.',
  },
  {
    id: 'holder:barau-2023', officeId: 'office:deputy-senate-president', personName: 'Barau Jibrin',
    termStart: '2023-06-13', termEnd: null, isIncumbent: true,
    appointmentMethod: 'legislative_election', partyAffiliation: 'APC',
    informationState: 'source_backed',
    sourceLabel: 'State House press release, Feb 2026; Punch IPU coverage, Sept 2026',
    sourceUrl: 'https://punchng.com/akpabio-backs-australian-speaker-for-ipu-presidency/',
    sourceCheckedAt: '2026-09-29T00:00:00Z',
    headshotUrl: null,
    headshotCaption: null,
    headshotCredit: null,
    headshotLicense: null,
    headshotSourceUrl: null,
    headshotCheckedAt: null,
    bioSummary: null,
    bioSourceUrl: null,
    bioCheckedAt: null,
    notes: 'Senator representing Kano North.',
  },
  {
    id: 'holder:abbas-2023', officeId: 'office:speaker-hor', personName: 'Tajudeen Abbas',
    termStart: '2023-06-13', termEnd: null, isIncumbent: true,
    appointmentMethod: 'legislative_election', partyAffiliation: 'APC',
    informationState: 'source_backed',
    sourceLabel: 'National Assembly resumption coverage, Sept 2026',
    sourceUrl: 'https://politicsnigeria.com/2026/09/29/top-agenda-revealed-as-natl-assembly-resumes-today/',
    sourceCheckedAt: '2026-09-29T00:00:00Z',
    headshotUrl: null,
    headshotCaption: null,
    headshotCredit: null,
    headshotLicense: null,
    headshotSourceUrl: null,
    headshotCheckedAt: null,
    bioSummary: null,
    bioSourceUrl: null,
    bioCheckedAt: null,

    notes: '10th House of Representatives; elected by members 13 June 2023.',
  },
  {
    id: 'holder:kalu-2023', officeId: 'office:deputy-speaker-hor', personName: 'Benjamin Kalu',
    termStart: '2023-06-13', termEnd: null, isIncumbent: true,
    appointmentMethod: 'legislative_election', partyAffiliation: 'APC',
    informationState: 'source_backed',
    sourceLabel: 'Punch IPU coverage, Sept 2026',
    sourceUrl: 'https://punchng.com/akpabio-backs-australian-speaker-for-ipu-presidency/',
    sourceCheckedAt: '2026-09-29T00:00:00Z',
    headshotUrl: null,
    headshotCaption: null,
    headshotCredit: null,
    headshotLicense: null,
    headshotSourceUrl: null,
    headshotCheckedAt: null,
    bioSummary: null,
    bioSourceUrl: null,
    bioCheckedAt: null,
    notes: null,
  },
  {
    id: 'holder:akume-2023', officeId: 'office:sgf', personName: 'George Akume',
    termStart: '2023-06-02', termEnd: null, isIncumbent: true,
    appointmentMethod: 'presidential_appointment', partyAffiliation: null,
    informationState: 'source_backed',
    sourceLabel: 'Federal Ministry of Information report, Jan 2026; OSGF statements, May 2026',
    sourceUrl: 'https://fmino.gov.ng/vice-president-sgf-chief-of-staff-others-shower-encomiums-on-hadiza-bala-as-she-marks-50th-birthday-anniversary/',
    sourceCheckedAt: '2026-09-29T00:00:00Z',
    headshotUrl: null,
    headshotCaption: null,
    headshotCredit: null,
    headshotLicense: null,
    headshotSourceUrl: null,
    headshotCheckedAt: null,
    bioSummary: null,
    bioSourceUrl: null,
    bioCheckedAt: null,
    notes: 'Appointed by the President, 2 June 2023.',
  },
  {
    id: 'holder:gbajabiamila-2023', officeId: 'office:cos-president', personName: 'Femi Gbajabiamila',
    termStart: '2023-06-02', termEnd: null, isIncumbent: true,
    appointmentMethod: 'presidential_appointment', partyAffiliation: null,
    informationState: 'source_backed',
    sourceLabel: 'Federal Ministry of Information report, Jan 2026',
    sourceUrl: 'https://fmino.gov.ng/vice-president-sgf-chief-of-staff-others-shower-encomiums-on-hadiza-bala-as-she-marks-50th-birthday-anniversary/',
    sourceCheckedAt: '2026-09-29T00:00:00Z',
    headshotUrl: null,
    headshotCaption: null,
    headshotCredit: null,
    headshotLicense: null,
    headshotSourceUrl: null,
    headshotCheckedAt: null,
    bioSummary: null,
    bioSourceUrl: null,
    bioCheckedAt: null,

    notes: 'Appointed by the President, 2 June 2023; immediate past Speaker of the House of Representatives.',
  },
];

// ---------------------------------------------------------------------------
// Combined seed — federal + state tiers. Mirrors migrations 0007 + 0008 1:1.
// ---------------------------------------------------------------------------
const OFFICES: Office[] = [...FEDERAL_OFFICES, ...STATE_OFFICES];
const HOLDERS: OfficeHolder[] = [...FEDERAL_HOLDERS, ...STATE_HOLDERS];

const TIER_ORDER: OfficeTier[] = ['federal', 'state', 'lga', 'lcda', 'ward', 'community'];

/** Stable geo id → human label, for state-tier tab labels. */
const JURISDICTION_LABELS: Record<string, string> = {
  'geo:state:NGA.25_1': 'Lagos State',
};

/** Tiers that currently have at least one office, in canonical order. */
export function listTiers(): OfficeTier[] {
  return TIER_ORDER.filter((t) => OFFICES.some((o) => o.tier === t));
}

/** Human label for a tier tab. State tiers resolve through their jurisdiction. */
export function tierLabel(tier: OfficeTier): string {
  if (tier === 'federal') return 'Federal';
  const jurisdictionId = OFFICES.find((o) => o.tier === tier)?.jurisdictionId;
  if (jurisdictionId && JURISDICTION_LABELS[jurisdictionId]) return JURISDICTION_LABELS[jurisdictionId];
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------
export function listOffices(tier?: OfficeTier): Office[] {
  const all = [...OFFICES].sort((a, b) => a.sortOrder - b.sortOrder);
  return tier ? all.filter((o) => o.tier === tier) : all;
}

export function incumbentOf(officeId: string): OfficeHolder | null {
  return HOLDERS.find((h) => h.officeId === officeId && h.isIncumbent) ?? null;
}

export function directory(tier?: OfficeTier): OfficeWithHolder[] {
  return listOffices(tier).map((office) => ({ office, holder: incumbentOf(office.id) }));
}

export function searchOfficials(query: string, tier?: OfficeTier): OfficeWithHolder[] {
  const q = query.trim().toLowerCase();
  const base = directory(tier);
  if (!q) return base;
  return base.filter(
    ({ office, holder }) =>
      office.title.toLowerCase().includes(q) ||
      (holder?.personName.toLowerCase().includes(q) ?? false),
  );
}

/** Honest "as of" line for an incumbent tenure. Never implies live knowledge. */
export function tenureAsOf(holder: OfficeHolder): string {
  const start = holder.termStart ?? 'date not stated';
  const checked = holder.sourceCheckedAt ? holder.sourceCheckedAt.slice(0, 10) : 'unrecorded date';
  return `In office since ${start} · source checked ${checked}`;
}
