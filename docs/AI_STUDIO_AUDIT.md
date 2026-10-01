# Google AI Studio Export — Functional Gap Audit & Merge Plan

**Project audited:** NaijaCivic — Nigerian Civic Governance & Accountability Platform
(export: `ai-studio-reference/`, received 2026-09-24)
**Audit date:** 2026-09-25
**Status:** AUDIT ONLY. No code has been merged, rewritten, or removed. The export
lives quarantined at `ai-studio-reference/` and must not be imported directly.

**Orientation:** Vite + React 19 + Tailwind 4 frontend, Express (`server.ts`) backend
with an **in-memory store** seeded from `src/data/initialData.ts`. ~10,300 lines,
~530 KB. Map = `react-simple-maps` SVG choropleth (no WebGL, no pan/zoom camera).
Gemini (`@google/genai`, `gemini-3.8-flash` — a real GA model) powers the chat and
the "sync probe". Firestore schema + rules are drafted but **not wired**; the running
backend is the in-memory Express store.

---

## 1. What exists and works

- **Express REST API** (`server.ts`) over the in-memory store — genuinely implemented
  end to end: `GET /api/v1/jurisdictions/hierarchy` (state→LGA→LCDA→ward tree),
  `GET /api/v1/officials/search` (name/title/jurisdiction/sector filters),
  `POST /api/v1/incidents/create`, `GET /api/v1/incidents/nearby` (jurisdiction/sector/
  status/min-score filters, sorted by escalation score), `POST /api/v1/incidents/:id/vote`
  (recomputes escalation, flips status at threshold), `GET/POST /api/v1/admin/update-requests`
  (staging queue listing + approve/reject that applies the diff to the profile),
  `GET /api/v1/budgets`, `POST /api/v1/budgets/:id/proof` (citizen proof upload;
  ≥2 proofs + ≥95% completion → `CITIZEN_VERIFIED_COMPLETE`), `POST /api/v1/civic-ai/chat`
  (real Gemini call with Google Search/Maps grounding when `GEMINI_API_KEY` is set;
  a constitutional-facts offline fallback when it is not).
- **Incident escalation math** — `localVotes×1.5 + externalVotes×0.5 + (media?10:0)`,
  `SUBMITTED → ESCALATED` at score ≥ 25, lifecycle through `IN_PROGRESS → RESOLVED`.
  The formula is computed server-side and displayed publicly in the UI. Real code,
  arbitrary constants.
- **Data-model schemas** (`src/types/civic.ts`, `firebase-blueprint.json`):
  `Jurisdiction` (FEDERAL/STATE/SENATORIAL/LGA/LCDA/WARD + 6 geopolitical zones + FCT),
  `OfficialProfile`, `ProfileUpdateRequest` (proposed vs existing data, citation URL,
  confidence score, PENDING/APPROVED/REJECTED), `Incident` (votes, escalation
  level/score, media, assigned official, official response), `BudgetProject`
  (allocated vs disbursed, line-item tranches, citizen proofs), `CouncilDefinition`,
  `WardDefinition` (councilor, PHC, DPO, hospital per ward). All structurally sound.
- **UI flows that function as flows** (against the seed store): 5-tab navigation
  (Federal command, States drill-down, Incident pipeline, Budget tracker, Admin audit
  queue), grouped omni-search with autocomplete, official dossier modal, state hub with
  5 tabs, LGA micro view with ward grid, budget dossier with proof gallery, audit
  queue with old→new diffs and approve/reject, AI chat drawer with source links.
- **Real datasets inside the fiction:** the 6 geopolitical-zone taxonomy (NW 7, NE 6,
  NC 6, SW 6, SE 5, SS 6, FCT) — correct; IBILE 5-division Lagos framework — real;
  emergency numbers 112 (national), 767/112 (LASEMA), 122 (FRSC), 08057000001 (NPF
  Complaint Response Unit) — real; the 20-LGA / 37-LCDA / 377-ward Lagos counts —
  structurally right (coverage is not).

## 2. Exists but is incomplete, mocked, hardcoded, or simulated

