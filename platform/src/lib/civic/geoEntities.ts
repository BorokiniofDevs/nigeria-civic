// lib/civic/geoEntities.ts — GADM v4.1 → CivicEntity adapter.
// Real jurisdictions only: names + boundaries from the authoritative
// geographic dataset. Every entity carries information_state 'unknown'
// because a boundary is not a civic fact — we know WHERE it is, not
// WHAT is verified about it. No office-holders, no figures, no contacts.
import { STATES, LAGOS_LGAS, bboxOf, type FeatureCollection } from '@/lib/geo';
import type { CivicEntity } from './types';

export const COUNTRY_ID = 'geo:NG';
export const stateId = (gadmId: string) => `geo:state:${gadmId}`;
export const lgaId = (gadmId: string) => `geo:lga:${gadmId}`;

/**
 * LGA boundary geometry loaded per state. Today: Lagos only.
 * A state shows an LGA layer IFF it has an entry here — national code,
 * no Lagos branches; other states honestly report "not loaded".
 */
export const LGA_GEOMETRY: Record<string, FeatureCollection> = {
  Lagos: LAGOS_LGAS,
};

export function lgaGeometryFor(stateName: string): FeatureCollection | undefined {
  return LGA_GEOMETRY[stateName];
}

function stateDisplayName(name: string): string {
  return name === 'Federal Capital Territory' ? name : `${name} State`;
}

const entities = new Map<string, CivicEntity>();

function add(e: CivicEntity): void {
  entities.set(e.id, e);
}

// ---- Country ----
add({
  id: COUNTRY_ID,
  kind: 'country',
  name: 'Nigeria',
  parentId: null,
  informationState: 'unknown',
  sourceLabel: 'GADM v4.1',
  note: 'Federal Republic of Nigeria — 36 states + Federal Capital Territory.',
});

// ---- States / FCT ----
for (const f of STATES.features) {
  const name = f.properties.name as string;
  add({
    id: stateId(f.properties.id),
    kind: 'state',
    name: stateDisplayName(name),
    parentId: COUNTRY_ID,
    informationState: 'unknown',
    geometryRef: { collection: 'states', featureId: f.properties.id },
    sourceLabel: 'GADM v4.1',
    note: lgaGeometryFor(name)
      ? undefined
      : 'LGA boundary data not loaded in this build.',
  });
}

function findStateId(stateName: string): string | undefined {
  for (const e of entities.values()) {
    if (e.kind === 'state' && (e.name === stateDisplayName(stateName) || e.name === stateName)) return e.id;
  }
  return undefined;
}

// ---- Lagos LGAs (constitutional — GADM) ----
const lagosId = findStateId('Lagos');
if (lagosId) {
  for (const f of LAGOS_LGAS.features) {
    add({
      id: lgaId(f.properties.id),
      kind: 'lga',
      name: f.properties.name as string,
      parentId: lagosId,
      informationState: 'unknown',
      constitutionalStatus: 'constitutional',
      geometryRef: { collection: 'lgas', featureId: f.properties.id },
      sourceLabel: 'GADM v4.1',
    });
  }
}

// ---- Pilot structure: LCDAs + wards (Kosofe, Lagos) ----
// Names are real Lagos LCDAs; positions are illustrative and labelled as
// such — official LCDA/ward boundary data is pending. No officials invented.
const KOSOFE_LGA_ID = (() => {
  for (const e of entities.values()) {
    if (e.kind === 'lga' && e.name === 'Kosofe') return e.id;
  }
  return undefined;
})();

export const PILOT_LCDAS = [
  { id: 'geo:lcda:agboyi-ketu', name: 'Agboyi-Ketu', wards: 7 },
  { id: 'geo:lcda:ikosi-isheri', name: 'Ikosi-Isheri', wards: 5 },
];

