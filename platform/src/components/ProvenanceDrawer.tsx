'use client';
// ProvenanceDrawer — the honesty panel. States exactly what is real, what is
// pending, and what the production backend will add.
import { useCivic } from '@/state/CivicContext';

export default function ProvenanceDrawer() {
  const { drawerOpen, setDrawerOpen } = useCivic();
  if (!drawerOpen) return null;

  return (
    <div className="drawer" role="dialog" aria-label="Data and provenance" onClick={() => setDrawerOpen(false)}>
      <div className="drawer-in" onClick={(e) => e.stopPropagation()}>
        <h2>Data &amp; provenance</h2>
        <p className="sub" style={{ color: 'var(--ink-2)', fontSize: 13 }}>
          What is real, what is pending, and what the production backend will add.
        </p>

        <div className="sec">
          <div className="sec-h"><span>Real data in this build</span></div>
          <dl className="kv">
            <div><dt>Country &amp; state boundaries</dt><dd>GADM v4.1 (gadm.org)</dd></div>
            <div><dt>Lagos LGA boundaries</dt><dd>GADM v4.1 — 20 constitutional LGAs</dd></div>
            <div><dt>Basemap</dt><dd>© OpenStreetMap contributors © CARTO</dd></div>
            <div><dt>Satellite basemap</dt><dd>© Esri, Maxar, Earthstar Geographics (stub layer)</dd></div>
          </dl>
        </div>

        <div className="sec">
          <div className="sec-h"><span>Not in this build</span></div>
          <dl className="kv">
            <div><dt>Civic records</dt><dd>Zero non-geographic records — no facilities, projects, reports, or officials are seeded. Panels report empty states honestly.</dd></div>
            <div><dt>LCDA &amp; ward boundaries</dt><dd>Illustrative positions — official boundary data pending</dd></div>
            <div><dt>State identity accents</dt><dd>UI fixtures — official colours/emblems pending verified source</dd></div>
            <div><dt>Satellite integration</dt><dd>Stub provider — dates, history and change detection pending</dd></div>
          </dl>
        </div>

        <div className="sec">
          <div className="sec-h"><span>Information states</span></div>
          <p className="note">
            Every record carries one of seven states: Not available, Citizen-submitted,
            Source-backed · pending verification, Verified, Disputed, Outdated, Rejected.
            A database row existing is not proof of verification — only
            identifiable source evidence plus an explicit verification event
            can move a claim to verified.
          </p>
        </div>

        <div className="sec">
          <div className="sec-h"><span>Production path</span></div>
          <p className="note">
            The civic store interface is the seam the PostGIS backend will
            serve — same shapes, no interaction rewrite needed. The backend
            supplies real entities, claims, sources and history; nothing is
            seeded in the frontend.
          </p>
        </div>

        <button className="btn" onClick={() => setDrawerOpen(false)}>Close</button>
      </div>
    </div>
  );
}
