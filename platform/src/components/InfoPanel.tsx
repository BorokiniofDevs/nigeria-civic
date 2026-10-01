'use client';
// InfoPanel — the geographic information panel. Every view follows the
// ENTITY → CLAIM → SOURCE → STATE → HISTORY model. Where information is
// absent, the panel says so honestly: "Information not currently available".
import React from 'react';
import { useCivic } from '@/state/CivicContext';
import ReportDetail from '@/components/ReportDetail';
import { civicStore } from '@/lib/civic';
import { reportService } from '@/lib/civic/reportService';
import { stateDisplayName } from '@/lib/geo';
import {
  COUNTRY_ID, hasLgaGeometry, jurisdictionIdForView,
} from '@/lib/civic/geoEntities';
import { KIND_LABEL } from '@/lib/civic/search';
import { INFORMATION_STATE_LABEL } from '@/lib/provenance';
import type {
  CivicClaim, CivicEntity, CivicEvent, EntityDetail, InformationState,
} from '@/lib/civic/types';
import SatellitePanel from './SatellitePanel';
import type { DetailSel, ViewState } from '@/lib/view';

/* ---------- small building blocks ---------- */

function Sec({ title, src, children }: { title: string; src?: string; children: React.ReactNode }) {
  return (
    <div className="sec">
      <div className="sec-h">
        <span>{title}</span>
        {src && <span className="src">{src}</span>}
      </div>
      {children}
    </div>
  );
}

function StateBadge({ state }: { state: InformationState }) {
  return <span className={`ist ist-${state}`}>{INFORMATION_STATE_LABEL[state]}</span>;
}

function KV({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="kv">
      {rows.map(([k, v]) => (
        <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
      ))}
    </dl>
  );
}

function Empty({ what }: { what: string }) {
  return <p className="note">Information not currently available — {what}.</p>;
}

/** Hierarchy path above the current jurisdiction: Nigeria › Lagos State. */
function Lineage({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return <div className="lineage">{items.join(' › ')}</div>;
}

/**
 * Live civic activity for this browser session. Real counts from the report
 * store, honestly labelled — hidden entirely when nothing has happened yet.
 */
function SessionActivity() {
  const { reportsVersion } = useCivic();
  void reportsVersion;
  const s = reportService.stats();
  if (s.reports === 0) return null;
  return (
    <div className="ctx-strip">
      <span className="ctx-strip__label">This session</span>
      <span>
        {s.reports} citizen report{s.reports === 1 ? '' : 's'}
        {' · '}{s.evidence} evidence item{s.evidence === 1 ? '' : 's'}
        {s.claims > 0 && <> · {s.claims} claim{s.claims === 1 ? '' : 's'}</>}
      </span>
    </div>
  );
}

function EntityRows({ items, onPick, activeId }: {
  items: CivicEntity[]; onPick: (e: CivicEntity) => void; activeId?: string;
}) {
  return (
    <div className="rows">
      {items.map((e) => (
        <div
          key={e.id}
          className={`row${e.id === activeId ? ' active' : ''}`}
          onClick={() => onPick(e)}
          role="button"
          tabIndex={0}
          onKeyDown={(ev) => { if (ev.key === 'Enter') onPick(e); }}
        >
          <div className="r-main">
            {e.name}
          </div>
          <div className="r-sub">
            {(KIND_LABEL[e.kind] ?? e.kind)} · <StateBadge state={e.informationState} />
          </div>
        </div>
      ))}
    </div>
  );
}

function SourceLine({ source, role, note }: {
  source: { name: string; sourceType: string; publisher?: string | null; publishedAt?: string | null };
  role: string;
  note?: string;
}) {
  return (
    <li>
      <span className="t-main">{source.name}</span>
      <span className="t-sub"> — {source.sourceType.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())} · {role.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())}</span>
      {source.publisher && <span className="t-sub"> · {source.publisher}</span>}
      {source.publishedAt && <span className="t-sub"> · {source.publishedAt.slice(0, 10)}</span>}
      {note && <div className="t-sub">{note}</div>}
    </li>
  );
}

export function ClaimCard({ claim }: { claim: CivicClaim }) {
  return (
    <div className="claim">
      <div className="claim__label">{claim.claimLabel}</div>
      <div className="claim__text">{claim.claimValue}</div>
      <div className="claim__meta">
        <StateBadge state={claim.informationState} />
        {claim.supersededBy && (
          <span className="t-sub">superseded — retained for audit</span>
        )}
      </div>
      {claim.sources.length > 0 && (
        <ul className="lst" style={{ marginTop: 8 }}>
          {claim.sources.map((l, i) => (
            <SourceLine key={i} source={l.source} role={l.role} note={l.note} />
          ))}
        </ul>
      )}
    </div>
  );
}