if (KOSOFE_LGA_ID) {
  const kosofeGadm = 'NG-LA-13_1';
  PILOT_LCDAS.forEach((lcda, li) => {
    add({
      id: lcda.id,
      kind: 'lcda',
      name: `${lcda.name} LCDA`,
      parentId: KOSOFE_LGA_ID,
      informationState: 'unknown',
      constitutionalStatus: 'state_created',
      position: illustrativePoint('lgas', kosofeGadm, `lcda:${lcda.id}`, li),
      positionNote: 'Illustrative position — official LCDA boundary data pending.',
      sourceLabel: 'Lagos State structure (pilot)',
      note: 'State-created LCDA — not a constitutional LGA.',
    });
    for (let i = 1; i <= 3; i++) {
      const n = `0${i}`;
      add({
        id: `${lcda.id}:ward-${n}`,
        kind: 'ward',
        name: `Ward ${n}`,
        parentId: lcda.id,
        informationState: 'unknown',
        position: illustrativePoint('lgas', kosofeGadm, `ward:${lcda.id}`, i),
        positionNote: 'Illustrative position — official ward boundary data pending.',
        sourceLabel: 'Lagos State structure (pilot)',
      });
    }
  });
}

export function getGeoEntity(id: string): CivicEntity | undefined {
  return entities.get(id);
}

/**
 * Resolve a navigation view to the deepest jurisdiction entity id.
 * view.lcda / view.ward carry entity ids; state/lga carry GADM names.
 */
export function jurisdictionIdForView(view: {
  level: string; state: string | null; lga: string | null; lcda: string | null; ward: string | null;
}): string | null {
  if (view.ward) return view.ward;
  if (view.lcda) return view.lcda;
  if (view.lga && view.state) {
    const sid = findStateId(view.state);
    if (sid) {
      for (const e of entities.values()) {
        if (e.kind === 'lga' && e.parentId === sid && e.name === view.lga) return e.id;
      }
    }
    return null;
  }
  if (view.state) return findStateId(view.state) ?? null;
  return COUNTRY_ID;
}

export function geoChildrenOf(parentId: string): CivicEntity[] {
  return [...entities.values()].filter((e) => e.parentId === parentId);
}

export function geoStates(): CivicEntity[] {
  return [...entities.values()]
    .filter((e) => e.kind === 'state')
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Illustrative point inside a real boundary — deterministic, labelled. */
export function illustrativePoint(
  collection: 'states' | 'lgas',
  featureId: string,
  salt: string,
  index: number,
): [number, number] | undefined {
  const fc = collection === 'states' ? STATES : LAGOS_LGAS;
  const f = fc.features.find((x) => x.properties.id === featureId);
  if (!f) return undefined;
  const b = bboxOf(f);
  // Deterministic pseudo-random from salt (FNV-1a), no Math.random in data.
  let h = 2166136261;
  const s = `${salt}:${index}`;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  const r = () => { h = Math.imul(h ^ (h >>> 15), 1 | h); h = (h + Math.imul(h ^ (h >>> 7), 61 | h)) ^ h; return ((h ^ (h >>> 14)) >>> 0) / 4294967296; };
  const pad = 0.2;
  return [
    b[0] + (b[2] - b[0]) * (pad + r() * (1 - 2 * pad)),
    b[1] + (b[3] - b[1]) * (pad + r() * (1 - 2 * pad)),
  ];
}

/** Boundary data honesty: which states have real LGA geometry loaded. */
export function hasLgaGeometry(stateName: string): boolean {
  return stateName in LGA_GEOMETRY;
}

/** UI identity accents — presentation only, never civic data. */
export const NIGERIA_ACCENT = '#008751';
const STATE_ACCENTS: Record<string, string> = {
  Lagos: '#0E7C6B',
  Kano: '#1B7A3D',
  Rivers: '#1D5FBF',
};
export function accentForState(gadmName: string | null): string {
  if (!gadmName) return NIGERIA_ACCENT;
  return STATE_ACCENTS[gadmName] ?? '#5A6470';
}
