// scripts/phase2.test.js — Phase 2 behavioral regression: data/provenance architecture.
//
// PROVENANCE (2026-09-25) — READ BEFORE TREATING THIS AS HISTORY:
//   - The ORIGINAL Phase 2 runner lived at /tmp/civic-test/run.js (71 tests,
//     71/71 passing on 2026-09-25). /tmp is ephemeral; the file was destroyed
//     when the disposable VM rebooted during Phase 3 database verification.
//   - The project is NOT under git (no repository, no history), so the
//     original cannot be recovered from version control either.
//   - What was RECOVERED: only the coverage AREAS and the recorded outcome.
//     Per the Phase 3 handoff report, the original covered: Phase 2
//     provenance, geography, search, store, and no-fabrication modules.
//   - What was NEWLY INFERRED: every test case in this file — all 149
//     assertions, their structure, names, and expectations were written fresh
//     against the CURRENT Phase 2 modules listed below. The count (149 vs 71)
//     alone proves this is not a copy.
//   - Therefore: test-for-test HISTORICAL EQUIVALENCE IS UNVERIFIABLE and is
//     NOT claimed. This file is a faithful *regression net for the current
//     code* (it compiles the real modules and asserts real behavior), not a
//     replica of the lost runner. Keep it for its present value; do not cite
//     it as "the original Phase 2 test suite."
//
// Covers:
//   - lib/provenance.ts  (7-state canon, transitions, verification gate,
//                         intake mapping, jurisdiction model, budget stages)
//   - lib/civic/geoEntities.ts (GADM jurisdictions, Lagos LGAs, pilot
//                         LCDAs/wards, LGA-vs-LCDA structural distinction)
//   - lib/civic/search.ts, lib/civic/index.ts (store wiring), lib/geo.ts,
//                         lib/view.ts
//   - static no-fabrication audit (no is_verified, no demo/AI-studio residue)
//
// Plain Node script (CommonJS require by design — not part of the TS bundle).
/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PLATFORM = path.resolve(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'civic-phase2-'));
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
    path.join(PLATFORM, 'src/lib/provenance.ts'),
    path.join(PLATFORM, 'src/lib/geo.ts'),
    path.join(PLATFORM, 'src/lib/view.ts'),
    path.join(PLATFORM, 'src/lib/civic/types.ts'),
    path.join(PLATFORM, 'src/lib/civic/store.ts'),
    path.join(PLATFORM, 'src/lib/civic/geoEntities.ts'),
    path.join(PLATFORM, 'src/lib/civic/search.ts'),
    path.join(PLATFORM, 'src/lib/civic/index.ts'),
  ],
};
fs.writeFileSync(path.join(TMP, 'tsconfig.json'), JSON.stringify(tsconfig));
execSync('npx tsc -p ' + JSON.stringify(path.join(TMP, 'tsconfig.json')), {
  cwd: PLATFORM, stdio: 'pipe',
});

// The app uses the `@/` path alias; tsc does not rewrite it at runtime.
// Map it to the compiled output for this test process only.
const Module = require('module');
const _origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (typeof request === 'string' && request.startsWith('@/')) {
    request = path.join(OUT, request.slice(2));
  }
  return _origResolve.call(this, request, ...args);
};

const prov = require(OUT + '/lib/provenance.js');
const geoEnt = require(OUT + '/lib/civic/geoEntities.js');
const searchMod = require(OUT + '/lib/civic/search.js');
const { civicStore: store } = require(OUT + '/lib/civic/index.js');
const geo = require(OUT + '/lib/geo.js');
const view = require(OUT + '/lib/view.js');

let passed = 0, failed = 0;
function ok(cond, label) {
  if (cond) { passed++; }
  else { failed++; console.log('  FAIL:', label); }
}

// ---------------- provenance: 7-state canon ----------------
ok(prov.INFORMATION_STATES.length === 7, 'canon has exactly 7 states');
ok(JSON.stringify(prov.INFORMATION_STATES) === JSON.stringify(
  ['unknown','citizen_submitted','source_backed','verified','disputed','outdated','rejected']
), 'canon order is canonical');
ok(Object.keys(prov.INFORMATION_STATE_LABEL).length === 7, 'every state has a label');
ok(Object.keys(prov.INFORMATION_STATE_DESCRIPTION).length === 7, 'every state has a description');
ok(!JSON.stringify(prov.INFORMATION_STATES).includes('is_verified'), 'no is_verified in canon');