- **The entire data layer is seed fiction.** `initialData.ts` (209 jurisdictions,
  70 officials, 4 update requests, 9 incidents, 10 budget projects) mixes real public
  figures' names (President Tinubu, VP Shettima, IGP Egbetokun, Governor Sanwo-Olu…)
  with **invented phone numbers, emails, and addresses**, marked `is_verified: true`
  with plausible-sounding `citation_source` strings and recent `last_synced_at`
  timestamps. Photos in `public/assets/officials/` are real people's portraits;
  `src/assets/images/` files are timestamp-named (AI-generated likeness style).
- **`data_source_handler.ts` contradicts `initialData.ts`:** it claims 20 Lagos LGAs
  but contains 19 council entries; 17 LCDAs (of 37); **4 wards (of 377)**. Two
  overlapping, inconsistent Lagos sources in one project.
- **`LgaMicroView` fabricates humans arithmetically** when ward data is absent:
  `councilor_name: "Hon. Councilor ${area}"`, `councilor_phone: "+234 803 555 ${1000+idx*11}"`,
  `phc_phone: "+234 802 444 ${2000+idx*22}"`, fallback wards named "Central Ward /
  North Ward / South Ward / Commercial Axis". A real person's photo/name
  (`moyosore_ogunlewe.jpg`) is used as a generic Kosofe fallback.
- **The "Google Sync Probe" is theater.** With a Gemini key it runs a real search-
  grounded extraction; **without a key it fabricates** officials ("CP Olanrewaju
  Ishola", "Engr. Babatunde Jinadu", "Hon. Babatunde Sanusi") with fake citation
  URLs (`npf.gov.ng/press-release/official-postings-2026`) and 93–96 "confidence
  scores", then queues them as `AUTO_GOOGLE_SYNC` update requests. The client has a
  second fabrication fallback when the API call itself fails. Fabricated
  "verified" data entering an audit queue is the single most dangerous pattern here.
- **Incident routing is theater.** `routeIncident()` exists but hardcodes Lagos
  fallbacks (`lcda_lagos_kosofe_west`, `lga_lagos_kosofe`, `state_lagos`); there is
  no real dispatch to any DPO/PWD/PHC desk, no notification to any Commissioner or
  Governor despite the "ESCALATED TO STATE COMMISSIONER & GOVERNOR DESK" ribbon,
  and the "ACTIVE 48HR TIMER" is static text — no timer exists.
- **The emergency checkbox is dangerous.** It submits into the same queue; nothing
  dispatches help, yet a user in danger could believe it summons responders.
- **"Verified" language is asserted, never performed:** "Log *Verified* Civic
  Incident" (default reporter "Verified Citizen Auditor"), "Verified Locations",
  "Real public record contacts", footer "Live Grounding Engine Active" shown
  unconditionally, "Citizen Verified" pills on seed data, `tel:` links to invented
  numbers — including for the highest federal offices.
- **Map is a picture, not a map.** `react-simple-maps` SVG choropleth: zone colors,
  hover tooltips, click-to-drill, but no pan/zoom, no boundaries you can verify, no
  camera travel. Boundaries are Highcharts-derived (`hc-key`, `hasc` codes), coarse
  (~3 KB coords/state), states-only. `nigeriaTopo.json` and `public/nigeria-topo.json`
  are byte-identical duplicates. Lagos drill-down uses Google Maps iframe embeds
  ("Live Google Map") or static PNGs.
- **Firebase is aspirational.** Blueprint + rules exist; the running code never
  touches Firestore. `firestore.rules` has a public write hole
  (`allow update: if true` on incidents — anyone can rewrite/delete any incident)
  and unauthenticated audit-queue flooding (`allow create: if true`).
- **Dead weight:** `motion` dependency installed but never imported; client-side
  fallbacks in `App.tsx` duplicate the server's fabrication logic.

## 3. Reusable capabilities (the genuine value)

**Information architecture (highest value):**
- State-hub 5-tab IA: geography/map → leadership → LGAs → LCDAs → facilities.
- Ward-card IA: councilor + PHC clinic + police outpost per ward, with areas/streets
  chips and ZIP codes — the right grassroots model.
- Official dossier IA: identity → contact → jurisdiction/office → accreditation
  source → actions (must be rebuilt on the real provenance model).
- Budget dossier IA: financial grid → contractor/ministry → evidence gallery.
- Federal directory role taxonomy (President/VP/CoS, Senate President, Speaker, CJN,
  IGP, CDS, sector filters).
- Grouped omni-search UX (jurisdictions vs officials, result caps, distinct icons).
- Persistent emergency quick-dial affordance.
- Chat drawer UI + jurisdiction-context injection + per-message source-link blocks +
  offline fallback card (static constitutional facts + real emergency numbers).

**Data models & mechanisms:**
- `ProfileUpdateRequest` staging pattern — **the single most valuable find**: inbound
  changes quarantined with old→new diff, confidence, source snippet, citation URL,
  and explicit human approve/reject. This is the mechanism the target's provenance
  model needs for *all* inbound data.
- Incident escalation formula + `SUBMITTED→ESCALATED→IN_PROGRESS→RESOLVED` lifecycle
  (adopt the mechanism; re-tune the constants against real moderation policy).
- Sector→desk routing table concept (Security→DPO, Roads→PWD, Health→PHC).
- Budget financial-stage separation: `allocated` vs `disbursed` vs `line_items`
  tranches with dates — extend to the target's 5 stages (budgeted/released/awarded/
  paid/independently-verified) with per-figure verification state; split claimed vs
  independently-verified completion.
