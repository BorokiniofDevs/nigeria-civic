// Geographic primitives: real GADM v4.1 boundaries, bbox math, feature lookup.
import statesJson from '@/data/nigeria-states.json';
import lgasJson from '@/data/lagos-lgas.json';

export type LngLat = [number, number];
export type Bounds = [LngLat, LngLat]; // [[w,s],[e,n]]

export interface GeoFeature {
  type: 'Feature';
  id?: string | number;
  properties: { id: string; name: string; gadm?: string; [k: string]: unknown };
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown };
}
export interface FeatureCollection {
  type: 'FeatureCollection';
  features: GeoFeature[];
}

export const STATES = statesJson as unknown as FeatureCollection;
export const LAGOS_LGAS = lgasJson as unknown as FeatureCollection;

export const NIGERIA_BOUNDS: Bounds = [[2.6, 4.1], [14.8, 14.0]];

export function bboxOf(feature: GeoFeature): [number, number, number, number] {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  const pt = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === 'number') {
      const [x, y] = c as [number, number];
      if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y;
      if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y;
    } else if (Array.isArray(c)) {
      for (const sub of c) pt(sub);
    }
  };
  pt(feature.geometry.coordinates);
  return b as [number, number, number, number];
}

export function boundsOfFeature(feature: GeoFeature): Bounds {
  const b = bboxOf(feature);
  return [[b[0], b[1]], [b[2], b[3]]];
}

export function featureByName(list: GeoFeature[], name: string): GeoFeature | undefined {
  return list.find((f) => f.properties.name === name);
}

export function stateDisplayName(name: string): string {
  return name === 'Federal Capital Territory' ? name : `${name} State`;
}

/** Small rectangular AOI polygon around a point — pure geometry helper. */
export function aoiAround(pt: LngLat, halfDeg = 0.004): LngLat[][] {
  const [lng, lat] = pt;
  return [[
    [lng - halfDeg, lat - halfDeg], [lng + halfDeg, lat - halfDeg],
    [lng + halfDeg, lat + halfDeg], [lng - halfDeg, lat + halfDeg],
    [lng - halfDeg, lat - halfDeg],
  ]];
}
