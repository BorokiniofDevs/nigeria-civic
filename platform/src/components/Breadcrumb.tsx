'use client';
import { useEffect } from 'react';
import { useCivic } from '@/state/CivicContext';
import { civicStore } from '@/lib/civic';
import type { Level } from '@/lib/view';

export default function Breadcrumb() {
  const {
    view, detail, satellite, goToLevel, closeDetail, exitSatelliteView,
  } = useCivic();

  // Esc = backtrack one geographic level (or close detail / exit satellite).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (satellite.active) { exitSatelliteView(); return; }
      if (detail) { closeDetail(); return; }
      const parent: Record<Level, Level | null> = {
        ward: 'lcda', lcda: 'lga', lga: 'state', state: 'country', country: null,
      };
      const p = parent[view.level];
      if (p) goToLevel(p);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view.level, detail, satellite.active, goToLevel, closeDetail, exitSatelliteView]);

  const crumbs: { label: string; level: Level; current: boolean }[] = [
    { label: 'Nigeria', level: 'country', current: view.level === 'country' },
  ];
  if (view.state) {
    const name = view.state === 'Federal Capital Territory' ? view.state : `${view.state} State`;
    crumbs.push({ label: name, level: 'state', current: view.level === 'state' });
  }
  if (view.lga) crumbs.push({ label: `${view.lga} LGA`, level: 'lga', current: view.level === 'lga' });
  if (view.lcda) {
    const e = civicStore.getEntity(view.lcda);
    crumbs.push({ label: e ? e.name : 'LCDA', level: 'lcda', current: view.level === 'lcda' });
  }
  if (view.ward) {
    const e = civicStore.getEntity(view.ward);
    crumbs.push({ label: e ? e.name : 'Ward', level: 'ward', current: view.level === 'ward' });
  }

  return (
    <nav id="crumbs" aria-label="Geographic breadcrumb">
      {crumbs.map((c, i) => (
        <span key={c.level}>
          {i > 0 && <span className="sep"> › </span>}
          {c.current ? (
            <span className="crumb current" aria-current="page">{c.label}</span>
          ) : (
            <button className="crumb" onClick={() => goToLevel(c.level)}>{c.label}</button>
          )}
        </span>
      ))}
      {satellite.active && (
        <span>
          <span className="sep"> › </span>
          <span className="sat-crumb">SATELLITE VIEW</span>
        </span>
      )}
    </nav>
  );
}