- Citizen-proof object shape (photo + caption + uploader + geotag + verification label).
- Taxonomies: `JurisdictionTier`, `GeopoliticalZone` + `ZONE_CONFIG` colors,
  `OfficialSector`, facility types (POLICE/HOSPITAL/EMERGENCY),
  `CouncilDefinition`/`WardDefinition` schema shapes (structure only, never values).
- LGA→LCDA parent mapping as a data-structure pattern; IBILE divisions dataset.
- Real emergency numbers (112, 767, 122, 08057000001).
- API route shapes as a reference for the target's future API layer.
- Google-Maps-URL builders → adapt into a provider-neutral directions-link builder.
- The constitutional-vs-state-created LGA/LCDA tier distinction — a genuinely
  important Nigerian civic concept the target should surface in the UI.

## 4. Conflicts with the target architecture

1. **Fabricated PII presented as verified fact** — violates the target's core rule
   (never invent office-holders, contacts, locations, budgets, projects).
2. **`is_verified` boolean** instead of the target's provenance model
   (source / verification state / date checked / history). Must be replaced, not reused.
3. **Tab-based dashboard navigation** — non-geographic; opposite of map-first.
4. **SVG map + Google iframes** vs the target's MapLibre boundary-driven navigation
   with camera travel. Nothing in its map approach transfers.
5. **Google coupling** (Maps iframes, "Google Sync Probe", Gemini key) vs the
   target's provider-neutrality (MapLibre + imagery abstraction).
6. **Lagos-only depth with national claims** (`isLagos` branches, hardcoded Lagos
   IDs in generic routing) — the target's national hierarchy must not inherit these.
7. **Generic SaaS visual language** (rounded-3xl cards, pills, badges, gradients,
   Lucide-everywhere) vs the target's GIS-instrument conventions. IA ports; styling
   never does.
8. **Citizen allegations render identically to verified records** — violates the
   target's allegation-labelling rule.
9. **AI chat framed as "authoritative… verified knowledge"** with prompts inviting
   invention of named officials — a fabrication engine without hard grounding.

## 5. Missing capabilities (target needs, export lacks)

Real pan/zoom WebGL map with boundaries and camera travel; Community and Street
tiers (export stops at Ward); Senatorial coverage is named but unpopulated;
satellite/Earth-observation anything; the full provenance model; 5-stage public
finance with per-figure verification; legislative information; news/civic briefs;
geo-aware search; notifications; PostGIS persistence (in-memory only); auth,
rate-limiting, and abuse controls; a real official-first boundary/source manifest.

