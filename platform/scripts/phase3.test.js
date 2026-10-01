// scripts/phase3.test.js — Phase 3 behavioral tests: citizen evidence & reporting.
//
// Plain Node script (CommonJS require by design — this file is not part of
// the TypeScript application bundle).
/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PLATFORM = path.resolve(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'civic-phase3-'));
const OUT = path.join(TMP, 'out');

const tsconfig = {
  compilerOptions: {
    target: 'es2020', module: 'commonjs', moduleResolution: 'node',
    esModuleInterop: true, skipLibCheck: true, resolveJsonModule: true,
    outDir: OUT,
    rootDir: path.join(PLATFORM, 'src'),
    baseUrl: path.join(PLATFORM, 'src'),
    paths: { '@/*': ['./*'] },
  },
  include: [
    path.join(PLATFORM, 'src/lib/civic/reporting.ts'),
    path.join(PLATFORM, 'src/lib/civic/reportService.ts'),
    path.join(PLATFORM, 'src/lib/civic/types.ts'),
    path.join(PLATFORM, 'src/lib/provenance.ts'),
  ],
};
fs.writeFileSync(path.join(TMP, 'tsconfig.json'), JSON.stringify(tsconfig));
execSync('npx tsc -p ' + JSON.stringify(path.join(TMP, 'tsconfig.json')), {
  cwd: PLATFORM, stdio: 'pipe',
});

const reporting = require(OUT + '/lib/civic/reporting.js');
const svc = require(OUT + '/lib/civic/reportService.js');
const { reportService } = svc;

let passed = 0, failed = 0;
function ok(cond, label) {
  if (cond) { passed++; }
  else { failed++; console.log('  FAIL:', label); }
}
function throwsCode(fn, code, label) {
  try { fn(); ok(false, label + ' (did not throw)'); }
  catch (e) { ok(e && e.code === code, label + ` (got ${e && e.code})`); }
}

const CITIZEN = { role: 'citizen', fingerprint: 'test-fp' };
const MOD = { role: 'moderator', fingerprint: 'test-fp-mod', actorId: 'dev-mod' };

const VALID = {
  category: 'road condition',
  title: 'Potholes on the service lane',
  description: 'A cluster of deep potholes has formed on the service lane near the market entrance.',
  observedAt: '2026-09-20',
  locationStatus: 'provided',
  geom: { lng: 3.39, lat: 6.59 },
  geoEntityId: 'geo:lga:lagos:kosofe',
  severity: 'high',
};

// ---- 1. Valid intake pins citizen states ----
{
  const s = svc.createReportService();
  const r = s.submitReport({ ...VALID }, CITIZEN);
  ok(r.status === 'reported', 'intake pins status=reported');
  ok(r.informationState === 'citizen_submitted', 'intake pins information_state=citizen_submitted');
  ok(r.id.startsWith('rep_'), 'report id namespaced');
  const b = s.getReport(r.id);
  ok(b.events.length === 1 && b.events[0].event === 'created', 'created event appended');
  ok(b.events[0].oldStatus === null && b.events[0].newStatus === null, 'creation forges no status transition');
  ok(b.report.reporterId === null, 'reporter identity stripped from reads');
}

// ---- 2. Forged states in input are ignored, never honored ----
{
  const s = svc.createReportService();
  const r = s.submitReport({ ...VALID, status: 'verified', informationState: 'verified', resolvedAt: 'now' }, CITIZEN);
  ok(r.status === 'reported', 'forged status=verified ignored');
  ok(r.informationState === 'citizen_submitted', 'forged information_state ignored');
  ok(r.resolvedAt === null, 'forged resolution ignored');
}

// ---- 3. Malformed intake rejected ----
{
  const s = svc.createReportService();
  throwsCode(() => s.submitReport({ ...VALID, title: '  ' }, CITIZEN), 'VALIDATION', 'empty title rejected');
  throwsCode(() => s.submitReport({ ...VALID, description: '' }, CITIZEN), 'VALIDATION', 'empty description rejected');
  throwsCode(() => s.submitReport({ ...VALID, category: '' }, CITIZEN), 'VALIDATION', 'empty category rejected');
  throwsCode(() => s.submitReport({ ...VALID, observedAt: '2099-01-01' }, CITIZEN), 'VALIDATION', 'future observed_at rejected');
  throwsCode(() => s.submitReport({ ...VALID, geom: { lng: 999, lat: 6 } }, CITIZEN), 'VALIDATION', 'out-of-range coordinate rejected');
  throwsCode(() => s.submitReport({ ...VALID, category: 'x' , allowedCategories: ['road condition'] }, CITIZEN), 'VALIDATION', 'unknown category rejected when list given');
}

