// components/ReportDetail.tsx — Phase 3 report detail panel.
//
// Shows one citizen report: the two axes (workflow status vs information
// state) are rendered side by side and never merged. status='verified'
// renders as "Submission accepted", never a VERIFIED badge. Reporter
// identity is never displayed (the service strips it).
'use client';
import { useState } from 'react';
import { useCivic } from '@/state/CivicContext';
import { civicStore } from '@/lib/civic';
import { reportService } from '@/lib/civic/reportService';
import {
  LOCATION_STATUS_LABEL,
  REPORT_STATUS_DESCRIPTION,
  REPORT_STATUS_LABEL,
  type ReportStatus,
} from '@/lib/civic/reporting';
import { INFORMATION_STATE_LABEL } from '@/lib/provenance';
import { ClaimCard } from './InfoPanel';

/** Dev intake fingerprint. The production API issues real per-session values. */
const DEV_FINGERPRINT = 'dev-session';

/** Human labels for internal actor/relationship codes. Follows the console's own language. */
const ACTOR_LABEL: Record<string, string> = {
  citizen: 'Citizen',
  verifier: 'Verifier',
  admin: 'Moderator',
  authority: 'Authority',
  system: 'System',
};
const RELATIONSHIP_LABEL: Record<string, string> = {
  originated_from: 'Originated from',
  supports: 'Supports',
  contradicts: 'Contradicts',
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

export default function ReportDetail({ reportId }: { reportId: string }) {
  const { reportsVersion, bumpReports, setModeratorOpen } = useCivic();
  const [note, setNote] = useState('');
  const [noteMsg, setNoteMsg] = useState<string | null>(null);
  void reportsVersion;

  const bundle = reportService.getReport(reportId);
  if (!bundle) {
    return (
      <div className="p-body">
        <p className="t-sub">Report not found. It may have been removed from this session.</p>
      </div>
    );
  }
  const { report, evidence, events, claims } = bundle;
  const lineage = report.geoEntityId
    ? civicStore.lineageOf(report.geoEntityId).map((e) => e.name).join(' › ')
    : '';

  const addNote = () => {
    if (!note.trim()) return;
    try {
      reportService.addNote(reportId, note, { role: 'citizen', fingerprint: DEV_FINGERPRINT });
      setNote('');
      setNoteMsg('Note added to the report history.');
      bumpReports();
    } catch (e) {
      setNoteMsg(e instanceof Error ? e.message : 'Could not add the note.');
    }
  };

  return (
    <div className="p-body">
      <div className="p-kicker">CITIZEN REPORT</div>
      <h3 className="p-title">{report.title}</h3>
      <div className="p-badges">
        <span className={`st st-${report.status}`} title={REPORT_STATUS_DESCRIPTION[report.status]}>
          {REPORT_STATUS_LABEL[report.status]}
        </span>
        <span className={`ist ist-${report.informationState}`} title="Epistemic state — independent of the handling workflow">
          {INFORMATION_STATE_LABEL[report.informationState]}
        </span>
        <span className="chip">{report.category}</span>
        <span className="chip">Severity: {report.severity.charAt(0).toUpperCase() + report.severity.slice(1)}</span>
      </div>
      {report.status === 'verified' && (
        <p className="t-sub warn-inline">
          “Submission accepted” means this was accepted as a legitimate citizen submission —
          not that the underlying claim has been independently verified.
        </p>
      )}

      <section className="p-sec">
        <h4>Observation</h4>
        <p className="p-desc">{report.description}</p>
        <dl className="kv">
          <dt>Observed</dt><dd>{fmtDate(report.observedAt)}</dd>
          <dt>Submitted</dt><dd>{fmtDate(report.createdAt)}</dd>
          <dt>Location</dt>
          <dd>
            {LOCATION_STATUS_LABEL[report.locationStatus]}
            {report.geom && ` — ${report.geom.lat.toFixed(5)}, ${report.geom.lng.toFixed(5)}`}
            {lineage && <div className="t-sub">{lineage}</div>}
            {report.locationStatus === 'unavailable' && !lineage && (
              <div className="t-sub">No usable location was provided. The report is preserved without a map position.</div>
            )}
          </dd>
          {report.assignedInstitutionId && (<><dt>Assigned institution reference</dt><dd>{report.assignedInstitutionId}</dd></>)}
          {report.resolutionNote && (<><dt>Resolution</dt><dd>{report.resolutionNote}</dd></>)}
          {report.duplicateOf && (<><dt>Duplicate of</dt><dd>{reportService.getReport(report.duplicateOf)?.report.title ?? report.duplicateOf}</dd></>)}
        </dl>
      </section>

      <section className="p-sec">
        <h4>Evidence ({evidence.length})</h4>
        {evidence.length === 0 && <p className="t-sub">No evidence attached.</p>}
        {evidence.map((e) => (
          <div className="ev-card" key={e.id}>
            <div className="ev-main">
              <strong>{e.originalFilename ?? e.evidenceType}</strong>
              <span className="t-sub">
                {e.evidenceType}
                {e.byteSize != null && ` · ${(e.byteSize / 1024).toFixed(1)} KB`}
                {e.capturedAt && ` · captured ${fmtDate(e.capturedAt)}`}
                {!e.isOriginal && ' · edited/derived'}
              </span>
            </div>
            <span className={`rev rev-${e.reviewState}`}>
              {e.reviewState === 'pending' ? 'Awaiting review' : e.reviewState === 'accepted' ? 'Relevant & intact' : 'Rejected'}
            </span>
          </div>
        ))}
        <p className="t-sub">Material judgement only — accepting evidence is not claim verification.</p>
      </section>

      {claims.length > 0 && (
        <section className="p-sec">
          <h4>Structured claims ({claims.length})</h4>
          {claims.map(({ claim, relationship }) => (
            <div key={claim.id}>
              <div className="t-sub">Relationship: {RELATIONSHIP_LABEL[relationship] ?? relationship}</div>
              <ClaimCard claim={claim} />
            </div>
          ))}
        </section>
      )}

      <section className="p-sec">
        <h4>History ({events.length})</h4>
        <ol className="timeline">
          {events.map((ev) => (
            <li key={ev.id}>
              <div className="tl-head">
                <strong>{ev.event.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())}</strong>
                <span className="t-sub">{fmtDate(ev.createdAt)} · {ACTOR_LABEL[ev.actorType] ?? ev.actorType}</span>
              </div>
              {ev.oldStatus && ev.newStatus && ev.oldStatus !== ev.newStatus && (
                <div className="tl-trans">
                  <span className={`st st-${ev.oldStatus as ReportStatus}`}>{REPORT_STATUS_LABEL[ev.oldStatus as ReportStatus]}</span>
                  {' → '}
                  <span className={`st st-${ev.newStatus as ReportStatus}`}>{REPORT_STATUS_LABEL[ev.newStatus as ReportStatus]}</span>
                </div>
              )}
              {ev.note && <div className="tl-note">{ev.note}</div>}
            </li>
          ))}
        </ol>
      </section>

      <section className="p-sec">
        <h4>Add a follow-up note</h4>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
          placeholder="Additional context from the reporter…" />
        <button className="btn" onClick={addNote}>Add note</button>
        {noteMsg && <p className="t-sub">{noteMsg}</p>}
      </section>

      <section className="p-sec">
        <button className="btn-ghost" onClick={() => setModeratorOpen(true)}>
          Open DEV moderator console
        </button>
      </section>
    </div>
  );
}