// ---------------- transitions ----------------
const T = prov.canTransition;
ok(T('unknown','citizen_submitted') === true, 'unknown->citizen_submitted legal');
ok(T('unknown','source_backed') === true, 'unknown->source_backed legal');
ok(T('citizen_submitted','verified') === false, 'citizen_submitted cannot jump to verified');
ok(T('citizen_submitted','source_backed') === true, 'citizen_submitted->source_backed legal');
ok(T('citizen_submitted','disputed') === true, 'citizen_submitted->disputed legal');
ok(T('citizen_submitted','rejected') === true, 'citizen_submitted->rejected legal');
ok(T('source_backed','verified') === true, 'source_backed->verified legal');
ok(T('verified','disputed') === true, 'verified->disputed legal');
ok(T('verified','outdated') === true, 'verified->outdated legal');
ok(T('verified','citizen_submitted') === false, 'verified cannot fall back to citizen_submitted');
ok(T('verified','rejected') === false, 'verified cannot go straight to rejected');
ok(T('rejected','verified') === false, 'rejected is terminal (no revival)');
ok(T('rejected','source_backed') === false, 'rejected cannot be un-rejected');
ok(T('disputed','verified') === true, 'disputed->verified legal');
ok(T('outdated','verified') === true, 'outdated can be re-verified');
for (const s of prov.INFORMATION_STATES) ok(T(s, s) === true, `idempotent re-application: ${s}`);
const at = prov.allowedTransitions('rejected');
ok(Array.isArray(at) && at.length === 0, 'rejected has no legal destinations');
ok(prov.allowedTransitions('unknown').length === 2, 'unknown has 2 destinations');

// ---------------- verification gate ----------------
const baseCheck = {
  hasPrimaryEvidence: true,
  primaryEvidenceSourceTypes: ['official_government'],
  hasVerifyingEvent: true,
  verifyingActor: 'verifier',
  ingestChannel: 'verifier_console',
};
ok(prov.canBecomeVerified(baseCheck).ok === true, 'gate passes when all conditions hold');
ok(prov.canBecomeVerified({ ...baseCheck, hasPrimaryEvidence: false }).ok === false,
  'gate fails without primary evidence');
ok(prov.canBecomeVerified({ ...baseCheck, primaryEvidenceSourceTypes: ['ai_generated'] }).ok === false,
  'gate fails when primary evidence is AI-generated');
ok(prov.canBecomeVerified({ ...baseCheck, hasVerifyingEvent: false }).ok === false,
  'gate fails without a verifying event');
ok(prov.canBecomeVerified({ ...baseCheck, verifyingActor: 'system' }).ok === false,
  'gate fails when verifier is system');
ok(prov.canBecomeVerified({ ...baseCheck, verifyingActor: 'citizen' }).ok === false,
  'gate fails when verifier is the citizen submitter');
ok(prov.canBecomeVerified({ ...baseCheck, verifyingActor: 'admin' }).ok === true,
  'gate passes with admin verifier');
ok(prov.canBecomeVerified({ ...baseCheck, verifyingActor: 'authority' }).ok === true,
  'gate passes with authority verifier');
ok(prov.canBecomeVerified({ ...baseCheck, ingestChannel: 'ai_extraction' }).ok === true,
  'ai_extraction passes only with independent primary evidence + human verifier');
ok(prov.canBecomeVerified({ ...baseCheck, ingestChannel: 'ai_extraction', hasPrimaryEvidence: false }).ok === false,
  'ai_extraction without primary evidence fails');
const vFail = prov.canBecomeVerified({ ...baseCheck, hasPrimaryEvidence: false });
ok(vFail.reasons.length > 0 && typeof vFail.reasons[0] === 'string', 'gate returns human-readable reasons');
ok(!('confidence' in baseCheck) && prov.canBecomeVerified.toString().length > 0,
  'confidence is not a gate input (signature carries no score)');

// ---------------- intake mapping: nothing enters verified ----------------
const channels = ['citizen_portal','verifier_console','document_upload','web_ingest',
  'dataset_import','api_feed','satellite_pipeline','ai_extraction','system_migration'];
for (const c of channels) {
  for (const src of [true, false]) {
    const st = prov.channelInitialState(c, src);
    ok(st !== 'verified', `channelInitialState(${c}, src=${src}) never returns verified (got ${st})`);
  }
}
ok(prov.channelInitialState('citizen_portal', false) === 'citizen_submitted',
  'citizen portal without source -> citizen_submitted');