## 6. Verdicts

| Item | Verdict |
|---|---|
| Staging/audit-queue workflow + diff UI | **ADAPT** — apply to all inbound data |
| Escalation formula + status lifecycle + routing table | **ADAPT** — mechanism only, re-tune constants |
| Budget stage separation + citizen-proof shape | **ADAPT** — extend to 5 stages + verification state |
| State-hub 5-tab IA, ward-card IA, dossier IA | **ADAPT** — restyle to GIS language, all values replaced |
| Taxonomies (tiers, zones, sectors, facility types) | **ADAPT** |
| IBILE dataset, emergency numbers, URL builders | **ADAPT** (builders → provider-neutral) |
| Chat drawer UI, jurisdiction context, source links, offline fallback | **ADAPT** — UI only; backend rebuilt hard-grounded or dropped |
| API route shapes, Firestore blueprint entities | **ADAPT** as modeling references |
| Geo boundaries (Highcharts-derived), duplicate topo | **DISCARD** — keep GADM v4.1 |
| `firestore.rules` as written | **DISCARD** — rewrite before any production use |
| All seed data: officials, phones, emails, budgets, incidents, photos | **DISCARD** — fabricated/real-name fixtures, never migrate |
| Gemini "live probe" theater, fake fabrication fallbacks, 48hr timer, escalation-to-Governor claims | **DISCARD** |
| Visual design system | **DISCARD** |
| `motion` dep, duplicate JSONs | **DISCARD** |

**Nothing in the export is preserved as-is.** Every component's data layer is
fabricated and its "verified" labelling is false. What transfers is IA, schemas,
taxonomies, and mechanisms — never records, never styling.

## 7. Dependencies, env vars, database, external services

- **Runtime deps:** react, react-dom, vite, tailwindcss v4, lucide-react,
  react-simple-maps, express, tsx, dotenv, @google/genai, motion (unused),
  d3-geo types. **Target overlap:** react, lucide-react only — and the target must
  not adopt Tailwind, react-simple-maps, or the Express-in-memory pattern.
- **Env vars:** `GEMINI_API_KEY` (chat + probe; AI-Studio-injected), `APP_URL`
  (self-referential links; AI-Studio-injected). No other secrets found.
- **Database:** none in practice. Firestore blueprint + rules are unimplemented
  drafts; the running backend is a process-memory store (data lost on restart,
  no migrations, no auth, no validation).
- **External services:** Google Maps iframes/embeds (no key needed), Gemini API
  (key-gated), Unsplash (stock-photo fallbacks — must be purged, not ported).

## 8. Technical risks for the merge

1. **Fabricated PII is load-bearing** — phone/email/photo fields thread through
   every component; a naive port ships fake `tel:` links for real offices. All
   person-level values stay quarantined; UIs render "Not verified" states instead.
2. **AI search ≠ verification.** The probe pattern must never become a verification
   mechanism; any future ingestion records provenance and requires human review.
3. **Vote fraud.** The escalation formula is gameable without identity; any port
   needs voter verification and rate limits before the formula means anything.
4. **Reputational risk in assets.** Real people's photos/names used as generic
   fallbacks (`moyosore_ogunlewe.jpg`, Tinubu/Sanwo-Olu portraits with invented
   contacts) — purge, never port.
5. **Lagos shortcuts in generic code** (hardcoded jurisdiction IDs in routing,
   `isLagos` branches) must not leak into the national architecture.
6. **Styling-system mismatch** — full visual rewrite required for anything adapted.
7. **The chat will fabricate officials** unless hard-grounded to the verified
   record store with "AI-generated — not verified" labelling on every answer.

---

# MERGE PLAN

**Principle:** the target architecture is the destination; the export is source
material. Merge proceeds IA-first, data-never: patterns and schemas cross over,
records and styling do not. Nothing merges without provenance attached.

## Phase 0 — Quarantine (done)
Export isolated at `ai-studio-reference/`. No imports, no shared components, no
copied records. This document is the merge gate: no Phase 1+ work starts from the
export without citing the verdict table above.

