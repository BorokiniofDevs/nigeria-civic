# Nigeria Civic Intelligence Platform — Web Application

Map-first civic intelligence application. Lagos State is the pilot geography;
the architecture extends to national coverage (State → LGA → LCDA → Ward →
Community → Street).

> **Data status:** civic records, office-holders, facilities, projects, reports,
> LCDAs, wards, project areas of interest, identity accents, and imagery
> observations in this build are **labelled sample fixtures** for interaction
> design. Boundary geometry comes from GADM v4.1 (third-party dataset).
> Nothing here is a verified official record.

## Stack

- Next.js 16 (App Router) + TypeScript + React 19
- MapLibre GL v6 (vector/raster map rendering, no vendor lock-in)
- No CSS framework — hand-written GIS-instrument styling (`globals.css`)
- IBM Plex Sans + IBM Plex Mono via `next/font`

## Commands

```bash
npm install
npm run dev     # http://localhost:3000
npx tsc --noEmit
npm run build
npm start
```

No environment variables are required for the current build. Future
imagery providers (Sentinel Hub, Planet, commercial tasking) will take
credentials via `.env.local` — see `src/lib/satellite/`.

## Project structure

```
src/
  app/                 # App Router: layout, page, global styles
  components/
    CivicMap.tsx       # MapLibre mount point (client)
    SiteHeader.tsx     # Wordmark, state jump select
    Breadcrumb.tsx     # Geographic breadcrumb + Esc backtracking
    LayerRail.tsx      # Layer toggles (boundaries, labels, markers, civic map/satellite base)
    InfoPanel.tsx      # Right-hand panel: renders per geographic level + detail records
    SatellitePanel.tsx # Satellite observation panel (evidence-framed)
    SatelliteBanner.tsx# On-map imagery honesty banner
    ProvenanceDrawer.tsx# Source / verification metadata drawer
  state/
    CivicContext.tsx   # View hierarchy, history + camera restore, detail, layers, satellite
  lib/
    geo.ts             # Boundary GeoJSON loading, feature lookup, bbox math
    view.ts            # View/detail type model
    fixtures.ts       # SAMPLE fixtures (deterministic, clearly labelled)
    mapController.ts   # Imperative MapLibre controller (layers, camera, markers)
    satellite/
      types.ts         # Provider-neutral EO interfaces
      registry.ts      # Provider registry (swap implementations here)
      stubProvider.ts  # Esri World Imagery stub — honest about unknown acquisition dates
      changeDetection.ts # Change-detection result types (no fabricated results)
  data/
    nigeria-states.json  # GADM v4.1 state/FCT boundaries
    lagos-lgas.json      # GADM v4.1 Lagos LGA boundaries
```

## Key design decisions

- **The map is the application**, not a backdrop. All navigation is geographic:
  clicking a polygon, table row, or breadcrumb crumb moves the same camera.
- **Camera + history restore.** Drilling down pushes `{view, camera}` onto a
  history stack; breadcrumb/Esc pops it and restores the exact camera.
- **Provider-neutral Earth observation.** UI code depends only on
  `src/lib/satellite/types.ts`. `stubProvider.ts` is the only file that knows
  about Esri; replacing it with a Sentinel/Planet provider changes one
  registry entry. The stub deliberately reports unknown acquisition date,
  cloud cover, resolution, and history as *unknown* — the UI renders those
  states honestly instead of inventing values.
- **Honesty rules (non-negotiable):**
  - Never "live satellite imagery" — always "most recent available imagery"
    with the acquisition date shown or explicitly marked unknown.
  - Imagery is *evidence*, not proof: "a structure is visible at the project
    coordinates" — never who financed/built/completed it.
  - Change detection outputs "Detected change", never "project completed".
  - Missing data is labelled "Not verified" / "Not available", never filled in.

## Google AI Studio reference — audit status

The functional gap audit (government directory, officials, councillors,
citizen reporting, facilities, projects, public finance, legislation,
news/civic briefs, hierarchy, map navigation, satellite imagery, project
verification, search, notifications) is **blocked**: no Google AI Studio
reference implementation was found in the workspace. Awaiting the share link
or file export from the product owner before the capability matrix can be
produced and merged.

## Roadmap (post-approval)

1. Confirm production stack (PostgreSQL + PostGIS, vector tiles, auth, object storage).
2. Validate `db/schema.sql` → versioned migrations, RLS policies.
3. Official-first Lagos boundary/source manifests (replace GADM).
4. Replace fixtures incrementally with sourced, PostGIS-backed records.
5. Wire a real imagery provider behind the satellite abstraction.
