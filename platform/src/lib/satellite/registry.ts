// Provider registry — the imagery ladder (Batch A).
//
// Providers are ordered rungs: open keyless first, then free-keyed, then
// metered commercial (inert until spend is approved). Resolution walks the
// ladder top-down and degrades gracefully: the first rung whose key
// requirement is satisfied serves the scene; every skipped rung is reported
// with an honest reason. The Esri stub is always the last rung, so the
// module never renders nothing.
//
// Per Lawal's 2026-09-29 decision: strictly keyless until the module proves
// itself — no signups, no metered tier. Sentinel-2 and Planet exist here as
// designed-but-inert rungs only.
import type {
  AreaOfInterest, CostTier, FallbackObservation, ImageryObservation,
  ProviderDescriptor, ProviderSkip, SatelliteProvider,
} from './types';
import { StubSatelliteProvider } from './stubProvider';

export interface RegisteredProvider {
  descriptor: ProviderDescriptor;
  /** Null when the rung is designed but not yet implemented. */
  create: (() => SatelliteProvider) | null;
}

const TIER_ORDER: Record<CostTier, number> = { 'open': 0, 'free-keyed': 1, 'metered': 2 };

function byLadderOrder(a: RegisteredProvider, b: RegisteredProvider): number {
  return (
    a.descriptor.rank - b.descriptor.rank ||
    TIER_ORDER[a.descriptor.costTier] - TIER_ORDER[b.descriptor.costTier] ||
    a.descriptor.id.localeCompare(b.descriptor.id)
  );
}

const ENTRIES: RegisteredProvider[] = [
  {
    descriptor: {
      id: 'sentinel-2-open',
      name: 'Sentinel-2 (open endpoint)',
      rank: 0,
      kind: 'open',
      keyRequirement: 'none',
      costTier: 'open',
      capabilities: '10 m true-colour, ~5-day revisit',
      maxResolutionM: 10,
      license: 'Contains Copernicus Sentinel data',
      coverageNote: 'Designed rung — not yet implemented. No signup needed when it lands.',
      implemented: false,
    },
    create: null,
  },
  {
    descriptor: {
      id: 'planet-commercial',
      name: 'Planet (commercial)',
      rank: 0,
      kind: 'commercial',
      keyRequirement: 'required',
      costTier: 'metered',
      capabilities: 'Daily ~3 m imagery via commercial subscription',
      maxResolutionM: 3,
      license: '© Planet Labs — commercial license required',
      coverageNote: 'Disabled until commercial spend is approved.',
      implemented: false,
    },
    create: null,
  },
  {
    descriptor: {
      id: 'stub-esri',
      name: 'Stub provider — Esri World Imagery basemap',
      rank: 10,
      kind: 'stub',
      keyRequirement: 'none',
      costTier: 'open',
      capabilities: 'Basemap stand-in; acquisition metadata not supplied',
      maxResolutionM: null,
      license: 'Imagery © Esri, Maxar, Earthstar Geographics (stub layer)',
      coverageNote: 'Honest stand-in: serves tiles, supplies no dates.',
      implemented: true,
    },
    create: () => new StubSatelliteProvider(),
  },
];

/** Providers that errored this session — skipped until the page reloads. */
const degradedThisSession = new Set<string>();

function keyPresent(providerId: string): boolean {
  // Presence flag ONLY — never a secret. Real keys live server-side
  // (spec §5). A '1' here means "a key was configured", nothing more.
  const flag = `NEXT_PUBLIC_SAT_KEY_${providerId.replace(/[^a-z0-9]/gi, '_').toUpperCase()}`;
  return process.env[flag] === '1';
}

function meteredEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SAT_METERED_ENABLED === '1';
}

function skipReason(entry: RegisteredProvider): string | null {
  const d = entry.descriptor;
  if (degradedThisSession.has(d.id)) return 'temporarily degraded this session after an error';
  // Tier gate before implementation state: a commercial rung stays honestly
  // "spend not approved" even once it is implemented.
  if (d.costTier === 'metered' && !meteredEnabled()) return 'commercial tier disabled — spend not approved';
  if (!d.implemented || !entry.create) return 'not yet implemented';
  if (d.keyRequirement === 'required' && !keyPresent(d.id)) return 'required key not configured';
  return null;
}

function orderedEntries(): RegisteredProvider[] {
  return [...ENTRIES].sort(byLadderOrder);
}

/** All registered rungs, in ladder order (preferred first). */
export function listProviders(): ProviderDescriptor[] {
  return orderedEntries().map((e) => e.descriptor);
}

/** Registered provider ids, in ladder order. Kept for backwards compatibility. */
export function listSatelliteProviders(): string[] {
  return listProviders().map((d) => d.id);
}

/**
 * Pinned lookup — explicit choice, or the NEXT_PUBLIC_SAT_PROVIDER override.
 * Behaviour unchanged: unknown or unimplemented ids throw.
 */
export function getSatelliteProvider(id?: string): SatelliteProvider {
  const key = id || process.env.NEXT_PUBLIC_SAT_PROVIDER || 'stub-esri';
  const entry = ENTRIES.find((e) => e.descriptor.id === key && e.create);
  if (!entry || !entry.create) throw new Error(`Unknown satellite provider: ${key}`);
  return entry.create();
}

/** Highest-ranked rung whose requirements are currently satisfied, or null. */
export function resolveActiveProvider(): SatelliteProvider | null {
  for (const entry of orderedEntries()) {
    if (skipReason(entry)) continue;
    if (entry.create) return entry.create();
  }
  return null;
}

/**
 * Resolve an observation through the ladder with graceful fallback.
 * Returns the serving provider plus every skipped rung and why it was
 * skipped — the provenance trail the UI discloses (spec §4).
 */
export async function getObservationWithFallback(
  aoi: AreaOfInterest,
): Promise<FallbackObservation> {
  const skipped: ProviderSkip[] = [];
  for (const entry of orderedEntries()) {
    const reason = skipReason(entry);
    if (reason) {
      skipped.push({ providerId: entry.descriptor.id, reason });
      continue;
    }
    try {
      const observation: ImageryObservation | null = await entry.create!().catalog().getLatest(aoi);
      if (!observation) {
        skipped.push({ providerId: entry.descriptor.id, reason: 'no observation for this area' });
        continue;
      }
      return {
        observation,
        providerId: entry.descriptor.id,
        providerName: entry.descriptor.name,
        skipped,
      };
    } catch (err) {
      degradedThisSession.add(entry.descriptor.id);
      skipped.push({
        providerId: entry.descriptor.id,
        reason: `error: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }
  throw new Error('No satellite provider could serve an observation.');
}

/** Test-only seam: add a rung for this process. */
export function testOnly_register(entry: RegisteredProvider): void {
  ENTRIES.push(entry);
}

/** Test-only seam: drop a previously test-registered rung. */
export function testOnly_remove(id: string): void {
  const i = ENTRIES.findIndex((e) => e.descriptor.id === id);
  if (i >= 0) ENTRIES.splice(i, 1);
}

/** Test-only seam: clear session degradation marks. */
export function testOnly_clearDegraded(): void {
  degradedThisSession.clear();
}
