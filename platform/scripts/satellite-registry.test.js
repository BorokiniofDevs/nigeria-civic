// scripts/satellite-registry.test.js — Batch A: imagery provider ladder.
//
// Plain Node script (CommonJS require by design — this file is not part of
// the TypeScript application bundle). Compiles the satellite lib in isolation
// and asserts ladder ordering, graceful fallback, session degradation,
// key-gating, and the pinned-override path.
/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PLATFORM = path.resolve(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'civic-satreg-'));
const OUT = path.join(TMP, 'out');

const tsconfig = {
  compilerOptions: {
    target: 'es2020', module: 'commonjs', moduleResolution: 'node',
    esModuleInterop: true, skipLibCheck: true, resolveJsonModule: true,
    outDir: OUT,
    rootDir: path.join(PLATFORM, 'src'),
    baseUrl: path.join(PLATFORM, 'src'),
    paths: { '@/*': ['./*'] },
    // registry.ts reads process.env (same as the app's own tsconfig, which
    // includes @types/node); point the isolated compile at the app's types.
    typeRoots: [path.join(PLATFORM, 'node_modules/@types')],
    types: ['node'],
  },
  include: [
    path.join(PLATFORM, 'src/lib/satellite/types.ts'),
    path.join(PLATFORM, 'src/lib/satellite/registry.ts'),
    path.join(PLATFORM, 'src/lib/satellite/stubProvider.ts'),
    path.join(PLATFORM, 'src/lib/geo.ts'),
  ],
};
fs.writeFileSync(path.join(TMP, 'tsconfig.json'), JSON.stringify(tsconfig));
execSync('npx tsc -p ' + JSON.stringify(path.join(TMP, 'tsconfig.json')), {
  cwd: PLATFORM, stdio: 'pipe',
});

const reg = require(OUT + '/lib/satellite/registry.js');

let passed = 0, failed = 0;
function ok(cond, label) {
  if (cond) { passed++; }
  else { failed++; console.log('  FAIL:', label); }
}

const AOI = {
  id: 'test-aoi', name: 'Test AOI',
  polygon: [[[3.3, 6.5], [3.4, 6.5], [3.4, 6.6], [3.3, 6.5]]],
  label: 'Test AOI — fixture',
};

function failingEntry(id, rank) {
  return {
    descriptor: {
      id, name: `Test ${id}`, rank, kind: 'open',
      keyRequirement: 'none', costTier: 'open',
      capabilities: 'test', maxResolutionM: null,
      license: 'test', implemented: true,
    },
    create: () => ({
      id, name: `Test ${id}`, kind: 'open',
      catalog: () => ({
        getLatest: async () => { throw new Error('simulated provider outage'); },
        getHistory: async () => [],
      }),
    }),
  };
}

function keyedEntry(id, rank) {
  return {
    descriptor: {
      id, name: `Test ${id}`, rank, kind: 'open',
      keyRequirement: 'required', costTier: 'free-keyed',
      capabilities: 'test', maxResolutionM: null,
      license: 'test', implemented: true,
    },
    create: () => ({
      id, name: `Test ${id}`, kind: 'open',
      catalog: () => ({
        getLatest: async () => ({
          id: `${id}-obs`, providerId: id, acquisitionDate: '2026-09-01',
          cloudCoverPct: 5, resolutionM: 10, tileTemplate: null,
          attribution: 'test',
        }),
        getHistory: async () => [],
      }),
    }),
  };
}