function History({ events }: { events: CivicEvent[] }) {
  if (!events.length) return <Empty what="no recorded history for this entity yet" />;
  const sorted = [...events].sort((a, b) => a.at.localeCompare(b.at));
  return (
    <ul className="timeline">
      {sorted.map((ev) => (
        <li key={ev.id}>
          <strong className="mono">{ev.at.slice(0, 10)}</strong>
          <div className="t-sub">{ev.event.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())} · {ev.actor}</div>
          {ev.note && <div className="t-sub">{ev.note}</div>}
          {ev.oldState && ev.newState && (
            <div className="t-sub">
              <StateBadge state={ev.oldState} /> → <StateBadge state={ev.newState} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

/* ---------- jurisdiction views ---------- */

function stateGadmNameOf(e: CivicEntity): string {
  return e.name === 'Federal Capital Territory' ? e.name : e.name.replace(/ State$/, '');
}

function CountryView() {
  const { selectState } = useCivic();
  const states = civicStore.states();
  return (
    <div className="panel-body">
      <div className="p-head">
        <h1>Nigeria</h1>
        <p className="sub">Federal Republic of Nigeria — civic atlas</p>
      </div>
      <div className="accent-bar" />
      <div className="ctx-strip">
        <span className="ctx-strip__label">Civic atlas</span>
        <span>36 states + Federal Capital Territory · Pilot state: Lagos · Boundary geometry: GADM v4.1</span>
      </div>
      <SessionActivity />
      <Sec title="States & Federal Capital Territory" src="GADM v4.1">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>State</th><th>LGA data</th><th>Information state</th></tr></thead>
            <tbody>
              {states.map((e) => {
                const gadm = stateGadmNameOf(e);
                const loaded = hasLgaGeometry(gadm);
                return (
                  <tr key={e.id} className="clickable" onClick={() => selectState(gadm)}>
                    <td><span className="t-main">{e.name}</span></td>
                    <td>{loaded ? <span className="t-main">Loaded</span> : <span className="t-sub">Pending</span>}</td>
                    <td><StateBadge state={e.informationState} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="note">
          Boundary geometry is real (GADM v4.1). Lagos is the pilot state with
          loaded LGA boundaries; all other states show “Pending” until their
          boundary data is loaded. Office-holder records appear only when
          sourced — nothing is guessed.
        </p>
      </Sec>
      <Sec title="How to explore">
        <ul className="lst">
          <li>Click a state on the map or in the table to travel there.</li>
          <li>Use the breadcrumb or the Esc key to move back up.</li>
          <li>Every record carries its source and information state.</li>
        </ul>
      </Sec>
    </div>
  );
}

function jurisdictionId(view: ViewState): string {
  return jurisdictionIdForView(view) ?? COUNTRY_ID;
}

function StateView({ view }: { view: ViewState }) {
  const { selectLGA } = useCivic();
  const gadmName = view.state!;
  const d = civicStore.getDetail(jurisdictionId(view));
  const loaded = hasLgaGeometry(gadmName);
  const lgas = (d?.children ?? []).filter((c) => c.kind === 'lga');
  return (
    <div className="panel-body">
      <div className="p-head">
        <Lineage items={['Nigeria']} />
        <h1>{stateDisplayName(gadmName)}{gadmName === 'Lagos' && <span className="pilot-tag">Pilot state</span>}</h1>
        <p className="sub">State · <StateBadge state="unknown" /></p>
      </div>
      <div className="accent-bar" />
      <SessionActivity />
      <Sec title="Jurisdiction">
        <KV rows={[
          ['Type', 'State'],
          ['Boundary geometry', 'Real — GADM v4.1'],
          ['LGA boundary data', loaded ? 'Loaded' : 'Not loaded in this build'],
        ]} />
      </Sec>
      <Sec title="Local government areas" src={loaded ? 'GADM v4.1' : undefined}>
        {loaded && lgas.length > 0 ? (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>LGA</th><th>Status</th></tr></thead>
              <tbody>
                {lgas.map((e) => (
                  <tr key={e.id} className="clickable" onClick={() => selectLGA(e.name)}>
                    <td><span className="t-main">{e.name}</span></td>
                    <td><span className="t-sub">Constitutional LGA</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty what={`LGA boundary data for ${stateDisplayName(gadmName)} is not loaded yet`} />
        )}
      </Sec>
      <Sec title="Leadership">
        <Empty what="sourced office-holder records are not loaded yet" />
      </Sec>
    </div>
  );
}

function LGAView({ view }: { view: ViewState }) {
  const { selectLCDA, showDetail, detail: active } = useCivic();
  const d = civicStore.getDetail(jurisdictionId(view));
  if (!d) return <div className="panel-body"><Empty what="this LGA record could not be loaded" /></div>;
  const lcdas = d.children.filter((c) => c.kind === 'lcda');
  const records = d.children.filter((c) => !['lcda', 'ward'].includes(c.kind));
  return (
    <div className="panel-body">
      <div className="p-head">
        <Lineage items={d.lineage.map((x) => x.name)} />
        <h1>{d.entity.name}</h1>
        <p className="sub">Local Government Area · <StateBadge state={d.entity.informationState} /></p>
      </div>
      <div className="accent-bar" />
      <SessionActivity />
      <Sec title="Jurisdiction">
        <KV rows={[
          ['Type', 'Constitutional LGA'],
          ['Boundary geometry', 'Real — GADM v4.1'],
          ['State', d.lineage.map((x) => x.name).join(' › ') || '—'],
        ]} />
        {d.entity.constitutionalStatus && (
          <p className="note">Constitutional status: {d.entity.constitutionalStatus.replace(/_/g, ' ')}.</p>
        )}
      </Sec>
      {lcdas.length > 0 && (
        <Sec title="Local councils (LCDA)">
          <EntityRows items={lcdas} onPick={(e) => selectLCDA(e.id)} />
          <p className="note">
            LCDAs are state-created administrative units — structurally distinct
            from constitutional LGAs. Boundary data pending; positions shown are
            illustrative.
          </p>
        </Sec>
      )}
      <Sec title="Claims">
        {d.claims.length > 0
          ? d.claims.map((c) => <ClaimCard key={c.id} claim={c} />)
          : <Empty what="no claims recorded for this LGA yet" />}
      </Sec>
      {records.length > 0 && (
        <Sec title="Records">
          <EntityRows
            items={records} activeId={active?.id}
            onPick={(e) => showDetail(e.kind, e.id)}
          />
        </Sec>
      )}
    </div>
  );
}

function LCDAView({ view }: { view: ViewState }) {
  const { selectWard, showDetail, detail: active } = useCivic();
  const d = civicStore.getDetail(jurisdictionId(view));
  if (!d) return <div className="panel-body"><Empty what="this LCDA record could not be loaded" /></div>;
  const wards = d.children.filter((c) => c.kind === 'ward');
  const records = d.children.filter((c) => c.kind !== 'ward');
  return (
    <div className="panel-body">
      <div className="p-head">
        <Lineage items={d.lineage.map((x) => x.name)} />
        <h1 className="h2">{d.entity.name}</h1>
        <p className="sub">Local Council Development Area · <StateBadge state={d.entity.informationState} /></p>
      </div>
      <div className="accent-bar" />
      <SessionActivity />
      <Sec title="Jurisdiction">
        <KV rows={[
          ['Type', 'LCDA — state-created, not a constitutional LGA'],
          ['Boundary geometry', 'Pending — positions on the map are illustrative'],
          ['Lineage', d.lineage.map((x) => x.name).join(' › ') || '—'],
        ]} />
      </Sec>
      {wards.length > 0 && (
        <Sec title="Wards">
          <EntityRows items={wards} onPick={(e) => selectWard(e.id)} />
          <p className="note">Ward boundary data pending; positions shown are illustrative.</p>
        </Sec>
      )}
      {records.length > 0 && (
        <Sec title="Records">
          <EntityRows items={records} activeId={active?.id} onPick={(e) => showDetail(e.kind, e.id)} />
        </Sec>
      )}
    </div>
  );
}

function WardView({ view }: { view: ViewState }) {
  const { showDetail, detail: active } = useCivic();
  const d = civicStore.getDetail(jurisdictionId(view));
  if (!d) return <div className="panel-body"><Empty what="this ward record could not be loaded" /></div>;
  return (
    <div className="panel-body">
      <div className="p-head">
        <Lineage items={d.lineage.map((x) => x.name)} />
        <h1 className="h2">{d.entity.name}</h1>
        <p className="sub">Ward · <StateBadge state={d.entity.informationState} /></p>
      </div>
      <div className="accent-bar" />
      <SessionActivity />
      <Sec title="Jurisdiction">
        <KV rows={[
          ['Type', 'Electoral ward'],
          ['Boundary geometry', 'Pending — position on the map is illustrative'],
          ['Lineage', d.lineage.map((x) => x.name).join(' › ') || '—'],
        ]} />
      </Sec>
      <Sec title="Records in this ward">
        {d.children.length > 0
          ? <EntityRows items={d.children} activeId={active?.id} onPick={(e) => showDetail(e.kind, e.id)} />
          : <Empty what="no records attributed to this ward yet" />}
      </Sec>
    </div>
  );
}

/* ---------- entity detail: ENTITY → CLAIM → SOURCE → STATE → HISTORY ---------- */

function DetailShell({ title, sub, backLabel, children }: {
  title: string; sub: React.ReactNode; backLabel: string; children: React.ReactNode;
}) {
  const { closeDetail } = useCivic();
  return (
    <div className="panel-body">
      <button className="link" onClick={closeDetail}>← {backLabel}</button>
      <div className="p-head" style={{ marginTop: 8 }}>
        <h1 className="h2">{title}</h1>
        <p className="sub">{sub}</p>
      </div>
      <div className="accent-bar" />
      {children}
    </div>
  );
}

function allEvents(d: EntityDetail): CivicEvent[] {
  return d.claims.flatMap((c) => c.events);
}

function DetailBody({ sel }: { sel: DetailSel }) {
  const { view, enterSatelliteView } = useCivic();
  const d = civicStore.getDetail(sel.id);
  const backLabel =
    view.level === 'ward' ? 'Back to ward'
    : view.level === 'lcda' ? 'Back to LCDA'
    : view.level === 'lga' ? 'Back to LGA'
    : view.level === 'state' ? 'Back to state'
    : 'Back';
  if (!d) {
    return (
      <DetailShell title="Record not found" sub="—" backLabel={backLabel}>
        <Empty what="this record could not be loaded" />
      </DetailShell>
    );
  }
  const { entity, claims, lineage } = d;
  const kindLabel = KIND_LABEL[entity.kind] ?? entity.kind;
  const isProject = entity.kind === 'project';
  return (
    <DetailShell
      title={entity.name}
      sub={<>{kindLabel} · <StateBadge state={entity.informationState} /></>}
      backLabel={backLabel}
    >
      <Sec title="Entity">
        <KV rows={[
          ['Kind', kindLabel],
          ['Information state', <StateBadge key="state" state={entity.informationState} />],
          ['Jurisdiction', lineage.map((x) => x.name).join(' › ') || '—'],
          ...(entity.positionNote ? [['Position', entity.positionNote] as [string, React.ReactNode]] : []),
          ...(entity.sourceLabel ? [['Source', entity.sourceLabel] as [string, React.ReactNode]] : []),
          ...(entity.constitutionalStatus ? [['Constitutional status', entity.constitutionalStatus.replace(/_/g, ' ')] as [string, React.ReactNode]] : []),
        ]} />
      </Sec>
      <Sec title="Claims">
        {claims.length > 0
          ? claims.map((c) => <ClaimCard key={c.id} claim={c} />)
          : <Empty what="no claims recorded for this entity yet" />}
      </Sec>
      <Sec title="History">
        <History events={allEvents(d)} />
      </Sec>
      {isProject && entity.position && (
        <Sec title="Satellite observation">
          <p className="note" style={{ marginTop: 0 }}>
            This project has an area of interest. Viewing from satellite
            navigates the map to the site and loads the latest available
            imagery.
          </p>
          <div style={{ marginTop: 10 }}>
            <button className="btn" onClick={() => enterSatelliteView(entity.id)}>
              VIEW FROM SATELLITE
            </button>
          </div>
          <p className="note">
            Imagery is evidence of physical conditions — it does not establish
            who financed, commissioned or constructed the project.
          </p>
        </Sec>
      )}
    </DetailShell>
  );
}

/* ---------- panel root ---------- */

export default function InfoPanel() {
  const { view, detail, satellite } = useCivic();

  let body: React.ReactNode;
  if (satellite.active) {
    body = <SatellitePanel />;
  } else if (detail) {
    // Phase 3: citizen reports render through their own detail panel —
    // the two-axis model (workflow vs information state) stays explicit.
    body = detail.kind === 'report'
      ? <ReportDetail reportId={detail.id} />
      : <DetailBody sel={detail} />;
  } else if (view.level === 'country') {
    body = <CountryView />;
  } else if (view.level === 'state' && view.state) {
    body = <StateView view={view} />;
  } else if (view.level === 'lga' && view.lga) {
    body = <LGAView view={view} />;
  } else if (view.level === 'lcda' && view.lcda) {
    body = <LCDAView view={view} />;
  } else if (view.level === 'ward' && view.ward) {
    body = <WardView view={view} />;
  } else {
    body = <CountryView />;
  }

  return (
    <section id="panel" aria-label="Geographic information panel">
      {body}
    </section>
  );
}
