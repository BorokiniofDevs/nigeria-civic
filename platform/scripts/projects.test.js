// scripts/projects.test.js — Item 2: projects module.
//
// Plain Node script (CommonJS require by design — not part of the TS bundle).
// Compiles the project service in isolation and asserts the epistemic rules:
// seeded records are source_backed (never verified), locations are explicitly
// approximate, every project carries identifiable sources. Also asserts the
// migration 0009 defines the tables, RLS, and seeds no verified claims.
/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const PLATFORM = path.resolve(__dirname, '..');
const REPO = path.resolve(PLATFORM, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'civic-projects-'));
const OUT = path.join(TMP, 'out');

const tsconfig = {
  compilerOptions: {
    target: 'es2020', module: 'commonjs', moduleResolution: 'node',
    esModuleInterop: true, skipLibCheck: true,
    outDir: OUT,
    rootDir: path.join(PLATFORM, 'src'),
    baseUrl: path.join(PLATFORM, 'src'),
    paths: { '@/*': ['./*'] },
    typeRoots: [path.join(PLATFORM, 'node_modules/@types')],
    types: ['node'],
  },
  include: [
    path.join(PLATFORM, 'src/lib/provenance.ts'),
    path.join(PLATFORM, 'src/lib/civic/projectService.ts'),
  ],
};
fs.writeFileSync(path.join(TMP, 'tsconfig.json'), JSON.stringify(tsconfig));
execSync('npx tsc -p ' + JSON.stringify(path.join(TMP, 'tsconfig.json')), {
  cwd: PLATFORM, stdio: 'pipe',
});

const svc = require(path.join(OUT, 'lib/civic/projectService.js'));

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('  ok -', name);
  } catch (e) {
    console.error('  FAIL -', name, '\n   ', e.message);
    process.exitCode = 1;
  }
}

const LAGOS = 'geo:state:NGA.25_1';
const VALID_STATUSES = ['planned', 'under_construction', 'operational', 'suspended'];

test('seeds exactly the three sourced Lagos projects', () => {
  const all = svc.listProjects();
  assert.strictEqual(all.length, 3);
  const ids = all.map((p) => p.id).sort();
  assert.deepStrictEqual(ids, [
    'lagos-blue-line-phase-2',
    'lagos-red-line-phase-2',
    'lekki-epe-expressway-rehab',
  ]);
});

test('every seed is source_backed — never verified', () => {
  for (const p of svc.listProjects()) {
    assert.strictEqual(p.informationState, 'source_backed', p.id);
  }
});

test('every seed is scoped to the Lagos jurisdiction', () => {
  for (const p of svc.listProjects()) {
    assert.strictEqual(p.jurisdictionId, LAGOS, p.id);
  }
  assert.strictEqual(svc.listProjects(LAGOS).length, 3);
  assert.strictEqual(svc.listProjects('geo:state:NGA.99_9').length, 0);
});

test('every seed location is explicitly approximate with a location note', () => {
  for (const p of svc.listProjects()) {
    assert.strictEqual(p.coordinatePrecision, 'approximate', p.id);
    assert.ok(p.locationNote && p.locationNote.length > 10, p.id);
    assert.ok(Number.isFinite(p.lat) && Number.isFinite(p.lng), p.id);
  }
});

test('every seed carries identifiable sources with URLs and check dates', () => {
  for (const p of svc.listProjects()) {
    assert.ok(p.sources.length >= 1, p.id);
    for (const s of p.sources) {
      assert.ok(s.name && s.name.length > 5, p.id);
      assert.ok(/^https:\/\//.test(s.url), `${p.id}: ${s.url}`);
      assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(s.checkedAt), `${p.id}: ${s.checkedAt}`);
    }
  }
});

test('statuses are valid and honestly worded', () => {
  for (const p of svc.listProjects()) {
    assert.ok(VALID_STATUSES.includes(p.status), p.id);
    assert.ok(p.statusNote && p.statusNote.length > 20, p.id);
    assert.ok(svc.statusLabel(p.status).length > 0);
  }
});

test('getProject resolves by id', () => {
  const p = svc.getProject('lagos-red-line-phase-2');
  assert.ok(p && p.name.includes('Red Line'));
  assert.strictEqual(svc.getProject('no-such-project'), undefined);
});

test('migration 0009 defines tables, RLS, and seeds no verified claims', () => {
  const sql = fs.readFileSync(path.join(REPO, 'db/migrations/0009_projects.sql'), 'utf8');
  for (const t of ['projects', 'project_claims', 'project_sources']) {
    assert.ok(new RegExp(`CREATE TABLE IF NOT EXISTS ${t}`).test(sql), t);
  }
  assert.ok(sql.includes('projects_public_read'), 'RLS read policy');
  assert.ok(sql.includes('ENABLE ROW LEVEL SECURITY'), 'RLS enabled');
  assert.ok(sql.includes('information_state'), 'uses the canonical enum');
  // No INSERT may seed a verified claim.
  const inserts = sql.split('INSERT INTO');
  for (const chunk of inserts.slice(1)) {
    const stmt = chunk.split(';')[0];
    if (/project_claims/.test(stmt)) {
      assert.ok(!/'verified'/.test(stmt), 'seed claim must not be verified');
      assert.ok(/'source_backed'/.test(stmt), 'seed claims are source_backed');
    }
  }
  assert.ok(sql.includes('lagos-blue-line-phase-2'));
  assert.ok(sql.includes('lagos-red-line-phase-2'));
  assert.ok(sql.includes('lekki-epe-expressway-rehab'));
});

console.log(`\nprojects: ${passed} passed`);
