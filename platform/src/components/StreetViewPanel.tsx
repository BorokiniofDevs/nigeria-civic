'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useCivic } from '@/state/CivicContext';
import { mapController } from '@/lib/mapController';
import { resolveStreetView } from '@/lib/streetview/registry';
import type { StreetViewResult } from '@/lib/streetview/types';

type Phase = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Street view overlay: street-level imagery for a chosen point, resolved
 * through the provider ladder (Google Embed when keyed, Wikimedia Commons
 * photos keylessly, external Google Street View link always).
 *
 * Reads the map only through mapController's public API (getCamera for the
 * centre, pick mode for point selection) — map internals are untouched.
 */
export default function StreetViewPanel() {
  const { setStreetViewOpen, startLocationPick, stopLocationPick, setPickMarker } = useCivic();
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<StreetViewResult | null>(null);
  const [picking, setPicking] = useState(false);
  const mounted = useRef(true);

  const load = useCallback(async (lat: number, lng: number) => {
    setPhase('loading');
    setResult(null);
    try {
      const r = await resolveStreetView(lat, lng);
      if (!mounted.current) return;
      setResult(r);
      setPhase('ready');
    } catch {
      if (mounted.current) setPhase('error');
    }
  }, []);

  const loadMapCentre = useCallback(() => {
    try {
      const cam = mapController.getCamera();
      const [lng, lat] = cam.center;
      setPickMarker([lng, lat]);
      void load(lat, lng);
    } catch {
      setPhase('error');
    }
  }, [load, setPickMarker]);

  const pickOnMap = useCallback(() => {
    setPicking(true);
    startLocationPick(([lng, lat]) => {
      stopLocationPick();
      setPicking(false);
      setPickMarker([lng, lat]);
      void load(lat, lng);
    });
  }, [startLocationPick, stopLocationPick, setPickMarker, load]);

  const close = useCallback(() => {
    stopLocationPick();
    setPicking(false);
    setPickMarker(null);
    setStreetViewOpen(false);
  }, [stopLocationPick, setPickMarker, setStreetViewOpen]);

  useEffect(() => {
    mounted.current = true;
    // Deferred so the initial load doesn't set state synchronously in the effect.
    const t = setTimeout(() => { loadMapCentre(); }, 0);
    return () => {
      mounted.current = false;
      clearTimeout(t);
      stopLocationPick();
      setPickMarker(null);
    };
  }, [loadMapCentre, stopLocationPick, setPickMarker]);

  return (
    <div className="overlay" role="dialog" aria-label="Street view">
      <div className="sheet sheet-wide">
        <div className="sheet-head">
          <div>
            <h3>Street view</h3>
            <p className="t-sub">
              Street-level imagery for a chosen point.{' '}
              {result ? result.notice : 'Resolving the best available provider…'}
            </p>
          </div>
          <button className="btn-ghost" onClick={close}>Close</button>
        </div>

        <div className="off-bar">
          <button className="btn-ghost" onClick={loadMapCentre}>Use map centre</button>
          <button className="btn-ghost" onClick={pickOnMap} disabled={picking}>
            {picking ? 'Click a point on the map…' : 'Pick a point on the map'}
          </button>
          {result && (
            <span className="t-sub mono">
              {result.lat.toFixed(5)}, {result.lng.toFixed(5)} · {result.providerName}
            </span>
          )}
        </div>

        {phase === 'loading' && <p className="t-sub">Loading street-level imagery…</p>}
        {phase === 'error' && (
          <p className="warn-inline">Could not load street view for this point. Try another point.</p>
        )}

        {phase === 'ready' && result && (
          <>
            {result.kind === 'google-embed' && result.embedUrl && (
              <iframe
                title="Google Street View"
                src={result.embedUrl}
                className="sv-embed"
                loading="lazy"
                referrerPolicy="no-referrer"
                allowFullScreen
              />
            )}

            {result.kind !== 'google-embed' && result.photos.length > 0 && (
              <div className="sv-photos">
                {result.photos.map((p) => (
                  <figure key={p.url} className="sv-photo">
                    <a href={p.filePageUrl || p.url} target="_blank" rel="noreferrer">
                      <img src={p.thumbUrl} alt={p.title} loading="lazy" />
                    </a>
                    <figcaption>
                      <div className="sv-title">{p.title}</div>
                      <div className="t-sub">
                        {[p.author, p.license, p.dateTaken].filter(Boolean).join(' · ') ||
                          'Attribution not supplied by source'}
                      </div>
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}

            <div className="off-bar" style={{ marginTop: 12 }}>
              <a className="btn-ghost" href={result.externalUrl} target="_blank" rel="noreferrer">
                Open in Google Street View ↗
              </a>
              <span className="t-sub">Imagery © its provider — shown at capture time, never live.</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