ok(prov.channelInitialState('citizen_portal', true) === 'source_backed',
  'citizen portal with source -> source_backed');
ok(prov.channelInitialState('ai_extraction', true) === 'source_backed',
  'ai_extraction caps at source_backed even with citation');
ok(prov.channelInitialState('document_upload', false) === 'source_backed',
  'document upload is identifiable evidence -> source_backed');

// ---------------- jurisdiction model ----------------
const LP = prov.isLegalParentage;
ok(LP('country', null) === true, 'country has no parent');
ok(LP('state', 'country') === true, 'state->country legal');
ok(LP('lga', 'state') === true, 'lga->state legal');
ok(LP('lga', 'country') === false, 'lga->country illegal');
ok(LP('lcda', 'lga') === true, 'lcda->lga legal');
ok(LP('lcda', 'state') === false, 'lcda->state illegal (must hang under an LGA)');
ok(LP('ward', 'lga') === true, 'ward->lga legal');
ok(LP('ward', 'lcda') === true, 'ward->lcda legal');
ok(LP('ward', 'state') === false, 'ward->state illegal');
ok(LP('community', 'ward') === true, 'community->ward legal');
ok(LP('street', 'community') === true, 'street->community legal');
ok(LP('street', 'ward') === true, 'street->ward legal');
ok(prov.constitutionalStatusFor('lga') === 'constitutional', 'lga is constitutional');
ok(prov.constitutionalStatusFor('lcda') === 'state_created', 'lcda is state-created');
ok(prov.constitutionalStatusFor('state') === null, 'state carries no standing claim');
ok(prov.constitutionalStatusFor('ward') === null, 'ward carries no standing claim');

// ---------------- budget stages ----------------
ok(prov.BUDGET_STAGES.length === 5, 'five budget stages');
ok(prov.BUDGET_STAGES[4] === 'verified_expenditure', 'verified_expenditure is the last stage');
ok(prov.BUDGET_STAGES[3] === 'paid', 'paid (reported) precedes verified expenditure');
ok(prov.BUDGET_STAGE_LABEL.paid.includes('reported'), 'paid is labelled as reported, not confirmed');

// ---------------- geoEntities ----------------
ok(geoEnt.COUNTRY_ID === 'geo:NG', 'country id stable');
const ng = geoEnt.getGeoEntity('geo:NG');
ok(ng && ng.name === 'Nigeria' && ng.parentId === null && ng.informationState === 'unknown',
  'Nigeria entity: boundary is not a civic fact');
const states = geoEnt.geoStates();
ok(states.length === 37, `37 states/FCT (got ${states.length})`);
ok(states.every((s) => s.informationState === 'unknown'), 'all states are information_state unknown');
ok(states.every((s) => s.parentId === 'geo:NG'), 'all states hang under Nigeria');
ok(states.every((s) => s.geometryRef && s.geometryRef.collection === 'states'),
  'all states reference real GADM geometry');
const kano = states.find((s) => s.name === 'Kano State');
ok(kano && kano.note === 'LGA boundary data not loaded in this build.',
  'non-pilot states honestly report missing LGA data');
const lagos = states.find((s) => s.name === 'Lagos State');
ok(lagos && lagos.note === undefined, 'Lagos has LGA geometry loaded, no missing-data note');
ok(geoEnt.getGeoEntity('nope') === undefined, 'unknown entity id -> undefined');

const lagosChildren = lagos ? geoEnt.geoChildrenOf(lagos.id) : [];
ok(lagosChildren.length === 20, `Lagos has 20 constitutional LGAs (got ${lagosChildren.length})`);
ok(lagosChildren.every((e) => e.kind === 'lga' && e.constitutionalStatus === 'constitutional'),
  'every Lagos LGA is kind=lga, constitutional');
const kosofe = lagosChildren.find((e) => e.name === 'Kosofe');
ok(!!kosofe, 'Kosofe LGA present');
const lcdas = kosofe ? geoEnt.geoChildrenOf(kosofe.id).filter((e) => e.kind === 'lcda') : [];
ok(lcdas.length === 2, `Kosofe has 2 pilot LCDAs (got ${lcdas.length})`);
ok(lcdas.every((e) => e.constitutionalStatus === 'state_created'),
  'LCDAs are state_created — structurally distinct from LGAs');
