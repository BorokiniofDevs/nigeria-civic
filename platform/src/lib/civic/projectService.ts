// lib/civic/projectService.ts — Projects directory (Lagos pilot).
//
// Implements migration 0009 client-side. In production this logic lives
// behind the API with PostgreSQL RLS as the authority; here it runs against
// an in-memory store seeded ONLY with sourced records. The migration is the
// production target — this service mirrors its rules 1:1.
//
// EPISTEMIC RULES (mirrored from the migration):
//   - The project entity ≠ claims about it ≠ sources. Seed claims are
//     `source_backed`, never `verified`.
//   - Locations are corridor-level approximations unless a surveyed point is
//     sourced; coordinatePrecision is always explicit, never implied.
//   - Status comes from public reporting with a checked date; "ongoing" is
//     only claimed where reporting describes active works.
import type { InformationState } from '@/lib/provenance';

export type ProjectStatus = 'planned' | 'under_construction' | 'operational' | 'suspended';
export type CoordinatePrecision = 'approximate' | 'precise';

export interface ProjectSource {
  name: string;
  url: string;
  /** ISO date the source was last checked. */
  checkedAt: string;
  note: string;
}

/**
 * A sourced funding figure for a project. Rendered only when every provenance
 * field is present. A funding allocation is NEVER presented as a total
 * contract sum unless the source says so — see `note`.
 */
export interface ProjectAmount {
  text: string;
  note: string;
  sourceLabel: string;
  sourceUrl: string;
  /** ISO date the source was last checked. */
  checkedAt: string;
}

export interface CivicProject {
  id: string;
  name: string;
  sector: 'rail' | 'road';
  jurisdictionId: string;
  status: ProjectStatus;
  /** Honest status wording drawn from the sources below. */
  statusNote: string;
  lat: number;
  lng: number;
  coordinatePrecision: CoordinatePrecision;
  locationNote: string;
  informationState: InformationState;
  sources: ProjectSource[];
  /** Sourced amount; null when no figure was published. The UI omits the block. */
  amount: ProjectAmount | null;
}

const LAGOS = 'geo:state:NGA.25_1';

