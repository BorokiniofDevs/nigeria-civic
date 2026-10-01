# Nigeria Civic Intelligence Platform

**The digital map and civic information system of Nigeria — not an AI-generated dashboard about Nigeria.**

A national civic intelligence, geographic information and accountability platform built around
Nigeria's real geographic and institutional hierarchy:

**Nigeria → State → LGA → LCDA → Ward → Community → Street**

## Layout

- `docs/` — architecture, phased build plan, UI design system
- `db/` — PostGIS data model (`schema.sql`; versioned migrations to follow in Phase 1)
- `seed/` — sourcing manifests and seed scripts (everything carries source + verification; nothing invented)
- `apps/` — web app (map-first UI) and admin control center (scaffolded in Phase 2)

## Non-negotiable principles

1. Geography drives navigation, search, routing and UI behaviour.
2. No hallucination: every civic fact carries source, verification status, effective dates and history.
3. Official sources are authoritative for institutional facts; geographic services enrich location;
   citizens supply ground evidence; admins verify.
4. Map-first: the map is a primary navigation surface, not decoration.
5. Design like a GIS / civic-data system — never a generic AI SaaS dashboard.

## Status

Phase 0 (foundations) complete — see `docs/BUILD_PLAN.md`.
Master spec: `workspace/user/files/Nigeria_Civic_Intelligence_Muse_AI_Master_Prompt.docx`
