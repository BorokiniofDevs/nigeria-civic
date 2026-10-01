// components/ReportFlow.tsx — Phase 3 citizen report intake.
//
// A citizen observation is an ALLEGATION, not a fact. The flow says so
// plainly at review and at the result step. Reports enter as
// reported / citizen_submitted — the UI cannot mint any other state.
//
// Location honesty: the flow distinguishes "location provided",
// "approximate location", and "location unavailable". It never invents a
// coordinate. Evidence is metadata only (the dev build records a
// session-scoped storage reference; the production storage layer issues
// the real pointer).
'use client';
import { useEffect, useMemo, useState } from 'react';
import { useCivic } from '@/state/CivicContext';
import { civicStore } from '@/lib/civic';
import { reportService } from '@/lib/civic/reportService';
import {
  LOCATION_STATUS_LABEL,
  REPORT_STATUS_DESCRIPTION,
  REPORT_STATUS_LABEL,
  validateReportSubmission,
  type CitizenReport,
  type EvidenceType,
  type LocationStatus,
  type Severity,
} from '@/lib/civic/reporting';
import { INFORMATION_STATE_LABEL } from '@/lib/provenance';
import type { CivicEntity } from '@/lib/civic/types';

/** Dev intake fingerprint. The production API issues real per-session values. */
const DEV_FINGERPRINT = 'dev-session';

const STEPS = ['Location', 'Describe', 'Evidence', 'Review'];

const SEVERITIES: Severity[] = ['low', 'medium', 'high', 'critical'];

interface PendingEvidence {
  key: string;
  file: File;
  evidenceType: EvidenceType;
  capturedAt: string;
  isOriginal: boolean;
  hasLocation: boolean;
}

function detectEvidenceType(file: File): EvidenceType {
  const t = (file.type || '').toLowerCase();
  if (t.startsWith('image/')) return 'photo';
  if (t.startsWith('video/')) return 'video';
  if (t.startsWith('audio/')) return 'audio';
  return 'document';
}

