# MapLibre Worker Fix — Windows Transfer

**What this is:** the complete, verified fix for the map failing to load in your
Edge session (`/workers/[object Object]` → `net::ERR_ABORTED 404`, "Worker
failed to load"). Copy these files into your extracted project on Windows,
overwriting the files with the same names.

**I cannot copy these to your PC myself** — I have no access to your Windows
filesystem. You copy them.

---

## Files in this folder (copy each to the same relative path in your project)

| This file | Copy to (inside your project folder) |
|---|---|
| `package.json` | `package.json` (overwrite) |
| `eslint.config.mjs` | `eslint.config.mjs` (overwrite) |
| `src/lib/mapController.ts` | `src\lib\mapController.ts` (overwrite) |
| `scripts/copy-maplibre-workers.mjs` | `scripts\copy-maplibre-workers.mjs` (new file) |
| `public/workers/*.mjs` (4 files) | `public\workers\` (new folder; optional — see step 3) |

## Steps (PowerShell, inside your project folder)

1. Copy the files above into your project, preserving the folder structure.
2. Install dependencies if you have not already:
   `npm install`
   (This runs `postinstall` automatically, which copies the worker files for you.)
3. If you skip `npm install`, generate the worker files manually:
   `npm run postinstall`
   (This creates `public\workers\` with the 4 files. Alternatively, just copy
   the `public\workers\` folder from this transfer directly.)
4. Start the app:
   `npm run dev`
5. Open http://localhost:3000 in Edge.

## What you should see (the fix working)

- The Nigeria map loads and renders (not a gray box).
- Press **F12 → Console**: no "Worker failed to load", no `/[object Object]`
  request, no 404s.
- Press **F12 → Network**, filter `workers`: you should see
  `maplibre-gl-worker-dev.mjs` load with **200**.
- Select **Lagos** (click it on the map or use the state dropdown): the state
  highlights, LGA boundaries appear, and there are no `sel-line` errors.

## What changed (for reference)

- `package.json`: added `"postinstall": "node scripts/copy-maplibre-workers.mjs"`.
- `scripts/copy-maplibre-workers.mjs`: NEW. Copies the 4 MapLibre worker files
  from the installed `maplibre-gl` package into `public/workers/`. Fails loudly
  if any file is missing.
- `src/lib/mapController.ts`: sets MapLibre's official `config.WORKER_URL`
  before the map is created — `/workers/maplibre-gl-worker-dev.mjs` in dev,
  `/workers/maplibre-gl-worker.mjs` in production. Nothing else in this file
  changed; map CSS and map style untouched.
- `eslint.config.mjs`: ignores `public/workers/**` (vendored third-party code).

No other files changed. Phase 3 remains open until you have tested it yourself.
Phase 4 has not started.
