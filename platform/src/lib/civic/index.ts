// lib/civic/index.ts — Wires the CivicStore: real GADM jurisdictions only.
// Zero non-geographic civic records are seeded in this build. The production
// PostGIS backend replaces this wiring 1:1 behind the same CivicStore
// interface.
import type { CivicEntity, EntityDetail, SearchGroup } from './types';
import type { CivicStore } from './store';
import {
  COUNTRY_ID, getGeoEntity, geoChildrenOf, geoStates,
} from './geoEntities';
import { searchEntities } from './search';

function getEntity(id: string): CivicEntity | undefined {
  return getGeoEntity(id);
}

function childrenOf(parentId: string): CivicEntity[] {
  return geoChildrenOf(parentId);
}

function lineageOf(id: string): CivicEntity[] {
  const chain: CivicEntity[] = [];
  let cur = getEntity(id);
  while (cur?.parentId) {
    const parent = getEntity(cur.parentId);
    if (!parent) break;
    chain.unshift(parent);
    cur = parent;
  }
  return chain;
}

function getDetail(id: string): EntityDetail | undefined {
  const entity = getEntity(id);
  if (!entity) return undefined;
  return {
    entity,
    lineage: lineageOf(id),
    claims: [],
    children: childrenOf(id),
  };
}

function allEntities(): CivicEntity[] {
  // geoEntities module keeps its own map; reconstruct via traversal.
  const out: CivicEntity[] = [];
  const walk = (id: string) => {
    const e = getEntity(id);
    if (!e || out.includes(e)) return;
    out.push(e);
    for (const c of childrenOf(id)) walk(c.id);
  };
  walk(COUNTRY_ID);
  return out;
}

export const civicStore: CivicStore = {
  getEntity,
  childrenOf,
  lineageOf,
  getDetail,
  states: geoStates,
  search: (query: string, limitPerGroup?: number): SearchGroup[] =>
    searchEntities(query, allEntities(), getEntity, limitPerGroup),
};
