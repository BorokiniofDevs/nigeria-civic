'use client';
import { useCivic } from '@/state/CivicContext';

/** Overlay shown while satellite mode is active: honest imagery labelling. */
export default function SatelliteBanner() {
  const { satellite, exitSatelliteView } = useCivic();
  if (!satellite.active) return null;

  return (
    <div className="sat-banner" role="status">
      <div className="k">MOST RECENT AVAILABLE IMAGERY</div>
      <div className="sub">
        {satellite.providerName ?? 'Provider not available'}
        {' · '}Acquisition date: {satellite.observation?.acquisitionDate ?? 'not supplied by current provider (stub)'}
      </div>
      <button className="btn-ghost" onClick={exitSatelliteView}>
        Return to civic map
      </button>
    </div>
  );
}