const SEED: CivicProject[] = [
  {
    id: 'lagos-blue-line-phase-2',
    name: 'Lagos Blue Line Rail — Phase 2 (Mile 2 → Okokomaiko)',
    sector: 'rail',
    jurisdictionId: LAGOS,
    status: 'under_construction',
    statusNote:
      'Track construction, station development and power installation reported ongoing ' +
      '(Commissioner for Transportation, May 2026). A LAMATA promotional segment targeted ' +
      'delivery in 2026, but financing details were described as unclear.',
    lat: 6.46,
    lng: 3.25,
    coordinatePrecision: 'approximate',
    locationNote: 'Approximate corridor midpoint (Mile 2–Okokomaiko) for viewing; not a surveyed point.',
    informationState: 'source_backed',
    sources: [
      {
        name: 'The Nation — "Lagos records major gains in road, rail, water transport — Commissioner"',
        url: 'https://thenationonlineng.net/lagos-records-major-gains-in-road-rail-water-transport-commissioner/',
        checkedAt: '2026-09-29',
        note: 'Commissioner Osiyemi: Phase 2 extends Mile 2 to Okokomaiko; track, stations and power works ongoing.',
      },
      {
        name: 'Heinrich Böll Stiftung — "Moving Lagos: The Blue Line and the Future of Mass Transit"',
        url: 'https://ng.boell.org/sites/default/files/2025-03/moving-lagos_the-blue-line-and-the-future-of-mass-transit.pdf',
        checkedAt: '2026-09-29',
        note: 'LAMATA staff interviews; Phase 2 delivery targeted 2026 with financing unclear.',
      },
      {
        name: 'Wigmore Trading — Lagos Train Schedule 2026',
        url: 'https://wigmoretrading.com/the-complete-guide-to-the-lagos-train-schedule-timings-and-routes/',
        checkedAt: '2026-09-29',
        note: 'Line currently ends at Mile 2; Phase 2 to Okokomaiko under construction.',
      },
    ],
    amount: {
      text: '₦34.635 billion',
      note:
        'LAMATA allocation from the Lagos N200bn 10-year bond (Nov 2025), to be spent over 24 months ' +
        'raising completion from 32% to 50%. A funding allocation — not the total contract sum.',
      sourceLabel: 'Independent Nigeria, Nov 2025',
      sourceUrl: 'https://independent.ng/lagos-earmarks-n34-635bn-for-mile-2-okoko-rail-line-from-n200bn-10-year-bond/',
      checkedAt: '2026-09-29',
    },
  },
  {
    id: 'lagos-red-line-phase-2',
    name: 'Lagos Red Line Rail — Phase 2 (Oyingbo → National Theatre)',
    sector: 'rail',
    jurisdictionId: LAGOS,
    status: 'under_construction',
    statusNote:
      'LAMATA–CCECC Phase 2 construction agreement signed February 2024. April 2026 reporting ' +
      'describes Phase 2 as under construction toward the Blue Line interchange; a May 2026 ' +
      'commissioner statement refers to an ongoing feasibility study for the Oyingbo–National ' +
      'Theatre link. Exact endpoint and pace of works not independently verified.',
    lat: 6.49,
    lng: 3.39,
    coordinatePrecision: 'approximate',
    locationNote: 'Approximate corridor midpoint (Oyingbo–National Theatre, Iganmu) for viewing; not a surveyed point.',
    informationState: 'source_backed',
    sources: [
      {
        name: 'Nairametrics — "Sanwo-Olu confirms plans to extend Red Line rail into Ogun State"',
        url: 'https://nairametrics.com/2026/04/23/sanwo-olu-confirms-plans-to-extend-red-line-rail-into-ogun-state/',
        checkedAt: '2026-09-29',
        note: 'Phase 1 runs Oyingbo–Agbado; second phase under construction, expected to terminate at Marina/Blue Line interchange.',
      },
      {
        name: 'The Nation — "Lagos records major gains in road, rail, water transport — Commissioner"',
        url: 'https://thenationonlineng.net/lagos-records-major-gains-in-road-rail-water-transport-commissioner/',
        checkedAt: '2026-09-29',
        note: 'Feasibility study ongoing for Phase 2 from Oyingbo to National Theatre to connect with the Blue Line.',
      },
      {
        name: 'The Nation — "Triumph of vision"',
        url: 'https://thenationonlineng.net/triumph-of-vision/',
        checkedAt: '2026-09-29',
        note: 'Contract signed for Red Line Phase 2: Oyingbo to National Theatre (Iganmu), elevated, en route to Marina.',
      },
    ],
    amount: {
      text: '₦21.646 billion',
      note:
        'LAMATA allocation from the same N200bn bond for the Oyingbo–National Theatre section. ' +
        'A funding allocation — not the total contract sum.',
      sourceLabel: 'Independent Nigeria, Nov 2025',
      sourceUrl: 'https://independent.ng/lagos-earmarks-n34-635bn-for-mile-2-okoko-rail-line-from-n200bn-10-year-bond/',
      checkedAt: '2026-09-29',
    },
  },
  {
    id: 'lekki-epe-expressway-rehab',
    name: 'Lekki–Epe Expressway rehabilitation (Admiralty → Jubilee Bridge)',
    sector: 'road',
    jurisdictionId: LAGOS,
    status: 'under_construction',
    statusNote:
      'Phased rehabilitation began 25 January 2026 across roughly 20 km in eight sections. ' +
      'Several sections (Chevron–Chisco, Chevron–Admiralty) were reported complete by ' +
      'February–March 2026, with works on remaining sections described as ongoing.',
    lat: 6.45,
    lng: 3.51,
    coordinatePrecision: 'approximate',
    locationNote: 'Approximate midpoint of the ~20 km Admiralty–Jubilee Bridge rehabilitation stretch; not a surveyed point.',
    informationState: 'source_backed',
    sources: [
      {
        name: 'Nairametrics — "Lagos to close Epe-bound Lekki–Ajah carriageway for rehabilitation works"',
        url: 'https://nairametrics.com/2026/02/27/lagos-to-close-epe-bound-lekki-ajah-carriageway-for-rehabilitation-works/',
        checkedAt: '2026-09-29',
        note: 'Rehabilitation began 25 Jan 2026, planned 64 days across ~20 km from Admiralty to Jubilee Bridge.',
      },
      {
        name: 'Nairametrics — "Lagos completes rehabilitation of Chevron–Admiralty stretch"',
        url: 'https://nairametrics.com/2026/02/25/lagos-completes-rehabilitation-of-chevron-admiralty-stretch-of-lekki-ajah-road/',
        checkedAt: '2026-09-29',
        note: 'Chevron–Igbo-Efon, Igbo-Efon–Jakande and Jakande–Chisco (4.51 km) completed.',
      },
      {
        name: 'P.M. News — "Gridlock imminent as Lagos begins major rehabilitation works"',
        url: 'https://pmnewsnigeria.com/2026/01/20/gridlock-imminent-as-lagos-begins-major-rehabilitation-works-on-lekki-epe-expressway/',
        checkedAt: '2026-09-29',
        note: 'Sections 2 and 3 rehabilitation; eight-phase, day-and-night works with traffic management plan.',
      },
    ],
    // No contract sum was published in 2026 reporting — the block is omitted.
    amount: null,
  },
];

const byId = new Map(SEED.map((p) => [p.id, p]));

export function listProjects(jurisdictionId?: string): CivicProject[] {
  if (!jurisdictionId) return [...SEED];
  return SEED.filter((p) => p.jurisdictionId === jurisdictionId);
}

export function getProject(id: string): CivicProject | undefined {
  return byId.get(id);
}

export function statusLabel(s: ProjectStatus): string {
  switch (s) {
    case 'planned': return 'Planned';
    case 'under_construction': return 'Under construction';
    case 'operational': return 'Operational';
    case 'suspended': return 'Suspended';
  }
}