// ---- 4. Location honesty (db reports_location_honesty, mirrored) ----
{
  const s = svc.createReportService();
  const noLoc = s.submitReport({ ...VALID, geom: null, locationStatus: 'unavailable', geoEntityId: null }, CITIZEN);
  ok(noLoc.geom === null && noLoc.locationStatus === 'unavailable', 'honest no-location report accepted');
  const approx = s.submitReport({ ...VALID, locationStatus: 'imprecise' }, CITIZEN);
  ok(approx.locationStatus === 'imprecise', 'imprecise location accepted with coordinate');
  throwsCode(() => s.submitReport({ ...VALID, geom: null, locationStatus: 'provided' }, CITIZEN), 'VALIDATION', 'provided-without-coordinate rejected');
  throwsCode(() => s.submitReport({ ...VALID, locationStatus: 'unavailable' }, CITIZEN), 'VALIDATION', 'coordinate-with-unavailable rejected');
}

// ---- 5. Evidence intake: pending, never pre-approved ----
{
  const s = svc.createReportService();
  const r = s.submitReport({ ...VALID }, CITIZEN);
  const ev = s.addEvidence(r.id, {
    evidenceType: 'photo', storageRef: 'session:abc123',
    originalFilename: 'pothole.jpg', mimeType: 'image/jpeg', byteSize: 204800,
    capturedAt: '2026-09-20', isOriginal: true, hasLocation: false,
  }, CITIZEN);
  ok(ev.reviewState === 'pending', 'evidence enters as pending');
  ok(ev.submittedBy === null, 'evidence submitter stripped from reads');
  const b = s.getReport(r.id);
  ok(b.events.some((e) => e.event === 'evidence_added'), 'evidence_added event appended');

  // Forged review_state in input is ignored.
  const ev2 = s.addEvidence(r.id, { evidenceType: 'photo', storageRef: 'session:zz', reviewState: 'accepted' }, CITIZEN);
  ok(ev2.reviewState === 'pending', 'forged review_state=accepted ignored');

  throwsCode(() => s.addEvidence(r.id, { evidenceType: 'photo', storageRef: 'session:bad', mimeType: 'application/x-msdownload' }, CITIZEN), 'VALIDATION', 'executable MIME rejected');
  throwsCode(() => s.addEvidence(r.id, { evidenceType: 'photo', storageRef: '' }, CITIZEN), 'VALIDATION', 'empty storage_ref rejected');
  throwsCode(() => s.addEvidence(r.id, { evidenceType: 'photo', storageRef: 'session:big', byteSize: 100 * 1024 * 1024 }, CITIZEN), 'VALIDATION', 'oversize evidence rejected');
  throwsCode(() => s.addEvidence(r.id, { evidenceType: 'hologram', storageRef: 'session:x' }, CITIZEN), 'VALIDATION', 'unknown evidence type rejected');
  throwsCode(() => s.addEvidence('rep_nope', { evidenceType: 'photo', storageRef: 'session:x' }, CITIZEN), 'NOT_FOUND', 'evidence on missing report rejected');
}

// ---- 6. Evidence cap ----
{
  const s = svc.createReportService();
  const r = s.submitReport({ ...VALID }, CITIZEN);
  for (let i = 0; i < 10; i++) {
    s.addEvidence(r.id, { evidenceType: 'metadata_only', storageRef: `session:${i}` }, CITIZEN);
  }
  throwsCode(() => s.addEvidence(r.id, { evidenceType: 'metadata_only', storageRef: 'session:10' }, CITIZEN), 'EVIDENCE_LIMIT', '11th evidence item rejected');
}

// ---- 7. Citizen notes: event only, never a status change ----
{
  const s = svc.createReportService();
  const r = s.submitReport({ ...VALID }, CITIZEN);
  const before = r.status;
  const ev = s.addNote(r.id, 'The potholes are worse after the rain.', CITIZEN);
  ok(ev.event === 'note' && ev.oldStatus === null && ev.newStatus === null, 'citizen note appends without transition');
  ok(s.getReport(r.id).report.status === before, 'note changes no workflow state');
  throwsCode(() => s.addNote(r.id, '   ', CITIZEN), 'VALIDATION', 'empty note rejected');
}

// ---- 8. Moderator-only actions refuse citizens ----
{
  const s = svc.createReportService();
  const r = s.submitReport({ ...VALID }, CITIZEN);
  throwsCode(() => s.transitionReport(r.id, 'under_review', 'triage', CITIZEN), 'MODERATOR_ONLY', 'citizen cannot transition');
  throwsCode(() => s.reviewEvidence('ev_x', 'accepted', 'ok', CITIZEN), 'MODERATOR_ONLY', 'citizen cannot review evidence');
  throwsCode(() => s.createClaimFromReport(r.id, { claimKey: 'k', claimLabel: 'l', claimValue: 'v' }, CITIZEN), 'MODERATOR_ONLY', 'citizen cannot create claims');
  throwsCode(() => s.markDuplicate(r.id, r.id, '', CITIZEN), 'MODERATOR_ONLY', 'citizen cannot mark duplicates');
}

