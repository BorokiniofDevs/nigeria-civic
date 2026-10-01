'use client';
import { useCivic } from '@/state/CivicContext';
import { civicStore } from '@/lib/civic';
import { stateDisplayName } from '@/lib/geo';
import SearchBox from './SearchBox';

function gadmNameOf(display: string): string {
  return display === 'Federal Capital Territory' ? display : display.replace(/ State$/, '');
}

export default function SiteHeader() {
  const { view, accent, selectState, goToLevel } = useCivic();
  const states = civicStore.states();

  const label =
    view.level === 'country' ? 'Nigeria'
    : view.state ? `${stateDisplayName(view.state)}${view.lga ? ` › ${view.lga}` : ''}`
    : 'Nigeria';

  return (
    <header>
      <span className="wordmark">NIGERIA CIVIC INTELLIGENCE</span>
      <span className="proto-tag">DEV BUILD</span>
      <SearchBox />
      <span className="sp" />
      <span className="sample-badge">DEV BUILD · NO CIVIC RECORDS LOADED</span>
      <select
        className="state-select"
        aria-label="Jump to state"
        value={view.state ?? 'ng'}
        onChange={(e) => {
          if (e.target.value === 'ng') goToLevel('country');
          else selectState(e.target.value);
        }}
      >
        <option value="ng">Nigeria — all states</option>
        {states.map((s) => {
          const gadm = gadmNameOf(s.name);
          return <option key={s.id} value={gadm}>{s.name}</option>;
        })}
      </select>
      <span className="state-label" style={{ borderLeftColor: accent }}>{label}</span>
    </header>
  );
}
