// lib/streetview/registry.ts — Street-level imagery provider ladder.
//
// Rung 1 (keyed): Google Maps Embed API, streetview mode. The Embed API is
// free with no usage limits, but every request needs an API key, so this rung
// is inert until NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY is set (referrer-restricted
// in the Google Cloud console — the key is public by design for embeds).
// Rung 2 (keyless): Wikimedia Commons geosearch — community photos near the
// point, with author/license/date where the file page supplies them.
// Rung 3 (always): keyless deep link opening the point in Google Street View.
//
// Street-level imagery is shown at capture time, never presented as live.
import type { StreetPhoto, StreetViewResult } from './types';

/** The free Embed API key, or null when not configured. Presence only. */
export function googleEmbedKey(): string | null {
  const k = (process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY || '').trim();
  return k ? k : null;
}

/** Google Maps Embed API, streetview mode. Free; key required. */
export function googleEmbedUrl(lat: number, lng: number, key: string): string {
  return (
    `https://www.google.com/maps/embed/v1/streetview` +
    `?key=${encodeURIComponent(key)}&location=${lat},${lng}&fov=90`
  );
}

/** Keyless deep link: opens the point in Google Street View (new tab). */
export function googlePanoLink(lat: number, lng: number): string {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, '').trim();
}

/** Parse a Wikimedia Commons geosearch response into StreetPhotos. Exported for tests. */
export function parseCommonsResponse(json: unknown): StreetPhoto[] {
  const pages = (json as { query?: { pages?: Record<string, unknown> } })?.query?.pages;
  if (!pages) return [];
  const photos: StreetPhoto[] = [];
  for (const p of Object.values(pages) as Array<{
    title?: string;
    imageinfo?: Array<{
      url?: string; thumburl?: string; descriptionurl?: string;
      extmetadata?: Record<string, { value?: string }>;
    }>;
  }>) {
    const info = p.imageinfo?.[0];
    if (!info?.url) continue;
    const meta = info.extmetadata ?? {};
    const val = (k: string): string | null => {
      const v = meta[k]?.value;
      return v ? stripHtml(v) : null;
    };
    photos.push({
      title: (p.title || 'Untitled').replace(/^File:/, ''),
      url: info.url,
      thumbUrl: info.thumburl || info.url,
      author: val('Artist'),
      license: val('LicenseShortName'),
      dateTaken: val('DateTimeOriginal'),
      filePageUrl: info.descriptionurl || '',
    });
  }
  return photos;
}

/** Keyless: geotagged photos near the point from Wikimedia Commons. */
export async function fetchCommonsPhotos(lat: number, lng: number, radiusM = 500): Promise<StreetPhoto[]> {
  const q = new URLSearchParams({
    action: 'query', format: 'json', origin: '*',
    generator: 'geosearch', ggscoord: `${lat}|${lng}`,
    ggsradius: String(radiusM), ggsnamespace: '6', ggslimit: '12',
    prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '640',
  });
  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${q.toString()}`);
  if (!res.ok) throw new Error(`Commons API responded ${res.status}`);
  return parseCommonsResponse(await res.json());
}

/**
 * Resolve street-level imagery for a point through the ladder.
 * Never throws for provider absence — the external-link rung always serves.
 */
export async function resolveStreetView(lat: number, lng: number): Promise<StreetViewResult> {
  const externalUrl = googlePanoLink(lat, lng);
  const key = googleEmbedKey();
  if (key) {
    return {
      kind: 'google-embed',
      providerName: 'Google Street View (embedded)',
      lat, lng,
      embedUrl: googleEmbedUrl(lat, lng, key),
      photos: [],
      externalUrl,
      notice:
        'Street View imagery is captured by Google on drive-by dates — it shows ' +
        'conditions at capture time, never live.',
    };
  }
  let photos: StreetPhoto[] = [];
  try {
    photos = await fetchCommonsPhotos(lat, lng);
  } catch {
    photos = [];
  }
  if (photos.length > 0) {
    return {
      kind: 'commons-photos',
      providerName: 'Wikimedia Commons (geotagged photos)',
      lat, lng,
      embedUrl: null,
      photos,
      externalUrl,
      notice:
        'Community-contributed photos near this point — author, license and capture ' +
        'date shown where the file page supplies them. Not a full panorama.',
    };
  }
  return {
    kind: 'external-link',
    providerName: 'Google Street View (external)',
    lat, lng,
    embedUrl: null,
    photos: [],
    externalUrl,
    notice:
      'No keyless street-level photos found near this point. Open the location in ' +
      'Google Street View instead — or add a free Google Maps Embed API key for ' +
      'in-app panoramas.',
  };
}