## Phase 1 — Data-model alignment (schema only)
Cross-check the export's entities against the target's `db/schema.sql` (which
already has `escalation_rules`, `escalations`, `change_requests`, `reports`,
`budget_lines`, `institution_claims`, `audit_log` — the concepts map, they don't
need inventing):
- Confirm the export's `Incident` fields (votes, escalation level/score, media,
  assigned desk, official response) are covered by `reports`/`escalations`.
- Confirm `BudgetProject`'s allocated/disbursed/tranches map onto `budget_lines`
  with the 5-stage separation the target requires.
- Adopt the `ProfileUpdateRequest` staging semantics into `change_requests`:
  proposed vs existing diff, citation URL, confidence, PENDING/APPROVED/REJECTED —
  as the **universal ingestion pattern** for officials, budgets, facilities, and
  citizen reports alike.
- Adopt the taxonomies: geopolitical zones, official sectors, facility types,
  federal role taxonomy. Values from the export's seeds: never.
- Write migrations; no fixture data from the export enters the database.

## Phase 2 — Geographic UI patterns (IA only, MapLibre stays)
Port into the target's map-first shell, restyled to the GIS-instrument language:
- State-level panel adopts the 5-tab IA (geography → leadership → LGAs →
  LCDAs → facilities), driven by map selection instead of tabs-as-navigation.
- Ward-level panel adopts the ward-card IA (councilor / PHC / police outpost slots)
  with **explicit "Not verified" states** where the target has no sourced record.
- Surface the constitutional-LGA vs state-created-LCDA distinction in tier badges.
- Official dossier layout → rebuilt on the target's provenance model (source,
  verification state, date checked, history) instead of the export's single
  citation string and fake "Verified" badge.
- Grouped omni-search pattern → the target's future geo-aware search.
- Persistent emergency quick-dial (112 / 767 / 122 / 08057000001) as a header
  affordance — the one dataset safe to port verbatim.

## Phase 3 — Citizen reporting module (new build, export as reference)
Build on the target stack (PostGIS-backed, authenticated) using the export's
mechanisms, not its code:
- Escalation formula as the starting point; re-tune weights/threshold against a
  real moderation policy; add voter identity + rate limiting.
- Status lifecycle `SUBMITTED → ESCALATED → IN_PROGRESS → RESOLVED`.
- Sector→desk routing table, with Lagos IDs removed from generic routing.
- Every report renders as an **allegation with visible status** until verified.
- Emergency path: either a real handoff to 112/767 or no emergency checkbox at
  all — never the export's dead checkbox.

## Phase 4 — Budget tracker (new build, export as reference)
- 5-stage finance (budgeted / released / awarded / paid / independently verified),
  per-figure verification state and provenance on every number.
- Claimed vs independently-verified completion split (the export conflates them).
- Citizen-proof gallery with per-proof verification labels; no stock-photo defaults.

## Phase 5 — Universal staging queue
Generalize the audit-queue pattern from Phase 1 into the admin surface: every
inbound change (official updates, budget figures, facility records, citizen
evidence) lands as a staged request with diff, source, and human approve/reject.
No "1-click publishing" of anything the target marks verified.

## Phase 6 — Assistant (optional, last)
Only after the verified record store exists: a grounded assistant reusing the
drawer UI, jurisdiction context, and source-link blocks — answering **only** from
the record store, refusing or caveating everything else, every response labelled
"AI-generated — not verified". If that discipline can't be enforced, skip it.

## Guardrails (apply to every phase)
1. No real person's name, photo, phone, or email enters the product without a
   cited, checkable source and a verification state.
2. No "verified" booleans — only the provenance model.
3. No Google Maps embeds, no "sync probe" theatre, no Unsplash fallbacks.
4. Lagos-specific shortcuts never enter shared/national code paths.
5. Visual language stays GIS-instrument; the export's SaaS styling is not a reference.
6. The export directory is read-only reference. It is deleted only when the merge
   is complete and Lawal approves — never before.