function JurisdictionSelect({
  value, onChange,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const states = useMemo(() => civicStore.states(), []);
  const [s1, setS1] = useState('');
  const [s2, setS2] = useState('');
  const [s3, setS3] = useState('');
  const l2 = s1 ? civicStore.childrenOf(s1) : [];
  const l3 = s2 ? civicStore.childrenOf(s2) : [];
  const l4 = s3 ? civicStore.childrenOf(s3) : [];

  const pick = (level: 1 | 2 | 3 | 4, id: string) => {
    if (level === 1) { setS1(id); setS2(''); setS3(''); onChange(id || null); }
    if (level === 2) { setS2(id); setS3(''); onChange(id || s1 || null); }
    if (level === 3) { setS3(id); onChange(id || s2 || s1 || null); }
    if (level === 4) { onChange(id || s3 || s2 || s1 || null); }
  };
  void value;

  const sel = (label: string, val: string, opts: CivicEntity[], onPick: (id: string) => void) => (
    <label className="fld">
      <span>{label}</span>
      <select value={val} onChange={(e) => onPick(e.target.value)}>
        <option value="">—</option>
        {opts.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="jur-grid">
      {sel('State / FCT', s1, states, (id) => pick(1, id))}
      {sel('LGA / area council', s2, l2, (id) => pick(2, id))}
      {l3.length > 0 && sel('LCDA / district', s3, l3, (id) => pick(3, id))}
      {l4.length > 0 && sel('Ward / community', '', l4, (id) => pick(4, id))}
    </div>
  );
}

export default function ReportFlow() {
  const {
    setReportFlowOpen, currentJurisdictionId,
    startLocationPick, stopLocationPick, setPickMarker,
    bumpReports, showDetail,
  } = useCivic();

  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<{ lng: number; lat: number } | null>(null);
  const [imprecise, setImprecise] = useState(false);
  const [geoEntityId, setGeoEntityId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [observedAt, setObservedAt] = useState('');
  const [severity, setSeverity] = useState<Severity>('medium');

  const [pending, setPending] = useState<PendingEvidence[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CitizenReport | null>(null);

  useEffect(() => () => { stopLocationPick(); setPickMarker(null); }, [stopLocationPick, setPickMarker]);

  const locationStatus: LocationStatus = picked ? (imprecise ? 'imprecise' : 'provided') : 'unavailable';
  const jurisdictionLineage = geoEntityId ? civicStore.lineageOf(geoEntityId).map((e) => e.name).join(' › ') : '';

  const beginPick = () => {
    setPicking(true);
    startLocationPick((p) => {
      setPicked({ lng: p[0], lat: p[1] });
      setPickMarker(p);
      setPicking(false);
      stopLocationPick();
    });
  };
  const cancelPick = () => { setPicking(false); stopLocationPick(); };
  const clearPicked = () => { setPicked(null); setImprecise(false); setPickMarker(null); };
  const captureCurrent = () => {
    const id = currentJurisdictionId();
    if (id) setGeoEntityId(id);
  };

  const composedInput = () => ({
    category, title, description,
    observedAt: observedAt || null,
    locationStatus,
    geom: picked,
    geoEntityId,
    severity,
    isAnonymous: true,
  });

  const next = () => {
    setErrors([]);
    if (step === 1) {
      const v = validateReportSubmission(composedInput());
      if (!v.ok) { setErrors(v.errors); return; }
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const items: PendingEvidence[] = [...files].map((file) => ({
      key: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      file,
      evidenceType: detectEvidenceType(file),
      capturedAt: '',
      isOriginal: true,
      hasLocation: false,
    }));
    setPending((p) => [...p, ...items]);
  };

  const submit = () => {
    setErrors([]);
    setSubmitting(true);
    try {
      const report = reportService.submitReport(composedInput(), {
        role: 'citizen',
        fingerprint: DEV_FINGERPRINT,
      });
      for (const pe of pending) {
        reportService.addEvidence(report.id, {
          evidenceType: pe.evidenceType,
          // Session-scoped opaque reference for the dev build. The
          // production storage layer issues the real pointer — this value
          // is never presented as a URL and never leaves this session.
          storageRef: `session:${pe.key}`,
          originalFilename: pe.file.name,
          mimeType: pe.file.type || undefined,
          byteSize: pe.file.size,
          capturedAt: pe.capturedAt || null,
          hasLocation: pe.hasLocation,
          isOriginal: pe.isOriginal,
          metadata: { clientFilename: pe.file.name, clientSize: pe.file.size },
        }, { role: 'citizen', fingerprint: DEV_FINGERPRINT });
      }
      bumpReports();
      setPickMarker(null);
      stopLocationPick();
      setResult(report);
      setStep(STEPS.length); // result screen
    } catch (e) {
      setErrors(e instanceof Error ? [e.message, ...((e as { details?: string[] }).details ?? [])] : ['Submission failed.']);
    } finally {
      setSubmitting(false);
    }
  };

  const close = () => { stopLocationPick(); setPickMarker(null); setReportFlowOpen(false); };

  return (
    <div className="overlay" role="dialog" aria-label="Submit a citizen report">
      <div className="sheet">
        <div className="sheet-head">
          <h3>Report an observation</h3>
          <button className="btn-ghost" onClick={close}>Close</button>
        </div>

        {step < STEPS.length && (
          <ol className="steps">
            {STEPS.map((s, i) => (
              <li key={s} className={i === step ? 'on' : i < step ? 'done' : ''}>{s}</li>
            ))}
          </ol>
        )}

        {errors.length > 0 && (
          <div className="alert alert-err">
            {errors.map((e, i) => <div key={i}>{e}</div>)}
          </div>
        )}

        {step === 0 && (
          <section>
            <p className="t-sub">
              Where did you observe this? Give a point, a jurisdiction, both —
              or nothing. A report without a usable location is still a valid report.
            </p>
            <div className="loc-block">
              <h4>Point on the map</h4>
              {!picked && !picking && (
                <button className="btn" onClick={beginPick}>Pick a point on the map</button>
              )}
              {picking && (
                <div className="alert alert-info">
                  Click anywhere on the map to place the point…
                  <button className="btn-ghost" onClick={cancelPick}>Cancel</button>
                </div>
              )}
              {picked && (
                <div className="picked">
                  <div>{picked.lat.toFixed(5)}, {picked.lng.toFixed(5)}</div>
                  <label className="chk">
                    <input type="checkbox" checked={imprecise} onChange={(e) => setImprecise(e.target.checked)} />
                    This location is approximate
                  </label>
                  <button className="btn-ghost" onClick={clearPicked}>Clear point</button>
                </div>
              )}
              <div className="t-sub">Status: <strong>{LOCATION_STATUS_LABEL[locationStatus]}</strong></div>
            </div>
            <div className="loc-block">
              <h4>Jurisdiction (optional)</h4>
              <JurisdictionSelect value={geoEntityId} onChange={setGeoEntityId} />
              {jurisdictionLineage && <div className="t-sub">{jurisdictionLineage}</div>}
              <button className="btn-ghost" onClick={captureCurrent}>Use the jurisdiction I am viewing</button>
            </div>
          </section>
        )}

        {step === 1 && (
          <section>
            <label className="fld">
              <span>Category</span>
              <input value={category} onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. road condition, water supply, waste, street lighting" />
            </label>
            <label className="fld">
              <span>Title</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="Short summary of what you observed" maxLength={140} />
            </label>
            <label className="fld">
              <span>Describe the observation</span>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                rows={5} placeholder="What did you see? When? What is the current condition?" maxLength={5000} />
            </label>
            <div className="row2">
              <label className="fld">
                <span>Observed on (optional)</span>
                <input type="date" value={observedAt} onChange={(e) => setObservedAt(e.target.value)} />
              </label>
              <label className="fld">
                <span>Severity</span>
                <select value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>
                  {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
            </div>
          </section>
        )}

        {step === 2 && (
          <section>
            <p className="t-sub">
              Attach photos, video, audio or documents that support the observation.
              Material is received for review — receiving it proves nothing about the claim.
            </p>
            <label className="fld">
              <span>Add files</span>
              <input type="file" multiple onChange={(e) => addFiles(e.target.files)} />
            </label>
            {pending.map((pe) => (
              <div className="ev-row" key={pe.key}>
                <div className="ev-main">
                  <strong>{pe.file.name}</strong>
                  <span className="t-sub">{(pe.file.size / 1024).toFixed(1)} KB · {pe.evidenceType}</span>
                </div>
                <label className="fld inline">
                  <span>Captured</span>
                  <input type="date" value={pe.capturedAt}
                    onChange={(e) => setPending((p) => p.map((x) => x.key === pe.key ? { ...x, capturedAt: e.target.value } : x))} />
                </label>
                <label className="chk">
                  <input type="checkbox" checked={pe.isOriginal}
                    onChange={(e) => setPending((p) => p.map((x) => x.key === pe.key ? { ...x, isOriginal: e.target.checked } : x))} />
                  Original, unedited
                </label>
                <label className="chk">
                  <input type="checkbox" checked={pe.hasLocation}
                    onChange={(e) => setPending((p) => p.map((x) => x.key === pe.key ? { ...x, hasLocation: e.target.checked } : x))} />
                  Includes location I consent to share
                </label>
                <button className="btn-ghost"
                  onClick={() => setPending((p) => p.filter((x) => x.key !== pe.key))}>Remove</button>
              </div>
            ))}
            {pending.length === 0 && <p className="t-sub">No files attached. Evidence is optional.</p>}
          </section>
        )}

        {step === 3 && (
          <section>
            <h4>Review</h4>
            <dl className="review">
              <dt>Category</dt><dd>{category}</dd>
              <dt>Title</dt><dd>{title}</dd>
              <dt>Description</dt><dd>{description}</dd>
              <dt>Location</dt>
              <dd>
                {LOCATION_STATUS_LABEL[locationStatus]}
                {picked && ` — ${picked.lat.toFixed(5)}, ${picked.lng.toFixed(5)}`}
                {jurisdictionLineage && <div className="t-sub">{jurisdictionLineage}</div>}
              </dd>
              <dt>Observed</dt><dd>{observedAt || 'Not stated'}</dd>
              <dt>Severity</dt><dd>{severity}</dd>
              <dt>Evidence</dt><dd>{pending.length} file(s)</dd>
            </dl>
            <div className="alert alert-warn">
              Submitting a report does not mean the claim has been independently verified.
              Your report enters review as a <strong>citizen submission</strong> — an allegation, not a fact.
            </div>
            <button className="btn btn-primary" onClick={submit} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit report'}
            </button>
          </section>
        )}

        {step === STEPS.length && result && (
          <section>
            <h4>Report submitted</h4>
            <dl className="review">
              <dt>Report</dt><dd>{result.title}</dd>
              <dt>Status</dt><dd><span className="st st-reported">{REPORT_STATUS_LABEL[result.status]}</span></dd>
              <dt>Information state</dt><dd><span className="ist ist-citizen_submitted">{INFORMATION_STATE_LABEL.citizen_submitted}</span></dd>
            </dl>
            <p className="t-sub">{REPORT_STATUS_DESCRIPTION[result.status]}</p>
            <div className="alert alert-info">
              A moderator will triage this submission. Even if it is accepted as a legitimate
              report, the underlying claim remains a <strong>citizen submission</strong> until
              independent evidence and an accountable verifier change that.
            </div>
            <div className="row">
              <button className="btn" onClick={() => { close(); showDetail('report', result.id); }}>View report</button>
              <button className="btn-ghost" onClick={close}>Done</button>
            </div>
          </section>
        )}

        {step < STEPS.length && (
          <div className="sheet-foot">
            {step > 0 && <button className="btn-ghost" onClick={() => setStep((s) => s - 1)}>Back</button>}
            <span className="spacer" />
            {step < STEPS.length - 1 && <button className="btn" onClick={next}>Continue</button>}
          </div>
        )}
      </div>
    </div>
  );
}
