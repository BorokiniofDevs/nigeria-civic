# Data Contract — map prototype → production backend

The prototype's frontend never touches fixtures directly for shape: it reads
through the `window.FIXTURES` module, which mirrors the production API below.
Swapping the fixture module for a PostGIS-backed client must not require
rewriting `app.js` interaction logic.

## Provider interface (conceptual)

```js
GeoProvider = {
  getCountry()                    -> { id:'NG', name:'Nigeria', bounds:[[w,s],[e,n]] }
  getStates()                     -> [{ id, name, capital?, lgaCount?, lgaCountSource? }]
  getStateIdentity(name)          -> { name, capital, accent, governor, deputy, speaker,
                                       fullFixture, note }
  getLGAs(stateName)              -> [{ id, name }]                      // real names
  getLGAFeature(name)             -> GeoJSON Feature (boundary)
  getLGAFixture(name)             -> { chairman, viceChairman, councillors, wards, departments[] }
  getLCDAs(lgaName)               -> [{ id, name, chairman, wards, note, illustrative: true }]
  getFacilities(geoId)            -> [{ id, name, type, typeLabel, status, phone, pt:[lng,lat], source }]
  getProjects(geoId)              -> [{ id, name, sector, status, budgeted, released,
                                        contractor, updated, description, pt, source }]
  getReports(geoId)               -> [{ id, title, category, status, severity, reported,
                                        description, history:[[date,event]], pt, source }]
  getBrief(stateName, date)       -> { date, items[], sources[] }
}
```

## Production mapping (PostGIS)

| Method | Production source |
|---|---|
| `getStates`, `getLGAs`, `getLGAFeature` | `geo_entities` + `geom` (GIST); children via `parent_id` |
| `getStateIdentity` | `geo_entities.identity` JSONB (flag/emblem/colours + `identity_source`) |
| `getLGAFixture` (officials) | `office_holdings` JOIN `officials`, `is_current`, with `verification_status` |
| `getFacilities` | `facilities` with `ST_AsGeoJSON(geom)` |
| `getProjects` | `projects` with `ST_AsGeoJSON(geom)` |
| `getReports` | `reports` + `report_events` for history |
| `getBrief` | `civic_briefs` by `(brief_date, geo_entity_id)` |

Suggested endpoints: `GET /api/geo/children?parent_id=…`,
`GET /api/geo/:id/panel` (officials + counts),
`GET /api/geo/:id/facilities|projects|reports?bbox=…`,
`GET /api/search?q=…` (against `search_index`).

## Verification surfacing

Every production record carries `verification_status`, `source_id`,
`last_verified_at`. The UI's `SAMPLE` badge becomes the verification badge
(`verified` / `unverified` / `disputed` / `stale`) — same component, real data.

## What the prototype deliberately does NOT do

- No invented boundary polygons. LCDA positions are points flagged
  `illustrative: true` until official LCDA boundaries exist.
- No real people's names. Fixture officials are fictional and badged.
- No inferred figures. Sample budgets are labelled, never presented as fact.
