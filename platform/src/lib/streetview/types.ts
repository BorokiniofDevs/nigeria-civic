// lib/streetview/types.ts — Street-level imagery provider ladder.
//
// Ladder: Google Maps Embed (keyed rung — free Embed API, key required) →
// Wikimedia Commons geotagged photos (keyless) → external Google Maps pano
// link (always available). Keys are upgrades, not prerequisites: without a
// key the module stays fully usable, never blank.
export type StreetViewKind = 'google-embed' | 'commons-photos' | 'external-link';

/** One community-contributed street-level photo near the point. */
export interface StreetPhoto {
  title: string;
  url: string;
  thumbUrl: string;
  author: string | null;
  license: string | null;
  dateTaken: string | null;
  filePageUrl: string;
}

export interface StreetViewResult {
  kind: StreetViewKind;
  providerName: string;
  lat: number;
  lng: number;
  /** google-embed only. */
  embedUrl: string | null;
  /** commons-photos only. */
  photos: StreetPhoto[];
  /** Always present: keyless "open in Google Street View" deep link. */
  externalUrl: string;
  /** Honest capture-time label for the serving provider. */
  notice: string;
}
