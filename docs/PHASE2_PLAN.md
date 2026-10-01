# Phase 2 Implementation Plan — Map-First Civic Operating Environment

**Status:** PLAN (written before implementation, per directive)
**Scope:** MapLibre geographic operating environment + Phase 1 provenance integration. No UI changes beyond this scope.
**Explicitly out:** citizen reporting (P3), finance workflows (P4), satellite ingestion, AI assistant, ingestion UI, moderation, notifications, analytics, AI Studio seed data.

---

## 1. Inspection findings (what exists)

- **Map engine:** MapLibre 6.11.2 on CartoDB Positron (provider-neutral, no Google). Camera transitions (fitBounds/flyTo), drill-down Nigeria→State→LGA→LCDA→Ward, breadcrumb + Esc backtracking, selection outlines, layer rail. Solid foundation.
- **Real geometry:** 37 states/FCT + 20 Lagos LGAs (GADM v4.1). No other LGA geometry in-build.
- **Provenance gap:** the 7-state `information_state` model lives only in `db/` + `lib/provenance.ts`. The UI has no information-state language and renders fixtures flat.
- **Fabrication debt:** `lib/fixtures.ts` invents person names (governors/chairmen), phone numbers, and ₦ figures. Per the Phase 2 safety rule these are removed — person-name fabrication is the bright line.
- **Lagos hardcoding:** `selectLGA` hardcodes `state:'Lagos'`; LGA layers/clicks are Lagos-gated; header lists 3 states; LCDA/ward logic is Kosofe-only. Generic code paths must be national.
- **No search.** No emergency affordance. Drawer describes pre-Phase-1 provenance.

## 2. Data strategy (the safety rule, applied)

- **Jurisdictions are real:** state/LGA names + boundaries from GADM. Navigation hierarchy is data-driven: a state shows LGA boundaries **iff** LGA geometry is loaded for it (today: Lagos only); otherwise an honest "LGA boundary data not loaded in this build."
- **No invented civic facts:** no person names, no phone numbers, no monetary figures, no plausible facility/project names. Panels show "Not verified" / "Information not currently available" where records don't exist.
- **Demonstration dataset (scaffolding, not content):** a tiny, explicitly-bounded set of generically-named records (`Demonstration facility A`, …) in the Lagos pilot area, every render carrying a persistent DEMONSTRATION badge, spanning several information states. Purpose: validate the ENTITY→CLAIM→SOURCE→STATE→HISTORY rendering and the 7-state visual language for architecture review. No people, no phones, no figures.
- **LCDAs/wards (pilot structure):** structural placeholders with explicitly illustrative positions and "official boundary data pending" labelling — needed to demonstrate hierarchy navigation, already the established convention.

## 3. New data layer — `lib/civic/`

| File | Purpose |
|---|---|
| `types.ts` | Frontend mirror of Phase 1 vocabulary: `InformationState` (7 states), `CivicEntity`, `Claim`, `ClaimSource`, `Source`, `ClaimEvent`, `EntityDetail` (entity + claims + sources + history). Reuses `lib/provenance.ts` types where they exist. |
| `store.ts` | `CivicStore` interface — `getEntity`, `childrenOf`, `getDetail`, `lineageOf`. The contract the future PostGIS backend implements; the UI never reaches past it. |
| `geoEntities.ts` | GADM → `CivicEntity` adapter. States (37), Lagos LGAs (20) as entities with `information_state:'unknown'`, honest metadata (source: GADM v4.1). National: no Lagos branches. |
| `demonstration.ts` | The tiny badged demo dataset implementing `CivicStore` for the pilot area. |
| `search.ts` | Grouped geographic search over the store: jurisdictions / facilities / projects / institutions. Honest empty states, no invented results. |
| `index.ts` | Wires the store (geo + demonstration). |

`lib/fixtures.ts` is retired once consumers migrate (no invented PII/figures survive).

## 4. Map engine — nationalize, don't rebuild

- `mapController.ts`: LGA source/layers driven by *loaded* per-state geometry (registry: `{ Lagos: LAGOS_LGAS }`); state click works for all 37; selection outlines generalized; LCDA/ward illustrative markers stay pilot-scoped and labelled. Camera stays geometry-driven (`fitBounds` on real bounds; no hardcoded coordinates for real entities).
- `lib/geo.ts`: add `LGA_GEOMETRY: Record<stateName, FeatureCollection>` registry + `lgaGeometryFor(state)`; keep bbox math.
- Basemap stays CartoDB Positron; style URL extracted to a config constant (provider-neutral seam).
- Existing satellite stub view untouched (not ingestion; already built).

