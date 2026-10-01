# Build Plan — Nigeria Civic Intelligence Platform

Lagos is the pilot. Every phase must demonstrate end-to-end on the Lagos pilot
before the same architecture expands nationally.

## Phase 0 — Foundations ✅ (this workspace)

- [x] Master spec reviewed and internalised (55 sections)
- [x] PostGIS data model drafted (`db/schema.sql`)
- [x] Architecture proposal (`docs/ARCHITECTURE.md`)
- [x] UI design system (`docs/UI_DESIGN_SYSTEM.md`)
- [x] Goal created and tracked

## Phase 1 — Data layer

- Confirm stack; provision Postgres + PostGIS; convert `schema.sql` into versioned migrations
- Boundary sourcing manifest for Lagos (LGA/LCDA/Ward): official-first, labelled fallbacks
- Seed pipeline design: source → extract → verify → load, with audit trail from day one
- Acceptance: migrations run clean; Lagos State + sample LGAs load with geometries

## Phase 2 — Lagos pilot: map-first experience

- MapLibre app: Nigeria → Lagos → LGA → LCDA → Ward drill-down with pan/zoom
- Geographic breadcrumb (Nigeria > Lagos > Kosofe > …), clickable at every level
- Layer toggles (boundaries, institutions, facilities, projects, reports)
- Entity panel: representatives (role-distinguished), offices, facilities, projects, reports, brief
- Restrained Lagos identity (accent colours, emblem) driven by `geo_entities.identity`
- Acceptance: full drill-down works; identity switches cleanly when changing state context

## Phase 3 — Directory + admin control center

- Government directory (federal → state → local), officials with term versioning
- Police / health / emergency facility directories with jurisdiction data
- Admin: CRUD + archive, approve/reject citizen submissions, conflict resolution,
  stale-record queue, full audit log, version restore
- Institutional claim/verification flow
- Acceptance: an official's profile shows current + previous offices with sources; admin can
  resolve a conflicting record without destroying history

## Phase 4 — Reporting, routing, escalation, authority workflow

- Citizen reporting (categories, media, location, anonymity) + evidence integrity
- Geo-routing: report → responsible authority + nearest appropriate facility
- Configurable escalation rules + authority response workflow (acknowledge → resolve + audit)
- Anti-abuse: rate limits, duplicate detection, moderation queue
- Acceptance: a road report in Kosofe routes to the correct road authority, escalates when
  unacknowledged past the configured window

## Phase 5 — Money, projects, law, news

- Public finance money-trail (budget → allocation → project → payment evidence → status)
- Project tracker with map presence; legislative tracker (bills ≠ laws until verified)
- News engine (typed: official / independent / analysis / citizen) + daily civic briefs
  (national, state, local) with source-linked AI summaries
- Acceptance: a Lagos project page shows sourced budget vs. payment vs. status without inference

## Phase 6 — Search, My Area, national expansion

- Global civic search with geographic/institutional context in results
- "My Area" experience (representatives, facilities, issues, projects, brief, emergency contacts)
- State identity system generalised; onboarding of additional states reuses the Lagos architecture
- Acceptance: switching state updates map, breadcrumb, officials, identity accents — ~80% shared UI

## Phase 7 — Hardening & launch readiness

- Verification ops: staleness sweeps, conflict queues, source-priority controls
- Performance: tile caching, search index tuning, read replicas if needed
- Accessibility, privacy review (location precision minimisation), abuse playbooks
- Acceptance: pilot review with real users in Lagos; go/no-go for national rollout