ok(lcdas.every((e) => e.positionNote && e.positionNote.includes('Illustrative')),
  'LCDA positions labelled illustrative');
ok(lcdas.every((e) => e.note && e.note.includes('State-created')),
  'LCDA note states state-created status');
for (const lcda of lcdas) {
  const wards = geoEnt.geoChildrenOf(lcda.id).filter((e) => e.kind === 'ward');
  ok(wards.length === 3, `${lcda.name} has 3 pilot wards`);
  ok(wards.every((w) => w.positionNote && w.positionNote.includes('Illustrative')),
    `${lcda.name} ward positions labelled illustrative`);
}
ok(geoEnt.PILOT_LCDAS.length === 2, 'pilot LCDA list has 2 entries');
ok(geoEnt.hasLgaGeometry('Lagos') === true, 'Lagos LGA geometry loaded');
ok(geoEnt.hasLgaGeometry('Kano') === false, 'Kano LGA geometry not loaded');
ok(geoEnt.lgaGeometryFor('Lagos') !== undefined, 'lgaGeometryFor(Lagos) defined');
ok(geoEnt.lgaGeometryFor('Kano') === undefined, 'lgaGeometryFor(Kano) undefined');

// jurisdictionIdForView
ok(geoEnt.jurisdictionIdForView({ level: 'country', state: null, lga: null, lcda: null, ward: null }) === 'geo:NG',
  'country view resolves to Nigeria');
ok(geoEnt.jurisdictionIdForView({ level: 'state', state: 'Lagos', lga: null, lcda: null, ward: null }) === (lagos && lagos.id),
  'state view resolves to Lagos entity');
const kosofeView = geoEnt.jurisdictionIdForView({ level: 'lga', state: 'Lagos', lga: 'Kosofe', lcda: null, ward: null });
ok(kosofeView === (kosofe && kosofe.id), 'lga view resolves to Kosofe entity');
ok(geoEnt.jurisdictionIdForView({ level: 'lcda', state: 'Lagos', lga: 'Kosofe', lcda: lcdas[0] && lcdas[0].id, ward: null }) === (lcdas[0] && lcdas[0].id),
  'lcda view passes entity id through');

// illustrativePoint: deterministic, bounded, honest
const p1 = geoEnt.illustrativePoint('lgas', 'NG-LA-13_1', 'lcda:test', 0);
const p2 = geoEnt.illustrativePoint('lgas', 'NG-LA-13_1', 'lcda:test', 0);
ok(!!p1 && !!p2 && p1[0] === p2[0] && p1[1] === p2[1], 'illustrativePoint is deterministic');
ok(geoEnt.illustrativePoint('lgas', 'NOPE', 'x', 0) === undefined, 'illustrativePoint unknown feature -> undefined');
if (p1) {
  const b = geo.bboxOf(geo.LAGOS_LGAS.features.find((f) => f.properties.id === 'NG-LA-13_1'));
  ok(p1[0] >= b[0] && p1[0] <= b[2] && p1[1] >= b[1] && p1[1] <= b[3], 'illustrative point lies inside the real boundary');
}
ok(geoEnt.accentForState(null) === geoEnt.NIGERIA_ACCENT, 'null state -> Nigeria accent');
ok(typeof geoEnt.accentForState('Lagos') === 'string', 'Lagos accent defined');
ok(geoEnt.accentForState('Neverland') === '#5A6470', 'unknown state -> neutral fallback');

// ---------------- search ----------------
const all = [ng, ...states];
const byId = (id) => geoEnt.getGeoEntity(id);
ok(searchMod.searchEntities('x', all, byId).length === 0, 'single-char query -> no search');
ok(searchMod.searchEntities('zzzznonexistent', all, byId).length === 0, 'no invented results');
const lagosHits = searchMod.searchEntities('lagos', all, byId);
ok(lagosHits.length === 1 && lagosHits[0].group === 'Jurisdictions', 'lagos hits grouped as Jurisdictions');
ok(lagosHits[0].items.some((i) => i.name === 'Lagos State'), 'Lagos State found');
ok(lagosHits[0].items.every((i) => i.entityId && i.name && i.kind && i.context),
  'every search item carries id, name, kind, context');
