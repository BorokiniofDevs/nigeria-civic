// components/ModerationConsole.tsx — Phase 3 DEV-ONLY moderator console.
//
// DEV-ONLY. There is no production authentication/authorization in this
// build, so the "acting as" switch below is a DEVELOPMENT AID, not a
// security boundary. The authoritative enforcement is database RLS +
// the API service role (migration 0005). This console must never be
// mistaken for production moderation tooling: it is labelled accordingly,
// creates no fake moderator identities, and leaves a clean seam — the
// ServiceContext role — for the eventual authenticated moderator system.
//
// Every action requires a written reason and appends to report_events.
// Nothing is deleted. A report accepted as a legitimate submission is NOT
// a verified fact: accepting never touches claim information_state.
'use client';
import { useMemo, useState } from 'react';
import { useCivic } from '@/state/CivicContext';
import { reportService, ReportServiceError, type ServiceRole } from '@/lib/civic/reportService';
import {
  REPORT_STATUS_DESCRIPTION,
  REPORT_STATUS_LABEL,
  allowedReportTransitions,
  type CitizenReport,
  type ReportStatus,
  type Severity,
} from '@/lib/civic/reporting';

/** Dev intake fingerprint. The production API issues real per-session values. */
const DEV_FINGERPRINT = 'dev-session';

/** Human labels for internal actor codes. Matches the report detail view. */
const MOD_ACTOR_LABEL: Record<string, string> = {
  citizen: 'Citizen',
  verifier: 'Verifier',
  admin: 'Moderator',
  authority: 'Authority',
  system: 'System',
};

function errText(e: unknown): string {
  if (e instanceof ReportServiceError) {
    return `${e.message}${e.details.length ? ' ' + e.details.join(' ') : ''}`;
  }
  return e instanceof Error ? e.message : 'Action failed.';
}

