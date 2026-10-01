// scripts/streetview-registry.test.js — Item 1: street-level imagery ladder.
//
// Plain Node script (CommonJS require by design — this file is not part of
// the TypeScript application bundle). Compiles the streetview lib in isolation
// and asserts URL builders, ladder resolution (keyed Google Embed rung →
// keyless Commons photos → external-link fallback), and the Commons parser.
//
// No live network: resolveStreetView is exercised with global.fetch stubbed.
/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const PLATFORM = path.resolve(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'civic-streetview-'));
const OUT = path.join(TMP, 'out');

const tsconfig = {
  compilerOptions: {
    target: 'es2020', module: 'commonjs', moduleResolution: 'node',
    esModuleInterop: true, skipLibCheck: true,
    outDir: OUT,
    rootDir: path.join(PLATFORM, 'src'),
    // registry.ts reads process.env; point the isolated compile at the
    // app's types, exactly as the satellite suite does.
    typeRoots: [path.join(PLATFORM, 'node_modules/@types')],
    types: ['node'],
  },
  include: [
    path.join(PLATFORM, 'src/lib/streetview/types.ts'),
    path.join(PLATFORM, 'src/lib/streetview/registry.ts'),
  ],
};
fs.writeFileSync(path.join(TMP, 'tsconfig.json'), JSON.stringify(tsconfig));
execSync('npx tsc -p ' + JSON.stringify(path.join(TMP, 'tsconfig.json')), {
  cwd: PLATFORM, stdio: 'pipe',
});

const reg = require(path.join(OUT, 'lib/streetview/registry.js'));

const realFetch = global.fetch;
const realKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY;

let passed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log('  ok -', name);
  } catch (e) {
    console.error('  FAIL -', name, '\n   ', e.message);
    process.exitCode = 1;
  } finally {
    global.fetch = realFetch;
    if (realKey === undefined) delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY;
    else process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY = realKey;
  }
}

const FIXTURE = {
  query: {
    pages: {
      1: {
        title: 'File:Lagos street.jpg',
        imageinfo: [{
          url: 'https://upload.wikimedia.org/full.jpg',
          thumburl: 'https://upload.wikimedia.org/thumb.jpg',
          descriptionurl: 'https://commons.wikimedia.org/wiki/File:Lagos_street.jpg',
          extmetadata: {
            Artist: { value: '<a href="x">Adaeze O.</a>' },
            LicenseShortName: { value: 'CC BY-SA 4.0' },
            DateTimeOriginal: { value: '2024-03-11' },
          },
        }],
      },
      2: { title: 'File:No imageinfo.jpg' },
    },
  },
};

(async () => {
  await test('googlePanoLink builds the keyless deep link', () => {
    const u = reg.googlePanoLink(6.5244, 3.3792);
    assert.ok(u.startsWith('https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=6.5244,3.3792'), u);
  });

  await test('googleEmbedUrl encodes the key and location', () => {
    const u = reg.googleEmbedUrl(6.5244, 3.3792, 'KEY WITH SPACE');
    assert.ok(u.includes('key=KEY%20WITH%20SPACE'), u);
    assert.ok(u.includes('location=6.5244,3.3792'), u);
    assert.ok(u.includes('/maps/embed/v1/streetview'), u);
  });

  await test('googleEmbedKey returns null when unset, value when set', () => {
    delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY;
    assert.strictEqual(reg.googleEmbedKey(), null);
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY = '  abc123  ';
    assert.strictEqual(reg.googleEmbedKey(), 'abc123');
  });

  await test('parseCommonsResponse parses photos, strips HTML, skips imageless pages', () => {
    const photos = reg.parseCommonsResponse(FIXTURE);
    assert.strictEqual(photos.length, 1);
    const p = photos[0];
    assert.strictEqual(p.title, 'Lagos street.jpg');
    assert.strictEqual(p.author, 'Adaeze O.');
    assert.strictEqual(p.license, 'CC BY-SA 4.0');
    assert.strictEqual(p.dateTaken, '2024-03-11');
    assert.strictEqual(p.thumbUrl, 'https://upload.wikimedia.org/thumb.jpg');
    assert.ok(p.filePageUrl.includes('commons.wikimedia.org'), p.filePageUrl);
  });

  await test('parseCommonsResponse returns [] for empty/garbled payloads', () => {
    assert.deepStrictEqual(reg.parseCommonsResponse({}), []);
    assert.deepStrictEqual(reg.parseCommonsResponse({ query: {} }), []);
    assert.deepStrictEqual(reg.parseCommonsResponse(null), []);
  });

  await test('resolveStreetView: with key → google-embed, no network needed', async () => {
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY = 'TESTKEY';
    global.fetch = () => { throw new Error('network must not be touched when keyed'); };
    const r = await reg.resolveStreetView(6.5244, 3.3792);
    assert.strictEqual(r.kind, 'google-embed');
    assert.ok(r.embedUrl.includes('key=TESTKEY'), r.embedUrl);
    assert.ok(r.externalUrl.includes('map_action=pano'), r.externalUrl);
    assert.ok(r.notice.toLowerCase().includes('never live'), 'notice must state imagery is never live');
  });

  await test('resolveStreetView: no key + Commons photos → commons-photos', async () => {
    delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY;
    global.fetch = async () => ({ ok: true, json: async () => FIXTURE });
    const r = await reg.resolveStreetView(6.5244, 3.3792);
    assert.strictEqual(r.kind, 'commons-photos');
    assert.strictEqual(r.embedUrl, null);
    assert.strictEqual(r.photos.length, 1);
    assert.ok(r.externalUrl.includes('map_action=pano'), r.externalUrl);
  });

  await test('resolveStreetView: no key + no photos → external-link fallback', async () => {
    delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY;
    global.fetch = async () => ({ ok: true, json: async () => ({ query: { pages: {} } }) });
    const r = await reg.resolveStreetView(6.5244, 3.3792);
    assert.strictEqual(r.kind, 'external-link');
    assert.strictEqual(r.photos.length, 0);
    assert.ok(r.externalUrl.includes('viewpoint=6.5244,3.3792'), r.externalUrl);
  });

  await test('resolveStreetView: no key + Commons down → external-link, never throws', async () => {
    delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY;
    global.fetch = async () => { throw new Error('offline'); };
    const r = await reg.resolveStreetView(6.5244, 3.3792);
    assert.strictEqual(r.kind, 'external-link');
  });

  console.log(`\nstreetview-registry: ${passed} passed`);
})();