## 5. State + UI

- `CivicContext`: `selectState`/`selectLGA` national (LGA availability from geometry registry); search-selection → navigation; history/Esc extended through ward; satellite handling unchanged.
- `SiteHeader`: geographic search box (grouped results) + all-37 state jump + persistent emergency quick-dial (112/767/122 — the one verbatim-safe dataset from the audit).
- `InfoPanel` restructured to ENTITY→CLAIM→SOURCE→STATE→HISTORY: entity header with information-state badge + tier badge (constitutional LGA vs state-created LCDA) + lineage; "What is known" (claims with states); Sources; History; honest empty states. No second verification system, no `is_verified`.
- State panel adopts the audit's state-hub IA (geography → leadership → LGAs → LCDAs → facilities) as map-driven sections; ward panel adopts the ward-card slot IA (councillor/PHC/police slots, explicit "Not verified"); official dossier layout rebuilt on the provenance model (renders "Not verified" until sourced records exist).
- `Breadcrumb`: fully data-driven lineage, no fixture imports.
- New `StateChip.tsx`: the 7-state visual badge (square chips, existing `.st` convention, GIS-restrained).
- `globals.css`: state chips, tier badges, search results, emergency dial — same instrument language (hairlines, mono labels, no gradients/pills).
- `ProvenanceDrawer`: rewritten for the Phase 1 model (what's real / what's demonstration / production path).

## 6. Verification (before sign-off)

`npx tsc --noEmit` · `npm run build` · static audit (no `is_verified`, no invented PII patterns, no AI Studio record IDs, no Google embeds/iframes, no SVG-map primary) · manifest diff (no Phase 3/4 files) · honest-empty-state spot checks per level.

---

**STOP after Phase 2 implementation + verification. Await Lawal's review before Phase 3.**

## 7. Completion record — 2026-09-25

Implemented as planned, with the following adjustments:
- `StateChip.tsx` was folded into `InfoPanel.tsx` as an inline `StateBadge` (same 7-state square-chip language, less indirection).
- Emergency quick-dial (112 / 767 / 122) placed in the LayerRail EMERGENCY group rather than the header (header space constrained by the new search box).
- Ward panel shows jurisdiction + records with honest empty states rather than fixed councillor/PHC/police slots.
- `lib/fixtures.ts` (all invented people, phones, projects, reports, budgets) deleted — nothing invented survives. Replaced by `lib/civic/demonstration.ts`: 3 generic, DEMO-badged structural records (facility A, road works A with conflicting claims, citizen report A) used only to validate the provenance rendering. Real geography (GADM) renders `unknown` / "Information not currently available" everywhere else.

Verification (all 2026-09-25):
- `npx tsc --noEmit` — clean.
- `npm run build` (Next.js 16.3.6 production) — clean.
- `npx eslint` over `src/lib`, `src/state`, `src/components`, `src/app` — clean.
- Behavioral store tests (compiled civic lib + node): 36/36 passed — 37 states, 20 Lagos LGAs, LCDA structural distinction, lineage, grouped search, jurisdiction resolution, canonical 7 states on all claims, no-results honesty.
- Static audits: no `is_verified`, no AI Studio identifiers, no Google embeds/iframes, no SVG primary map, no phone/email/monetary patterns, no "sample fixture" wording, no Phase 3/4 scope (reporting UI, finance workflows, notifications).
- SSR smoke test: HTTP 200, wordmark + search render.

Files changed/added in Phase 2:
- Added: `lib/civic/types.ts`, `lib/civic/store.ts`, `lib/civic/geoEntities.ts`, `lib/civic/search.ts`, `lib/civic/demonstration.ts`, `lib/civic/index.ts`, `components/SearchBox.tsx`.
- Rewrote: `lib/mapController.ts` (national LGA registry), `state/CivicContext.tsx`, `lib/view.ts` (EntityKind detail), `components/InfoPanel.tsx` (ENTITY→CLAIM→SOURCE→STATE→HISTORY), `components/Breadcrumb.tsx`, `components/SiteHeader.tsx` (all-37 state jump + search), `components/ProvenanceDrawer.tsx`, `components/LayerRail.tsx` (legend + emergency dial), `components/CivicMap.tsx` (map note).
- Edited: `lib/geo.ts` (`aoiAround` moved in), `app/globals.css` (state badges, demo tags, claims, search, markers).
- Deleted: `lib/fixtures.ts`.
- Untouched: satellite abstraction/stub, db/ (Phase 1 migrations).

STOP — awaiting Lawal's review before Phase 3.
