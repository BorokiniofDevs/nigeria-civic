'use client';
import { useCivic } from '@/state/CivicContext';
import { listProjects, statusLabel } from '@/lib/civic/projectService';

const LAGOS = 'geo:state:NGA.25_1';

/**
 * Ongoing projects in Lagos: sourced project records with their status
 * claims, sources, and a "View from satellite" action per project.
 * Satellite viewing resolves through the provider ladder with fallback,
 * so the freshest available satellite source serves each area.
 */
export default function ProjectsPanel() {
  const { setProjectsOpen, enterSatelliteView } = useCivic();
  const projects = listProjects(LAGOS);

  return (
    <div className="overlay" role="dialog" aria-label="Ongoing projects">
      <div className="sheet sheet-wide">
        <div className="sheet-head">
          <div>
            <h3>Ongoing projects — Lagos</h3>
            <p className="t-sub">
              Sourced project records. Locations are approximate corridor midpoints
              for viewing, not surveyed points. Satellite imagery is shown at
              capture time, never live.
            </p>
          </div>
          <button className="btn-ghost" onClick={() => setProjectsOpen(false)}>Close</button>
        </div>

        {projects.length === 0 && (
          <p className="t-sub">No project records loaded for this jurisdiction yet.</p>
        )}

        <div className="proj-list">
          {projects.map((p) => (
            <article key={p.id} className="proj-card">
              <div className="proj-head">
                <h4>{p.name}</h4>
                <span className="proj-status">{statusLabel(p.status)}</span>
              </div>
              <p className="t-sub">{p.statusNote}</p>
              <div className="kv-inline">
                <span className="t-sub mono">
                  {p.lat.toFixed(2)}, {p.lng.toFixed(2)} · {p.coordinatePrecision}
                </span>
                <span className="istate istate-source">Source-backed · pending verification</span>
              </div>
              <p className="t-sub">{p.locationNote}</p>
              {p.amount && (
                <div className="proj-amount">
                  <div className="sec-h"><span>Sourced amount</span></div>
                  <div className="proj-amount__figure">{p.amount.text}</div>
                  <p className="t-sub">{p.amount.note}</p>
                  <p className="t-sub">
                    Source:{' '}
                    <a href={p.amount.sourceUrl} target="_blank" rel="noreferrer" className="link">
                      {p.amount.sourceLabel}
                    </a>
                    {' '}— checked {p.amount.checkedAt}
                  </p>
                </div>
              )}
              <div className="proj-sources">
                <div className="sec-h"><span>Sources</span></div>
                <ul>
                  {p.sources.map((s) => (
                    <li key={s.url}>
                      <a href={s.url} target="_blank" rel="noreferrer" className="link">{s.name}</a>
                      <span className="t-sub"> — checked {s.checkedAt}</span>
                      <div className="t-sub">{s.note}</div>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="off-bar" style={{ marginTop: 8 }}>
                <button className="btn" onClick={() => { void enterSatelliteView(p.id); }}>
                  View from satellite
                </button>
                <span className="t-sub">Tries each satellite source in turn; serves the freshest available image.</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