async function main() {
  // ---- 1. Ladder ordering: rank, then tier, then id ----
  {
    const ids = reg.listProviders().map((d) => d.id);
    ok(JSON.stringify(ids) === JSON.stringify(['sentinel-2-open', 'planet-commercial', 'stub-esri']),
      `ladder order is sentinel-2-open, planet-commercial, stub-esri (got ${ids.join(',')})`);
  }

  // ---- 2. Strictly-keyless default: stub serves, designed rungs report honestly ----
  {
    const active = reg.resolveActiveProvider();
    ok(active && active.id === 'stub-esri', 'resolveActiveProvider returns stub-esri when keyless');
    const r = await reg.getObservationWithFallback(AOI);
    ok(r.providerId === 'stub-esri', 'fallback serves stub-esri');
    ok(r.observation.providerId === 'stub-esri', 'observation carries provider id');
    const skipIds = r.skipped.map((s) => s.providerId);
    ok(skipIds.includes('sentinel-2-open') && skipIds.includes('planet-commercial'),
      'designed rungs appear in the skip trail');
    const s2 = r.skipped.find((s) => s.providerId === 'sentinel-2-open');
    ok(s2 && /not yet implemented/.test(s2.reason), 'sentinel rung says "not yet implemented"');
    const pl = r.skipped.find((s) => s.providerId === 'planet-commercial');
    ok(pl && /spend not approved/.test(pl.reason), 'planet rung says spend not approved');
  }

  // ---- 3. Pinned path unchanged ----
  {
    const p = reg.getSatelliteProvider('stub-esri');
    ok(p.id === 'stub-esri', 'pinned stub-esri resolves');
    let threw = false;
    try { reg.getSatelliteProvider('no-such-provider'); } catch (e) { threw = /Unknown satellite provider/.test(e.message); }
    ok(threw, 'unknown pinned id throws honestly');
    let threwUnimpl = false;
    try { reg.getSatelliteProvider('sentinel-2-open'); } catch (e) { threwUnimpl = /Unknown satellite provider/.test(e.message); }
    ok(threwUnimpl, 'unimplemented rung cannot be pinned');
  }

  // ---- 4. Erroring rung degrades for the session, then is skipped ----
  {
    reg.testOnly_register(failingEntry('test-flaky', -1));
    const r1 = await reg.getObservationWithFallback(AOI);
    ok(r1.providerId === 'stub-esri', 'outage rung falls back to stub');
    const f1 = r1.skipped.find((s) => s.providerId === 'test-flaky');
    ok(f1 && /simulated provider outage/.test(f1.reason), 'first skip records the real error');
    const r2 = await reg.getObservationWithFallback(AOI);
    const f2 = r2.skipped.find((s) => s.providerId === 'test-flaky');
    ok(f2 && /temporarily degraded/.test(f2.reason), 'second call skips without retrying');
    reg.testOnly_remove('test-flaky');
    reg.testOnly_clearDegraded();
    const ids = reg.listProviders().map((d) => d.id);
    ok(!ids.includes('test-flaky'), 'test rung removed cleanly');
  }

  // ---- 5. Key-gated rung: skipped until presence flag set; flag is presence-only ----
  {
    reg.testOnly_register(keyedEntry('test-keyed', -1));
    const r1 = await reg.getObservationWithFallback(AOI);
    const k1 = r1.skipped.find((s) => s.providerId === 'test-keyed');
    ok(k1 && /key not configured/.test(k1.reason), 'keyed rung skipped without flag');
    ok(r1.providerId === 'stub-esri', 'still falls back to stub');
    process.env.NEXT_PUBLIC_SAT_KEY_TEST_KEYED = '1';
    const r2 = await reg.getObservationWithFallback(AOI);
    ok(r2.providerId === 'test-keyed', 'presence flag promotes the keyed rung');
    ok(r2.observation.acquisitionDate === '2026-09-01', 'keyed observation carries its date');
    delete process.env.NEXT_PUBLIC_SAT_KEY_TEST_KEYED;
    reg.testOnly_remove('test-keyed');
    reg.testOnly_clearDegraded();
  }

  // ---- 6. listSatelliteProviders backwards compatibility ----
  {
    const ids = reg.listSatelliteProviders();
    ok(Array.isArray(ids) && ids.includes('stub-esri'), 'listSatelliteProviders still works');
  }

  console.log(`\nsatellite-registry: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('TEST CRASH:', e); process.exit(1); });
