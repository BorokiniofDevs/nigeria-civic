// scripts/officials-media.test.js — Item 3: sourced portraits, bios, amounts.
//
// Compiles officialService + projectService in isolation and asserts the
// render-only-when-sourced rule: a portrait renders only with full provenance
// (URL, credit, licence, source page, check date); amounts render only with
// full source provenance. Also asserts migration 0010 mirrors the seeds and
// seeds nothing as 'verified'.
/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const PLATFORM = path.resolve(__dirname, '..');
const REPO = path.resolve(PLATFORM, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'civic-media-'));
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
    path.join(PLATFORM, 'src/lib/civic/officialService.ts'),
    path.join(PLATFORM, 'src/lib/civic/projectService.ts'),
  ],
};
fs.writeFileSync(path.join(TMP, 'tsconfig.json'), JSON.stringify(tsconfig));
execSync('npx tsc -p ' + JSON.stringify(path.join(TMP, 'tsconfig.json')), {
  cwd: PLATFORM, stdio: 'pipe',
});

const off = require(path.join(OUT, 'lib/civic/officialService.js'));
const proj = require(path.join(OUT, 'lib/civic/projectService.js'));

let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; console.log('  ok -', name); }
  catch (e) { console.error('  FAIL -', name, '\n   ', e.message); process.exitCode = 1; }
}

const holders = [...off.directory('federal'), ...off.directory('state')]
  .map((o) => o.holder).filter(Boolean);

const VERIFIED_PHOTOS = {
  'holder:sanwo-olu-2023':
    'https://upload.wikimedia.org/wikipedia/commons/9/93/Babajide_sanwo_olu_official_portrait.jpg',
  'holder:hamzat-2023':
    'https://upload.wikimedia.org/wikipedia/commons/7/7c/Femi_Hamzat_at_the_Lagos_Hackathon_2020_10.jpg',
};

test('exactly the two Lagos holders have portraits', () => {
  const withPhoto = holders.filter((h) => h.headshotUrl);
  assert.strictEqual(withPhoto.length, 2);
  assert.deepStrictEqual(withPhoto.map((h) => h.id).sort(), Object.keys(VERIFIED_PHOTOS).sort());
});

test('portrait URLs are exactly the verified Commons URLs — nothing fabricated', () => {
  for (const h of holders) {
    if (!h.headshotUrl) continue;
    assert.strictEqual(h.headshotUrl, VERIFIED_PHOTOS[h.id], h.id);
    assert.ok(/^https:\/\/upload\.wikimedia\.org\//.test(h.headshotUrl));
  }
});

test('every portrait carries full provenance (credit, licence, source page, check date)', () => {
  for (const h of holders) {
    if (!h.headshotUrl) continue;
    assert.ok(h.headshotCredit && h.headshotCredit.length > 1, h.id);
    assert.strictEqual(h.headshotLicense, 'CC BY-SA 4.0', h.id);
    assert.ok(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(h.headshotSourceUrl), h.id);
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(h.headshotCheckedAt), h.id);
    assert.ok(h.headshotCaption && h.headshotCaption.length > 5, h.id);
  }
});

test('Hamzat photo is captioned honestly as a non-official portrait', () => {
  const h = holders.find((x) => x.id === 'holder:hamzat-2023');
  assert.ok(/not an official portrait/i.test(h.headshotCaption));
});

test('every bio has a source URL and check date', () => {
  for (const h of holders) {
    if (!h.bioSummary) continue;
    assert.ok(/^https:\/\//.test(h.bioSourceUrl), h.id);
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(h.bioCheckedAt), h.id);
  }
});

test('federal holders have no portrait or bio — nothing unsourced renders', () => {
  const federal = off.directory('federal').map((o) => o.holder).filter(Boolean);
  assert.strictEqual(federal.length, 8);
  for (const h of federal) {
    assert.strictEqual(h.headshotUrl, null, h.id);
    assert.strictEqual(h.bioSummary, null, h.id);
  }
});

test('no holder record is marked verified', () => {
  for (const h of holders) assert.strictEqual(h.informationState, 'source_backed', h.id);
});

test('rail phase amounts are the sourced bond allocations', () => {
  const blue = proj.getProject('lagos-blue-line-phase-2');
  const red = proj.getProject('lagos-red-line-phase-2');
  assert.strictEqual(blue.amount.text, '₦34.635 billion');
  assert.strictEqual(red.amount.text, '₦21.646 billion');
  for (const p of [blue, red]) {
    assert.ok(/not the total contract sum/i.test(p.amount.note), p.id);
    assert.ok(/^https:\/\/independent\.ng\//.test(p.amount.sourceUrl), p.id);
    assert.strictEqual(p.amount.sourceLabel, 'Independent Nigeria, Nov 2025');
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(p.amount.checkedAt), p.id);
  }
});

test('Lekki–Epe has no amount — unpublished figures are omitted, not invented', () => {
  assert.strictEqual(proj.getProject('lekki-epe-expressway-rehab').amount, null);
});

test('migration 0010 adds columns, guards provenance, and seeds no verified rows', () => {
  const sql = fs.readFileSync(path.join(REPO, 'db/migrations/0010_officials_media.sql'), 'utf8');
  for (const col of ['headshot_url', 'headshot_credit', 'headshot_license', 'headshot_source_url',
                     'headshot_checked_at', 'bio_summary', 'amount_text', 'amount_source_url']) {
    assert.ok(sql.includes(col), col);
  }
  assert.ok(sql.includes('headshot_provenance_complete'), 'provenance CHECK constraint');
  assert.ok(sql.includes('holder:sanwo-olu-2023'));
  assert.ok(sql.includes('holder:hamzat-2023'));
  const codeOnly = sql.replace(/--[^\n]*/g, ''); // strip comments: 'verified' appears in prose
  assert.ok(!/'verified'/.test(codeOnly), 'no verified seeding in SQL statements');
  // Migration seeds match the client seeds 1:1.
  for (const h of holders.filter((x) => x.headshotUrl)) {
    assert.ok(sql.includes(h.headshotUrl), h.id);
  }
});

console.log(`\nofficials-media: ${passed} passed`);
