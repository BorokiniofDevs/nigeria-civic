'use client';
import { useEffect, useRef } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useCivic } from '@/state/CivicContext';
import SatelliteBanner from './SatelliteBanner';

export default function CivicMap() {
  const ref = useRef<HTMLDivElement>(null);
  const bindMap = useCivic().bindMap;

  useEffect(() => {
    if (!ref.current) return;
    const unbind = bindMap(ref.current);
    return unbind;
  }, [bindMap]);

  return (
    <div id="mapWrap">
      <div ref={ref} id="map" />
      <SatelliteBanner />
      <div className="map-note">
        Boundaries: GADM v4.1 · No civic records loaded in this build
      </div>
    </div>
  );
}
