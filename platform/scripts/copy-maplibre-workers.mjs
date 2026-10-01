// Copies the pinned MapLibre GL worker files — plus the sibling shared modules
// each worker relatively imports — from the installed maplibre-gl package into
// public/workers/, so the app can serve them at a stable, hash-free URL.
//
// Why this exists: Next.js 16 / Turbopack miscompiles MapLibre's internal
// dynamic `new URL(`./${name}`, import.meta.url)` worker-URL computation. The
// compiled code drops the worker filename entirely, the browser ends up
// requesting /[object Object], Next.js answers with its HTML 404 page, and the
// module worker fails strict MIME checking — so the map never initializes.
// We bypass the broken computation with MapLibre's official
// `config.WORKER_URL` override (see src/lib/mapController.ts), which needs a
// real URL to point at. These files are served locally from the pinned
// package — never a CDN.
//
// Runs automatically on `npm install` via the `postinstall` script, so a fresh
// install always recreates public/workers/ from the pinned maplibre-gl version.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'node_modules', 'maplibre-gl', 'dist');
const destDir = join(root, 'public', 'workers');

// Worker file -> the sibling shared module it relatively imports.
// Both pairs are required: -dev.* for `next dev`, plain for `next build`/`start`.
const FILES = [
  'maplibre-gl-worker.mjs',
  'maplibre-gl-shared.mjs',
  'maplibre-gl-worker-dev.mjs',
  'maplibre-gl-shared-dev.mjs',
];

const missing = FILES.filter((f) => !existsSync(join(srcDir, f)));
if (missing.length > 0) {
  console.error(
    `[copy-maplibre-workers] FATAL: expected MapLibre worker files are missing from ${srcDir}:\n` +
      missing.map((f) => `  - ${f}`).join('\n') +
      `\nThe map cannot load its worker without them. Check the installed maplibre-gl version.`,
  );
  process.exit(1);
}

mkdirSync(destDir, { recursive: true });
for (const f of FILES) {
  copyFileSync(join(srcDir, f), join(destDir, f));
  console.log(`[copy-maplibre-workers] ${f} -> public/workers/${f}`);
}
console.log('[copy-maplibre-workers] done.');
