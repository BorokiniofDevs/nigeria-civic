'use client';
import { useCivic } from '@/state/CivicContext';

const LAYERS: { key: string; label: string }[] = [
  { key: 'boundaries', label: 'Boundaries' },
  { key: 'facilities', label: 'Facilities' },
  { key: 'projects', label: 'Projects' },
  { key: 'reports', label: 'Reports' },
];

export default function LayerRail() {
  const { layers, toggleLayer, setDrawerOpen, satellite, setReportFlowOpen, setModeratorOpen, setOfficialsOpen, setStreetViewOpen, setProjectsOpen } = useCivic();

  return (
    <aside id="rail">
      <div className="grp">
        <h4>CITIZEN REPORTS</h4>
        <button className="btn btn-primary btn-block" onClick={() => setReportFlowOpen(true)}>
          Report an observation
        </button>
        <button className="btn-ghost" onClick={() => setModeratorOpen(true)}>
          Moderation · <span className="dev-tag">DEV</span>
        </button>
      </div>
      <div className="grp">
        <h4>GOVERNMENT</h4>
        <button className="btn-ghost" onClick={() => setOfficialsOpen(true)}>
          Officials directory
        </button>
      </div>
      <div className="grp">
        <h4>VIEWS</h4>
        <button className="btn-ghost" onClick={() => setStreetViewOpen(true)}>
          Street view
        </button>
        <button className="btn-ghost" onClick={() => setProjectsOpen(true)}>
          Ongoing projects
        </button>
      </div>
      <div className="grp">
        <h4>LAYERS</h4>
        {LAYERS.map((l) => (
          <label className="lyr" key={l.key}>
            <input
              type="checkbox"
              checked={layers[l.key] !== false}
              onChange={() => toggleLayer(l.key)}
              disabled={satellite.active}
            /> {l.label}
          </label>
        ))}
      </div>
      <div className="grp">
        <h4>LEGEND</h4>
        <div className="legend"><span className="sw sw-fac" /> Facility</div>
        <div className="legend"><span className="sw sw-prj" /> Project</div>
        <div className="legend"><span className="sw sw-rep" /> Citizen report</div>
        <div className="legend"><span className="sw sw-lcda" /> LCDA / ward (illustrative)</div>
        {satellite.active && (
          <div className="legend"><span className="sw sw-aoi" /> Project AOI</div>
        )}
      </div>
      <div className="grp">
        <h4>EMERGENCY</h4>
        <div className="legend"><a className="link" href="tel:112">112</a><span className="t-sub"> — national</span></div>
        <div className="legend"><a className="link" href="tel:767">767</a><span className="t-sub"> — Lagos</span></div>
        <div className="legend"><a className="link" href="tel:122">122</a><span className="t-sub"> — FRSC</span></div>
      </div>
      <div className="grp">
        <h4>ABOUT</h4>
        <button className="btn-ghost" onClick={() => setDrawerOpen(true)}>
          Data &amp; provenance
        </button>
      </div>
    </aside>
  );
}
