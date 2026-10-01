# UI Design System — Nigeria Civic Intelligence Platform

Core rule (§49–51): **this must feel like a GIS / civic-data system, never a generic
AI-generated SaaS dashboard.**

## 1. Visual language

Reference points: professional mapping applications, public-sector information portals,
financial data terminals, transport control systems — not startup landing pages.

Banned by default: pill buttons everywhere, badge-heavy interfaces, giant icons, emoji,
AI sparkle icons, purple/blue AI gradients, glassmorphism, excessive shadows, repetitive
card grids, oversized empty heroes, decorative elements with no information value,
untouched component-library styling.

## 2. Typography (deliberate, not default)

- **UI / data:** IBM Plex Sans — public-sector character, open licence, tabular numerals.
- **Editorial / long-form:** IBM Plex Serif — briefs, official documents, profiles.
- **Data / coordinates / IDs / timestamps:** IBM Plex Mono.
- Never Inter/Poppins/Roboto-by-inertia. If a component library is used, it gets
  substantially restyled — no default shadcn/MUI look.

## 3. Colour as information

- Base: paper `#F7F6F2`, ink `#16181D`, hairline borders `#E3E1DA`.
- Primary action: Nigeria green `#008751`, used sparingly.
- State accents: restrained — map selection highlight, breadcrumb marker, section rules,
  small markers. Never recolour the whole interface per state.
- Verification states get text labels with quiet colour coding:
  `verified` / `unverified` / `disputed` / `stale` — always legible, never decorative.

## 4. Components & layout

- Corners: 2–4px radius max. Flat buttons with clear hierarchy (primary filled /
  secondary outline / tertiary text). Not every action is a pill.
- Prefer: data tables with sticky headers, timelines (tenure, report history, audit),
  split views (map + information workspace), drawers, bottom sheets on mobile.
- Containers group information; the screen must not become a grid of identical cards.
- Page titles are geographic: "Lagos State — Civic Intelligence", not "Dashboard".
- Density over whitespace theatre: this is a working instrument, not a marketing page.

## 5. Map presentation

- Restrained light basemap (low saturation); state accent reserved for the selected boundary.
- Layer control in a left rail; clustered points; click/hover reveals a focused summary,
  full detail in the side panel — never an overloaded tooltip.
- Breadcrumb always visible: Nigeria > Lagos > Kosofe > … — every level clickable.
- Mobile: map + bottom sheet; geographic context never lost when switching panels.

## 6. Real-data visual test (§52)

Design against: long institution names ("Lagos State Ministry of Transportation"),
Nigerian names and chieftaincy/political titles, multi-level hierarchies, long project
names, dense report lists, map label collisions. If it only looks good with
"John Doe" and "Project Alpha", it fails.
