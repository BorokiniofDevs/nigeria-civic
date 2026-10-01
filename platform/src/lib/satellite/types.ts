// Satellite / Earth-observation abstraction.
// The platform is NEVER hard-coded to one imagery provider. Providers are
// registered in registry.ts and implement SatelliteProvider. UI copy must
// follow the honesty rules: "latest available observation", never "live".
import type { LngLat } from '@/lib/geo';

export type ProviderKind = 'open' | 'commercial' | 'tasking' | 'stub';

/** A geographic area of interest, e.g. a project site polygon. */
export interface AreaOfInterest {
  id: string;
  name: string;
  /** Ring coordinates of the AOI polygon. */
  polygon: LngLat[][];
  /** Provenance label, e.g. "Sample AOI — fixture". */
  label: string;
}

/** One image acquisition over an area. */
export interface ImageryCapture {
  id: string;
  providerId: string;
  /** ISO date of acquisition. NULL when the provider does not supply one —
   *  the UI must say so explicitly, never invent a date. */
  acquisitionDate: string | null;
  cloudCoverPct: number | null;
  /** Ground resolution in metres, when known. */
  resolutionM: number | null;
}

/** A single map tile from a capture (for tiled providers). */
export interface ImageryTile {
  z: number; x: number; y: number;
  url: string;
}

/** An observation the UI can render: capture + how to fetch its pixels. */
export interface ImageryObservation extends ImageryCapture {
  /** XYZ tile template, or null when the provider serves scenes differently. */
  tileTemplate: string | null;
  attribution: string;
  /** Honesty note, e.g. why the acquisition date is missing. */
  note?: string;
}

/** Observations grouped for the timeline UI. */
export interface HistoricalObservation {
  year: number;
  observations: ImageryObservation[];
}

/** A machine-detected candidate change between two observations.
 *  Presented as "detected change" — NEVER auto-translated into
 *  "government project completed". */
export type ChangeKind =
  | 'new_structure' | 'road_construction' | 'road_expansion'
  | 'land_disturbance' | 'flood_extent' | 'vegetation_change'
  | 'construction_activity';

export interface DetectedChange {
  kind: ChangeKind;
  /** 0..1 model confidence. */
  confidence: number;
  /** Evidence-only wording, e.g. "New rectangular structure visible". */
  description: string;
}

export interface ChangeDetectionResult {
  id: string;
  aoiId: string;
  beforeObservationId: string;
  afterObservationId: string;
  status: 'complete' | 'pending' | 'unavailable';
  detections: DetectedChange[];
  note?: string;
}

/** Read access to a provider's imagery for an AOI. */
export interface ImageryCatalog {
  /** Most recent observation, or null when none exists. */
  getLatest(aoi: AreaOfInterest): Promise<ImageryObservation | null>;
  /** Full history for the timeline UI. */
  getHistory(aoi: AreaOfInterest): Promise<HistoricalObservation[]>;
}

/** A satellite imagery provider. */
export interface SatelliteProvider {
  id: string;
  name: string;
  kind: ProviderKind;
  catalog(): ImageryCatalog;
}

/** Future computer-vision change analysis over two observations. */
export interface ChangeDetector {
  id: string;
  analyze(before: ImageryObservation, after: ImageryObservation): Promise<ChangeDetectionResult>;
}

// ---------------------------------------------------------------------------
// Provider ladder (Batch A). The registry orders providers by rank and degrades
// gracefully: the first rung whose key requirement is satisfied and whose cost
// tier is permitted serves the scene. Rungs above it are reported as skipped
// with an honest reason — degradation is visible, never silent.
// ---------------------------------------------------------------------------

/** Cost tier of a provider. Metered providers stay inert until spend is approved. */
export type CostTier = 'open' | 'free-keyed' | 'metered';

/** What a provider needs before it can serve imagery. */
export type KeyRequirement = 'none' | 'optional' | 'required';

/** Static description of a registered provider — one rung of the ladder. */
export interface ProviderDescriptor {
  id: string;
  name: string;
  /** Position in the degradation ladder; lower = preferred. */
  rank: number;
  kind: ProviderKind;
  keyRequirement: KeyRequirement;
  costTier: CostTier;
  /** Plain-words capability, e.g. "10 m true-colour, ~5-day revisit". */
  capabilities: string;
  /** Highest resolution the provider publishes, metres/px, or null if unknown. */
  maxResolutionM: number | null;
  /** License/attribution string, e.g. "Contains Copernicus Sentinel data". */
  license: string;
  /** Honest coverage note, e.g. "Cloud cover common over Lagos in rainy season". */
  coverageNote?: string;
  /** False for rungs that are designed but not yet implemented. */
  implemented: boolean;
}

/** Why a ladder rung was skipped during resolution. */
export interface ProviderSkip {
  providerId: string;
  reason: string;
}

/** An observation resolved through the ladder, with its provenance trail. */
export interface FallbackObservation {
  observation: ImageryObservation;
  /** The provider that actually served the scene. */
  providerId: string;
  providerName: string;
  /** Rungs skipped above the serving provider, in order, with reasons. */
  skipped: ProviderSkip[];
}