export default function ModerationConsole() {
  const { setModeratorOpen, bumpReports, reportsVersion, showDetail } = useCivic();
  const [role, setRole] = useState<ServiceRole>('citizen');
  const [filter, setFilter] = useState<'' | ReportStatus>('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<'' | Severity>('');
  const [filterAge, setFilterAge] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgErr, setMsgErr] = useState(false);

  // form state
  const [transitionTo, setTransitionTo] = useState<ReportStatus>('under_review');
  const [note, setNote] = useState('');
  const [institutionId, setInstitutionId] = useState('');
  const [infoNote, setInfoNote] = useState('');
  const [evId, setEvId] = useState('');
  const [evDecision, setEvDecision] = useState<'accepted' | 'rejected'>('accepted');
  const [claimKey, setClaimKey] = useState('');
  const [claimLabel, setClaimLabel] = useState('');
  const [claimValue, setClaimValue] = useState('');
  const [dupTarget, setDupTarget] = useState('');

  void reportsVersion;
  const ctx = useMemo(() => ({ role, fingerprint: DEV_FINGERPRINT }), [role]);
  const allCategories = useMemo(
    () => [...new Set(reportService.listReports().map((r) => r.category))].sort(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reportsVersion, msg],
  );
  const ageHours = filterAge ? Number(filterAge) : undefined;
  const queue = useMemo(
    () => reportService.listReports({
      ...(filter ? { status: filter } : {}),
      ...(filterCategory ? { category: filterCategory } : {}),
      ...(filterSeverity ? { severity: filterSeverity } : {}),
      ...(ageHours ? { maxAgeHours: ageHours } : {}),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filter, filterCategory, filterSeverity, filterAge, reportsVersion, msg],
  );
  const selected = selectedId ? reportService.getReport(selectedId) : undefined;
  const duplicates = selectedId ? reportService.findPossibleDuplicates(selectedId) : [];
  const selectedEvents = useMemo(
    () => (selectedId ? reportService.getEvents(selectedId) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedId, reportsVersion, msg],
  );

  const run = (fn: () => void, okMsg: string) => {
    setMsg(null); setMsgErr(false);
    try {
      fn();
      bumpReports();
      setMsg(okMsg);
    } catch (e) {
      setMsg(errText(e));
      setMsgErr(true);
    }
  };

  const doTransition = () => {
    if (!selectedId) return;
    run(
      () => reportService.transitionReport(selectedId, transitionTo, note, ctx),
      `Report moved to “${REPORT_STATUS_LABEL[transitionTo]}”.`,
    );
  };
  const doAssign = () => {
    if (!selectedId || !institutionId.trim()) return;
    run(
      () => reportService.assignInstitution(selectedId, institutionId.trim(), ctx),
      'Report assigned.',
    );
  };
  const doReviewEvidence = () => {
    if (!evId) return;
    run(
      () => reportService.reviewEvidence(evId, evDecision, note || 'Reviewed.', ctx),
      `Evidence ${evDecision}.`,
    );
  };
  const doCreateClaim = () => {
    if (!selectedId) return;
    run(
      () => {
        const { claim } = reportService.createClaimFromReport(
          selectedId, { claimKey, claimLabel, claimValue }, ctx,
        );
        setClaimKey(''); setClaimLabel(''); setClaimValue('');
        return claim;
      },
      'Claim structured from this report (Citizen-submitted — not verified).',
    );
  };
  const doRequestInfo = () => {
    if (!selectedId) return;
    run(
      () => {
        reportService.requestInfo(selectedId, infoNote, ctx);
        setInfoNote('');
      },
      'Information requested. The report moves to Under review and the request is recorded in its history.',
    );
  };
  const doDuplicate = () => {
    if (!selectedId || !dupTarget.trim()) return;
    run(
      () => reportService.markDuplicate(selectedId, dupTarget.trim(), note, ctx),
      'Report marked as duplicate. Original preserved.',
    );
  };

  const selectReport = (r: CitizenReport) => {
    setSelectedId(r.id);
    setMsg(null);
    const legal = allowedReportTransitions(r.status);
    if (legal.length && !legal.includes(transitionTo)) setTransitionTo(legal[0]);
  };

  return (
    <div className="overlay" role="dialog" aria-label="DEV moderator console">
      <div className="sheet sheet-wide">
        <div className="sheet-head">
          <div>
            <h3><span className="dev-tag">DEV MODERATOR</span> Console</h3>
            <p className="t-sub">
              Development only — no production authentication exists in this build.
              The role switch is a testing aid, <strong>not a security boundary</strong>;
              production enforcement is database RLS + the API service role.
            </p>
          </div>
          <button className="btn-ghost" onClick={() => setModeratorOpen(false)}>Close</button>
        </div>

        <div className="mod-bar">
          <label className="fld inline">
            <span>Acting as (dev switch)</span>
            <select value={role} onChange={(e) => setRole(e.target.value as ServiceRole)}>
              <option value="citizen">Citizen</option>
              <option value="moderator">DEV Moderator</option>
            </select>
          </label>
          <label className="fld inline">
            <span>Status</span>
            <select value={filter} onChange={(e) => setFilter(e.target.value as '' | ReportStatus)}>
              <option value="">All statuses</option>
              {(['reported', 'under_review', 'verified', 'in_progress', 'resolved', 'rejected', 'duplicate'] as ReportStatus[]).map((s) => (
                <option key={s} value={s}>{REPORT_STATUS_LABEL[s]}</option>
              ))}
            </select>
          </label>
          <label className="fld inline">
            <span>Sector</span>
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="">All sectors</option>
              {allCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="fld inline">
            <span>Severity</span>
            <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value as '' | Severity)}>
              <option value="">All severities</option>
              {(['low', 'medium', 'high', 'critical'] as Severity[]).map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </label>
          <label className="fld inline">
            <span>Age</span>
            <select value={filterAge} onChange={(e) => setFilterAge(e.target.value)}>
              <option value="">All time</option>
              <option value="24">Last 24 hours</option>
              <option value="168">Last 7 days</option>
              <option value="720">Last 30 days</option>
            </select>
          </label>
          {role === 'citizen' && (
            <div className="alert alert-info inline-alert">
              Moderator actions are disabled while acting as a citizen — try one and watch it refuse.
            </div>
          )}
        </div>

        {msg && <div className={`alert ${msgErr ? 'alert-err' : 'alert-ok'}`}>{msg}</div>}

        <div className="mod-grid">
          <div className="mod-queue">
            <h4>Queue ({queue.length})</h4>
            {queue.length === 0 && (
              <p className="t-sub">No reports. The first report in the system will be the first one a citizen actually submits.</p>
            )}
            {queue.map((r) => (
              <button
                key={r.id}
                className={`q-item ${selectedId === r.id ? 'on' : ''}`}
                onClick={() => selectReport(r)}
              >
                <strong>{r.title}</strong>
                <span className="t-sub">{r.category} · {new Date(r.createdAt).toLocaleString()}</span>
                <span className={`st st-${r.status}`}>{REPORT_STATUS_LABEL[r.status]}</span>
              </button>
            ))}
          </div>

          <div className="mod-detail">
            {!selected && <p className="t-sub">Select a report from the queue.</p>}
            {selected && (
              <>
                <h4>{selected.report.title}</h4>
                <p className="t-sub">{REPORT_STATUS_DESCRIPTION[selected.report.status]}</p>

                <div className="mod-actions">
                  <h5>Workflow transition</h5>
                  <div className="row">
                    <select value={transitionTo} onChange={(e) => setTransitionTo(e.target.value as ReportStatus)}>
                      {allowedReportTransitions(selected.report.status).map((s) => (
                        <option key={s} value={s}>{REPORT_STATUS_LABEL[s]}</option>
                      ))}
                    </select>
                    <input value={note} onChange={(e) => setNote(e.target.value)}
                      placeholder="Written reason (required)" />
                    <button className="btn" onClick={doTransition}>Apply</button>
                  </div>

                  <h5>Assign institution</h5>
                  <div className="row">
                    <input value={institutionId} onChange={(e) => setInstitutionId(e.target.value)}
                      placeholder="Institution id" />
                    <button className="btn" onClick={doAssign}>Assign</button>
                  </div>

                  <h5>Request information</h5>
                  <div className="row">
                    <input value={infoNote} onChange={(e) => setInfoNote(e.target.value)}
                      placeholder="What information is needed from the reporter?" />
                    <button className="btn" onClick={doRequestInfo}>Request info</button>
                  </div>
                  <p className="t-sub">
                    Moves the report to <strong>Under review</strong> and records an
                    information request in its history.
                  </p>

                  <h5>Review evidence</h5>
                  {selected.evidence.length === 0 && <p className="t-sub">No evidence attached.</p>}
                  {selected.evidence.map((e) => (
                    <div className="row" key={e.id}>
                      <span className="t-sub">{e.originalFilename ?? e.evidenceType} · {e.reviewState}</span>
                      <button className="btn-ghost" onClick={() => setEvId(e.id)}>Select</button>
                    </div>
                  ))}
                  <div className="row">
                    <input value={evId} onChange={(e) => setEvId(e.target.value)} placeholder="Evidence id" />
                    <select value={evDecision} onChange={(e) => setEvDecision(e.target.value as 'accepted' | 'rejected')}>
                      <option value="accepted">Accept (relevant & intact)</option>
                      <option value="rejected">Reject</option>
                    </select>
                    <button className="btn" onClick={doReviewEvidence}>Review</button>
                  </div>
                  <p className="t-sub">Material judgement only — never presented as claim verification.</p>

                  <h5>Structure a claim from this report</h5>
                  <div className="col">
                    <input value={claimKey} onChange={(e) => setClaimKey(e.target.value)} placeholder="Claim key (e.g. road.condition)" />
                    <input value={claimLabel} onChange={(e) => setClaimLabel(e.target.value)} placeholder="Claim label" />
                    <input value={claimValue} onChange={(e) => setClaimValue(e.target.value)} placeholder="Claim value" />
                    <button className="btn" onClick={doCreateClaim}>Create claim</button>
                  </div>
                  <p className="t-sub">
                    The claim enters as <strong>Citizen-submitted</strong> (or <strong>Source-backed · pending verification</strong> with accepted evidence) —
                    never verified. The originating report is attached as a citizen evidence source.
                  </p>

                  <h5>Possible duplicates</h5>
                  {duplicates.length === 0 && <p className="t-sub">No same-category reports in this jurisdiction within 72h.</p>}
                  {duplicates.map((d) => (
                    <div className="row" key={d.id}>
                      <span className="t-sub">{d.title}</span>
                      <button className="btn-ghost" onClick={() => setDupTarget(d.id)}>Use as target</button>
                    </div>
                  ))}
                  <div className="row">
                    <input value={dupTarget} onChange={(e) => setDupTarget(e.target.value)} placeholder="Canonical report id" />
                    <button className="btn" onClick={doDuplicate}>Mark duplicate</button>
                  </div>

                  <button className="btn-ghost" onClick={() => { setModeratorOpen(false); showDetail('report', selected.report.id); }}>
                    Open public report view
                  </button>

                  <h5>History</h5>
                  {selectedEvents.length === 0 && <p className="t-sub">No recorded events yet.</p>}
                  <ol className="timeline">
                    {selectedEvents.map((ev) => (
                      <li key={ev.id}>
                        <strong>{ev.event.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())}</strong>
                        <span className="t-sub"> · {MOD_ACTOR_LABEL[ev.actorType] ?? ev.actorType}</span>
                        {ev.note && <p className="t-sub">{ev.note}</p>}
                        <span className="t-sub">{new Date(ev.createdAt).toLocaleString()}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