// ---- 9. Moderator workflow: legal transitions, audited ----
{
  const s = svc.createReportService();
  const r = s.submitReport({ ...VALID }, CITIZEN);
  const t1 = s.transitionReport(r.id, 'under_review', 'Triaging.', MOD);
  ok(t1.status === 'under_review', 'reported → under_review');
  throwsCode(() => s.transitionReport(r.id, 'resolved', 'skip', MOD), 'ILLEGAL_TRANSITION', 'under_review → resolved rejected (must accept first)');
  throwsCode(() => s.transitionReport(r.id, 'verified', '', MOD), 'VALIDATION', 'transition without written reason rejected');
  const t2 = s.transitionReport(r.id, 'verified', 'Legitimate submission.', MOD);
  ok(t2.status === 'verified', 'under_review → verified (submission accepted)');
  ok(t2.informationState === 'citizen_submitted', 'accepting a report does NOT verify the claim');
  const b = s.getReport(r.id);
  const tr = b.events.find((e) => e.event === 'status_changed' && e.newStatus === 'verified');
  ok(!!tr && tr.oldStatus === 'under_review' && !!tr.note, 'transition event records old/new + reason');
  const t3 = s.transitionReport(r.id, 'resolved', 'Referred to works dept.', MOD);
  ok(t3.status === 'resolved' && !!t3.resolvedAt && t3.resolutionNote === 'Referred to works dept.', 'resolution recorded');
}

// ---- 10. Evidence review by moderator ----
{
  const s = svc.createReportService();
  const r = s.submitReport({ ...VALID }, CITIZEN);
  const ev = s.addEvidence(r.id, { evidenceType: 'photo', storageRef: 'session:q' }, CITIZEN);
  const rev = s.reviewEvidence(ev.id, 'accepted', 'Relevant and intact.', MOD);
  ok(rev.reviewState === 'accepted', 'moderator accepts evidence');
  throwsCode(() => s.reviewEvidence(ev.id, 'accepted', '', MOD), 'VALIDATION', 'evidence review without reason rejected');
  throwsCode(() => s.reviewEvidence('ev_nope', 'accepted', 'x', MOD), 'NOT_FOUND', 'review of missing evidence rejected');
}

// ---- 11. Claim creation from reports: never verified ----
{
  const s = svc.createReportService();
  const r = s.submitReport({ ...VALID }, CITIZEN);
  throwsCode(() => s.createClaimFromReport(r.id, { claimKey: 'k', claimLabel: 'l', claimValue: 'v' }, MOD), 'ILLEGAL_TRANSITION', 'claim from untriaged report rejected');
  s.transitionReport(r.id, 'under_review', 'triage', MOD);
  s.transitionReport(r.id, 'verified', 'accepted', MOD);
  const { claim, link } = s.createClaimFromReport(
    r.id, { claimKey: 'road.condition', claimLabel: 'Road condition', claimValue: 'Poor' }, MOD,
  );
  ok(claim.informationState === 'citizen_submitted', 'claim without accepted evidence enters citizen_submitted');
  ok(claim.informationState !== 'verified', 'claim is NEVER born verified');
  ok(claim.ingestChannel === 'citizen_portal', 'claim carries citizen_portal channel');
  ok(link.relationship === 'originated_from', 'originated_from link recorded');
  ok(claim.sources.length === 1 && claim.sources[0].source.sourceType === 'citizen_evidence', 'originating report attached as citizen_evidence');
  ok(claim.sources[0].role === 'corroborating', 'report source is corroborating, never primary_evidence');
  ok(claim.events[0].event === 'submitted' && claim.events[0].newState === claim.informationState, 'claim history starts at submitted');

  // With accepted evidence → source_backed. Still never verified.
  const r2 = s.submitReport({ ...VALID }, CITIZEN);
  const ev = s.addEvidence(r2.id, { evidenceType: 'photo', storageRef: 'session:w' }, CITIZEN);
  s.transitionReport(r2.id, 'under_review', 'triage', MOD);
  s.reviewEvidence(ev.id, 'accepted', 'Relevant.', MOD);
  s.transitionReport(r2.id, 'verified', 'accepted', MOD);
  const c2 = s.createClaimFromReport(r2.id, { claimKey: 'k2', claimLabel: 'l2', claimValue: 'v2' }, MOD).claim;
  ok(c2.informationState === 'source_backed', 'claim with accepted evidence enters source_backed');
  ok(c2.informationState !== 'verified', 'still never verified');
}

