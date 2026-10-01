'use client';
import { useCivic } from '@/state/CivicContext';

/** Project → satellite observation: timeline, before/after, evidence framing. */
export default function SatellitePanel() {
  const { satellite, exitSatelliteView } = useCivic();
  const obs = satellite.observation;

  return (
    <div className="panel-body">
      <div className="p-head">
        <div className="mono" style={{ letterSpacing: '0.1em', color: 'var(--ink-3)', marginBottom: 6 }}>
          VIEW FROM SATELLITE
        </div>
        <h1 style={{ fontSize: 21 }}>{satellite.projectName}</h1>
        <p className="sub">Project → area of interest → satellite observation</p>
      </div>
      <div className="accent-bar" style={{ background: '#FFD400' }} />

      <div className="sec">
        <div className="sec-h"><span>Evidence note</span></div>
        <div className="sat-evidence">
          Satellite imagery shows physical conditions at the observed location. It can
          corroborate that a structure or activity is visible — it does not independently
          establish who financed, commissioned or constructed a project.
        </div>
      </div>

      <div className="sec">
        <div className="sec-h"><span>Observation</span><span className="src">{satellite.providerName}</span></div>
        <dl className="kv">
          <div><dt>Imagery</dt><dd>Most recent available imagery</dd></div>
          <div>
            <dt>Acquisition date</dt>
            <dd>{obs?.acquisitionDate ?? 'Not supplied by current provider (stub)'}</dd>
          </div>
          <div>
            <dt>Cloud cover</dt>
            <dd>{obs?.cloudCoverPct != null ? `${obs.cloudCoverPct}%` : 'Not supplied (stub)'}</dd>
          </div>
          <div>
            <dt>Resolution</dt>
            <dd>{obs?.resolutionM != null ? `${obs.resolutionM} m/px` : 'Not supplied (stub)'}</dd>
          </div>
          <div><dt>Area of interest</dt><dd>{satellite.aoi?.label ?? '—'}</dd></div>
        </dl>
        {obs?.note && <p className="note">{obs.note}</p>}
      </div>

      <div className="sec">
        <div className="sec-h"><span>Satellite sources tried</span></div>
        <p className="note" style={{ marginTop: 0 }}>
          Served by <strong>{satellite.providerName ?? '—'}</strong>. Each source is tried in
          turn; the freshest available image wins. Skipped sources and why:
        </p>
        {satellite.providerSkips.length === 0 ? (
          <p className="t-sub">First source served — nothing skipped.</p>
        ) : (
          <ul className="skip-trail">
            {satellite.providerSkips.map((s) => (
              <li key={s.providerId}>
                <span className="mono">{s.providerId}</span>
                <span className="t-sub"> — {s.reason}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="sec">
        <div className="sec-h"><span>Timeline</span></div>
        <ul className="timeline">
          <li>
            <strong>Latest observation</strong>
            <div className="t-sub">
              {obs?.acquisitionDate ?? 'Date not supplied by stub provider'} · {satellite.providerName}
            </div>
          </li>
        </ul>
        <p className="note">
          Historical observations will appear here once a production imagery provider
          is registered. Each entry is tied to its actual acquisition date.
        </p>
      </div>

      <div className="sec">
        <div className="sec-h"><span>Before / after comparison</span></div>
        <p className="note" style={{ marginTop: 0 }}>
          Unavailable in this build: comparison requires at least two dated
          observations of this area of interest. The stub provider supplies a single
          undated layer.
        </p>
      </div>

      <div className="sec">
        <button className="btn" onClick={exitSatelliteView}>Return to civic map</button>
      </div>
    </div>
  );
}
