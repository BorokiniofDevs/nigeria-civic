# Nigeria Civic Intelligence Platform — Windows Handoff

**For:** Lawal · **Date:** 2026-09-25 · **Phase:** 3 (open — awaiting your hands-on test)

This document gets the current DEV application running on your own Windows PC.
No remote access to your PC is used or needed. No secrets are included in this
package — there are none to include.

---

## 1. Exact prerequisites (Windows)

- Windows 10 or 11, 64-bit.
- **Node.js 22 LTS** — download the Windows installer from https://nodejs.org
  (the "LTS" build; accept the defaults, which include npm).
- An internet connection (for `npm install`, and at runtime for the free
  CARTO/Esri map tiles — see §10).
- A code editor is optional (VS Code works fine). Git is NOT required.
- **You do NOT need:** Docker, PostgreSQL, PostGIS, any API key, or any
  `.env` file to run the frontend DEV experience. PostgreSQL was used only
  for isolated database verification on the build machine; the app you will
  run does not connect to a database at all.

## 2. Exact Node.js version

- **Recommended: Node.js 22 LTS** (any 22.x).
- Minimum: Node 20.9.0 (required by Next.js 16). Maximum tested here: Node 24.
- npm 10+ (bundled with Node 22 — no separate install).

Check after installing (new PowerShell/terminal):

```
node --version
npm --version
```

## 3. Exact commands — from ZIP to running app

1. Extract the ZIP to a short path without spaces, e.g. `C:\civic-platform`.
2. Open PowerShell (or Windows Terminal) and run:

```powershell
cd C:\civic-platform\platform
npm install
npm run dev
```

That's it. The first `npm run dev` compiles the app (10–40 seconds); later
starts are faster. Leave the terminal window open while you test.

(Alternative: `npm run build` then `npm start` runs the optimized
production build instead of the dev server. Same URL.)

## 4. Required `.env` variables

**None.** The application starts with zero environment variables.

- The only env var the code reads is `NEXT_PUBLIC_SAT_PROVIDER`, and it is
  **optional** — unset, it defaults to the built-in `stub-esri` satellite
  layer. Leave it unset.
- The `ai-studio-reference/.env.example` file belongs to the old AI Studio
  reference applet only. It is not used by this platform; ignore it.
- Do not create a `.env` file. There is nothing to put in it.

## 5. Exact command to start the development server

From the `platform` folder:

```powershell
npm run dev
```

## 6. Exact local URL / port

**http://localhost:3000** — open it in Chrome or Edge.

## 7. What you should see when it starts

- Browser tab title: "Nigeria Civic Intelligence — Civic Atlas".
- A **map-first home page**: a full map of Nigeria (CARTO Positron basemap,
  free, no token), with the Lagos pilot data loaded.
- A side **layer rail** with layer toggles and a **CITIZEN REPORTS** group.
- A **search box** and an info panel.
- The map should pan/zoom smoothly (MapLibre GL). Clicking a geography
  (State → LGA → LCDA → Ward) moves the camera and shows that geography's
  civic information.
- If the map area is blank/grey, your PC has no internet access to the tile
  servers — everything else still works except the visual basemap.

## 8. How to test the Phase 3 citizen report flow

1. In the layer rail, under **CITIZEN REPORTS**, click **"Report an observation"**.
2. **Pick a location:** click a point on the map. (Try the zoomed Lagos view.)
3. Step through the flow: title + description of the observation.
4. **Evidence:** attach a photo or file with the file picker, and/or add a
   note. In DEV the file itself is not uploaded anywhere — only its metadata
   (name, type, size) is recorded locally, exactly as the DEV store does.
5. Submit. Open the resulting report from the reports list.
6. **Wording check (important):** the report must present itself as a citizen
   submission — "An allegation, not a fact", information state
   **"Citizen submitted"** — and must NOT imply the claim was verified as
   true. "Verified" in this flow means only "submission accepted".
7. **No-location option:** start a second report, but skip picking a point on
   the map. The flow records it honestly as location unavailable instead of
   inventing coordinates. Verify the report shows no fake pin.

## 9. How to open the DEV moderator console

1. In the layer rail, under **CITIZEN REPORTS**, click **"Moderation · DEV"**.
2. The console is labelled **DEV MODERATOR**. Inside it there is a role
   switch (citizen ↔ moderator) — this is a testing aid, **not a security
   boundary**; production enforces moderation server-side.
3. Find your submitted report in the queue, open it, and inspect:
   - the report detail and its evidence list,
   - structuring a claim from the report,
   - transitioning the workflow status (each transition requires you to
     enter a reason),
   - the history/event log, which must show every action you took.
4. Confirm the history is append-only in spirit: actions are recorded as
   events; nothing is silently rewritten.

## 10. Limitations to expect locally

- **In-memory store:** everything you submit lives in the browser/server
  memory of your local run. Refreshing or restarting the dev server wipes
  reports. This is the DEV experience, not persistence.
- **No database behind the UI:** the PostgreSQL/PostGIS verification work
  was done on an isolated disposable database on the build machine. The
  Next.js app has no database connection; there is nothing for you to
  install or configure for the UI to work.
- **Moderator console is DEV-only:** the role switch is client-side. A
  production deployment must put this behind an authenticated server API
  with RLS in PostgreSQL (the migration design expects this).
- **Map needs internet:** basemap tiles (CARTO) and the satellite stub layer
  (Esri) load from public servers. Offline, the map canvas goes blank but
  the app logic still runs.
- **Satellite is a stub:** imagery is labelled with its source and is
  evidence, never proof; it is not live.
- **No real secrets exist** in this package, so there is nothing to rotate
  or protect.

## 11. How to stop the dev server

In the terminal running `npm run dev`, press **Ctrl+C**, then close the
window. (If the port is ever stuck in use: `npx kill-port 3000`.)

---

## Package contents

- `platform/` — the Next.js 16 + React 19 + MapLibre GL application
  (`node_modules` and `.next` intentionally excluded; `npm install` rebuilds them).
- `db/migrations/` — the PostgreSQL/PostGIS migrations (0001–0005), for
  reference. Not needed to run the UI.
- `docs/` — architecture and phase plans (PHASE1/2/3_PLAN.md, etc.).
- `prototype/` — the earlier single-page prototype, reference only.
- `ai-studio-reference/` — the audited AI Studio version, reference only.
- `README.md` — project overview.

**Stack:** Next.js 16.3.6 · React 19.2.8 · MapLibre GL 6.11.2 · TypeScript ·
`npm run dev` / `npm run build` / `npm start` / `npm run lint`.
No Tailwind. No map token. No database required for the DEV UI.
