// lib/civic/store.ts — The data contract between the map UI and civic records.
// The production PostGIS backend implements this interface 1:1; the current
// build wires it to real GADM geographic entities only — zero non-geographic
// civic records are seeded.
// The UI never reaches past this interface for civic content.
import type { CivicEntity, EntityDetail, SearchGroup } from './types';

export interface CivicStore {
  /** Fetch one entity by stable id. */
  getEntity(id: string): CivicEntity | undefined;
  /** Direct children in the hierarchy (state→LGAs, LGA→LCDAs, …). */
  childrenOf(parentId: string): CivicEntity[];
  /** Root → entity lineage for breadcrumbs and "where am I". */
  lineageOf(id: string): CivicEntity[];
  /** Entity + claims + sources + history + children, in canonical order. */
  getDetail(id: string): EntityDetail | undefined;
  /** Grouped geographic search. Never invents results. */
  search(query: string, limitPerGroup?: number): SearchGroup[];
  /** All top-level jurisdictions (states + FCT). */
  states(): CivicEntity[];
}
