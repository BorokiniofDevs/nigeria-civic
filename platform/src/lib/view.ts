// View-state types shared by the map controller and React state.
import type { EntityKind } from './civic/types';

export type Level = 'country' | 'state' | 'lga' | 'lcda' | 'ward';

export interface ViewState {
  level: Level;
  /** GADM state name, e.g. 'Lagos'. */
  state: string | null;
  /** GADM LGA name, e.g. 'Kosofe'. */
  lga: string | null;
  /** Civic entity id, e.g. 'geo:lcda:agboyi-ketu'. */
  lcda: string | null;
  /** Civic entity id, e.g. 'geo:lcda:agboyi-ketu:ward-01'. */
  ward: string | null;
}

/** Detail selection now addresses any civic entity kind. */
export type ItemKind = EntityKind;

export interface DetailSel {
  kind: ItemKind;
  id: string;
}

export const COUNTRY_VIEW: ViewState = {
  level: 'country', state: null, lga: null, lcda: null, ward: null,
};

export interface CameraState {
  center: [number, number];
  zoom: number;
}
