# Architecture — Nigeria Civic Intelligence Platform (v0.1, proposed)

Status: proposal. Confirm the stack choices below before Phase 1 implementation begins.

## 1. Guiding decisions

- **Geography-first.** Every civic record resolves to a `geo_entities` row. Routing, search,
  breadcrumbs and panels are spatial, not textual.
- **Verification as a first-class citizen.** Source, verification status, effective dates and
  history live on every factual table. Unverified data is explicitly labelled, never silently filled.
- **Map-first UI.** MapLibre GL JS; vector tiles for boundaries; split-view on desktop,
  bottom-sheet on mobile. Pan/zoom drill-down Nigeria → State → LGA → LCDA → Ward.
- **Monorepo.** One repo, phased delivery: web app → admin control center → workers.

## 2. Proposed stack

| Layer | Choice | Why |
|---|---|---|
| Web app | Next.js (App Router) + TypeScript | SSR for SEO on civic content, route groups for admin |
| Maps | MapLibre GL JS | Open, no token lock-in, vector tiles, fine layer control |
| Database | PostgreSQL + PostGIS (managed, e.g. Supabase) | Real geospatial queries: proximity, containment, nearest-authority |
| API | Next.js Route Handlers initially; extract a service later if needed | Keep Phase 1–2 simple |
| Auth | Provider auth (e.g. Supabase Auth) | Citizens + role-based access (citizen / verifier / admin / authority) |
| Storage | Object storage (evidence media, documents, headshots) | Attribution metadata stored alongside every file |
| Tiles | Self-hosted boundary vector tiles (tippecanoe) or pg_tileserv | Boundaries must come from labelled sources |
| Background jobs | pg_cron or a small worker | Escalation evaluation + staleness sweeps |
| Search | Postgres full-text (`tsvector`) + `pg_trgm` | One materialised `search_index`, refreshed on a schedule |

Alternatives are fine — but decide before Phase 1 so migrations and app code agree.

## 3. Core services (to build)

- **Verification engine.** Freshness scoring per record; stale flags; conflict detection
  (two credible sources disagree → `disputed`); history preservation — never destructive overwrite.
- **Geo-routing engine.** Input: report category + coordinates. Output: responsible institution
  + nearest appropriate facility. Proximity AND institutional responsibility — nearest ≠ responsible.
- **Escalation engine.** Configurable rules (category, severity, geography, no-ack/no-action
  timers, repeat-report thresholds) evaluated on schedule; never hard-coded.
- **News / civic-brief pipeline.** Ingest official releases + reputable feeds → dedupe →
  AI-drafted summaries with source links → human review before publish. AI output always labelled.
- **Change-request workflow.** propose → evidence → review → apply + audit trail.

## 4. Data-sourcing strategy (Lagos pilot)

1. **Boundaries:** seek official LGA/LCDA boundary data (Lagos State / OSGOF). Fallback: OSM,
   explicitly labelled as the source. No invented polygons.
2. **Officials:** National Assembly site, Lagos State government portal, INEC — entered with
   source URLs and verification status. No invented office-holders, ever.
3. **Facilities:** Federal Ministry of Health facility registry, Lagos health directory,
   NPF public directories where published.
4. **Projects / budgets:** Lagos State budget publications and official releases;
   reputable third-party sources (e.g. BudgIT-style) only as labelled enrichment.
5. **Everything seeds as `unverified`** until an official source confirms it.

## 5. Environments & delivery

`dev → staging → prod`. Versioned SQL migrations under `db/migrations/`.
Phase acceptance criteria live in `BUILD_PLAN.md` — a phase is done only when its
Lagos-pilot demonstration works end-to-end on real (sourced) data.