// ---- 12. The verification gate itself ----
{
  ok(reporting.claimInitialStateForReport(false) === 'citizen_submitted', 'report intake mapping: no source → citizen_submitted');
  ok(reporting.claimInitialStateForReport(true) === 'source_backed', 'report intake mapping: identifiable source → source_backed');
  let threw = false;
  try { reporting.assertClaimNotVerifiedFromReport('verified'); } catch { threw = true; }
  ok(threw, 'assertClaimNotVerifiedFromReport refuses verified');
}

// ---- 13. Duplicates: preserved, linked, never deleted ----
{
  const s = svc.createReportService();
  const a = s.submitReport({ ...VALID }, CITIZEN);
  const b = s.submitReport({ ...VALID, title: 'Potholes near market entrance' }, CITIZEN);
  const dups = s.findPossibleDuplicates(b.id);
  ok(dups.some((d) => d.id === a.id), 'possible duplicate surfaced (same category + jurisdiction + 72h)');
  const m = s.markDuplicate(b.id, a.id, 'Same condition.', MOD);
  ok(m.status === 'duplicate' && m.duplicateOf === a.id, 'marked duplicate, link recorded');
  ok(!!s.getReport(b.id), 'duplicate report preserved, not deleted');
  throwsCode(() => s.markDuplicate(a.id, a.id, 'x', MOD), 'VALIDATION', 'self-duplicate rejected');
}

// ---- 14. Rate limiting is operational, not a score ----
{
  const s = svc.createReportService();
  const fp = { role: 'citizen', fingerprint: 'flood-fp' };
  for (let i = 0; i < 10; i++) s.submitReport({ ...VALID, geom: null, locationStatus: 'unavailable', geoEntityId: null }, fp);
  throwsCode(() => s.submitReport({ ...VALID, geom: null, locationStatus: 'unavailable', geoEntityId: null }, fp), 'RATE_LIMITED', '11th submission in an hour refused');
  ok(s.intakeCount('flood-fp', Date.now() - 3600 * 1000) === 10, 'intake log counts submissions');
}

// ---- 15. History is append-only; citizens cannot forge moderation events ----
{
  const s = svc.createReportService();
  const r = s.submitReport({ ...VALID }, CITIZEN);
  s.addNote(r.id, 'note one', CITIZEN);
  s.addNote(r.id, 'note two', CITIZEN);
  const n0 = s.getReport(r.id).events.length;
  s.transitionReport(r.id, 'under_review', 'triage', MOD);
  const evts = s.getReport(r.id).events;
  ok(evts.length === n0 + 1, 'moderation appends, never rewrites');
  ok(evts.every((e, i, arr) => i === 0 || arr[i - 1].createdAt <= e.createdAt), 'event order preserved');
  ok(evts.filter((e) => e.actorType === 'citizen').every((e) => e.event === 'note' || e.event === 'created' || e.event === 'evidence_added'),
    'citizen-authored events are intake-only');
}

// ---- 16. Report discovery: search finds real reports, honest empties ----
{
  const s = svc.createReportService();
  const r = s.submitReport({ ...VALID }, CITIZEN);
  const g = reporting.searchReports(
    [r], () => 'Kosofe', 'pothole',
  );
  ok(!!g && g.group === 'Citizen reports' && g.items[0].reportId === r.id, 'search finds the submitted report');
  ok(reporting.searchReports([r], () => '', 'zzz-no-match') === null, 'no match → null (no group)');
  ok(reporting.searchReports([], () => '', 'pothole') === null, 'zero reports → null (honest empty)');
  ok(reporting.searchReports([r], () => '', 'x') === null, 'short query → null');
}

// ---- 17. Production singleton starts empty; fixtures stay in tests ----
{
  const st = reportService.stats();
  ok(st.reports === 0 && st.evidence === 0 && st.claims === 0, 'shared service starts with zero records');
}

// ---- 18. Workflow lifecycle matrix ----
{
  const legal = { reported: ['under_review', 'rejected', 'duplicate'] };
  ok(reporting.canTransitionReport('reported', 'under_review'), 'reported → under_review legal');
  ok(!reporting.canTransitionReport('reported', 'resolved'), 'reported → resolved illegal');
  ok(!reporting.canTransitionReport('reported', 'in_progress'), 'reported → in_progress illegal (must be accepted first)');
  ok(reporting.canTransitionReport('resolved', 'under_review'), 'resolved → under_review (reopen) legal');
  ok(reporting.allowedReportTransitions('reported').join(',') === legal.reported.join(','), 'allowedReportTransitions matches matrix');
  ok(reporting.REPORT_STATUS_LABEL.verified === 'Submission accepted', 'verified renders as "Submission accepted"');
  ok(!Object.values(reporting.REPORT_STATUS_LABEL).includes('VERIFIED'), 'no bare VERIFIED badge text');
}

console.log(`\nphase3: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