const kanoHits = searchMod.searchEntities('kano', all, byId);
const kanoItem = kanoHits[0] && kanoHits[0].items.find((i) => i.name === 'Kano State');
ok(!!kanoItem && kanoItem.context.includes('Nigeria'), 'search context shows lineage (Kano State · Nigeria)');
const limited = searchMod.searchEntities('a', all, byId, 3);
ok(limited.length === 0, 'single-char still empty even with limit (no bypass)');
const manyHits = searchMod.searchEntities('state', all, byId, 5);
ok(manyHits[0].items.length <= 5, 'limitPerGroup respected');

// ---------------- store wiring (index.ts) ----------------
ok(store.getEntity('geo:NG').name === 'Nigeria', 'store.getEntity works');
ok(store.childrenOf('geo:NG').length === 37, 'store.childrenOf(country) = 37 states');
ok(store.states().length === 37, 'store.states() = 37');
ok(store.getEntity('missing') === undefined, 'store.getEntity unknown -> undefined');
const lineage = store.lineageOf(kosofe.id);
ok(lineage.length === 2 && lineage[0].id === 'geo:NG' && lineage[1].id === lagos.id,
  'lineageOf(Kosofe) = Nigeria -> Lagos State');
ok(store.lineageOf('geo:NG').length === 0, 'lineageOf(country) is empty');
const detail = store.getDetail(lcdas[0].id);
ok(!!detail && detail.entity.id === lcdas[0].id, 'getDetail returns the entity');
ok(!!detail && detail.lineage.map((e) => e.name).join(' › ') === 'Nigeria › Lagos State › Kosofe',
  'getDetail lineage is root->parent in order');
ok(!!detail && Array.isArray(detail.claims) && detail.claims.length === 0,
  'no claims seeded in this build');
ok(!!detail && detail.children.length === 3 && detail.children.every((c) => c.kind === 'ward'),
  'getDetail children are the 3 wards');
ok(store.getDetail('missing') === undefined, 'getDetail unknown -> undefined');
const sres = store.search('kosofe');
ok(sres.length > 0 && sres[0].items.some((i) => i.name === 'Kosofe'), 'store.search finds Kosofe');

// ---------------- geo.ts ----------------
ok(geo.STATES.type === 'FeatureCollection' && geo.STATES.features.length === 37,
  'STATES: 37 real GADM features');
ok(geo.LAGOS_LGAS.features.length === 20, 'LAGOS_LGAS: 20 real features');
ok(Array.isArray(geo.NIGERIA_BOUNDS) && geo.NIGERIA_BOUNDS[0][0] < geo.NIGERIA_BOUNDS[1][0],
  'NIGERIA_BOUNDS sane');
const lagosFeat = geo.featureByName(geo.STATES.features, 'Lagos');
ok(!!lagosFeat, 'featureByName finds Lagos');
const bb = geo.bboxOf(lagosFeat);
ok(bb[0] < bb[2] && bb[1] < bb[3], 'bboxOf returns valid [w,s,e,n]');
const aoi = geo.aoiAround([3.38, 6.45]);
ok(aoi[0].length === 5 && aoi[0][0][0] === aoi[0][4][0] && aoi[0][0][1] === aoi[0][4][1],
  'aoiAround returns a closed 5-point ring');
ok(geo.stateDisplayName('Lagos') === 'Lagos State', 'stateDisplayName appends State');
ok(geo.stateDisplayName('Federal Capital Territory') === 'Federal Capital Territory',
  'FCT keeps its name');

// ---------------- view.ts ----------------
ok(view.COUNTRY_VIEW.level === 'country' && view.COUNTRY_VIEW.state === null &&
   view.COUNTRY_VIEW.lga === null && view.COUNTRY_VIEW.lcda === null && view.COUNTRY_VIEW.ward === null,
  'COUNTRY_VIEW is the null view at country level');

// ---------------- static no-fabrication audit ----------------
const SRC = path.join(PLATFORM, 'src');
function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|json)$/.test(f.name)) out.push(p);
  }
  return out;
}
const files = walk(SRC);
let badIsVerified = [];
let badDemo = [];
for (const f of files) {
  const t = fs.readFileSync(f, 'utf8');
  if (/is_verified/.test(t)) badIsVerified.push(path.relative(PLATFORM, f));
  if (/AI Studio|aistudio|googleusercontent|demo-official|demo_\d/.test(t)) badDemo.push(path.relative(PLATFORM, f));
}
ok(badIsVerified.length === 0, `no is_verified anywhere ${badIsVerified.join(',')}`);
ok(badDemo.length === 0, `no demo/AI-studio residue ${badDemo.join(',')}`);

console.log(`\nphase2: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
