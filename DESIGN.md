---
version: 2
name: Tipunan ng Tubig
description: The implemented design system for Tipunan ng Tubig ("repository of water"), a hydrological intelligence desk for Philippine dam monitoring. A deep navy chrome sits over a lattice of mist-white surfaces; one reservoir-blue family carries water data and actions; teal is reserved for the rule-curve reference series; terrain green appears only for in-range status; amber and red are reserved for threshold semantics. Every measurement is set in the mono axis with tabular figures, so columns of metres align like an instrument.
---

## Overview

Tipunan ng Tubig reads like a monitoring instrument, not an admin panel. The page is framed top and bottom by deep navy bands (`bg-navy-900` header, `bg-navy-950` footer) that carry the product identity and the honest disclosures — data attribution, sync schedule, and the status-derivation rule — while the working ground between them is near-white mist (`--color-canvas: #f7f9fa`) with white cards for data surfaces. Depth is flat: hairline borders (`#d8e1e8`), 8px control corners, 10–12px panel corners, no shadows on content. The single atmospheric surface is the home hero, a navy field overlaid with hand-authored topographic contour lines — the one place decoration is allowed, and it is aria-hidden there.

Everything measured renders in **Geist Mono with tabular figures**. This is the signature typographic move: a 5xl `tabular-nums` level figure on a detail panel and a 12px table figure are the same family at different scales, so numeric columns trust themselves. UI copy is Geist Sans.

**Key characteristics**

- Navy chrome (header + footer) frames the page; mist canvas and white cards do the work between.
- One acting hue — reservoir blue (`--color-water-600: #1664a4`) — for links, buttons, the level series, and markers.
- Teal, terrain green, amber, and red exist only with defined meanings (reference series, in-range status, warnings, critical state). Nothing else is colored.
- All measurements (`* m`, ages, counts) are mono + `tabular-nums`; UI copy is sans.
- Status chips pair an icon, a tier word, and the verbatim source threshold key — never color alone.
- Honest absences: a dash (`—`) means unknown, never zero; “Not classified” means no numeric thresholds exist.
- No invented data: the app shows only what the Tubig source provides; computed tiers are always labeled application-defined.

## Source of truth and data honesty rules

The Tubig API defines no status classification — it supplies numeric thresholds per dam (keys like `critical`, `spilling`, `maintaining`, `minimum_operating`, `normal_high`; keys vary per dam and are absent on some) and nullable readings. Therefore:

1. **Never fabricate** readings, thresholds, statuses, or history for visual completeness. Missing values render as em dashes.
2. **Every status chip is application-defined** and must be accompanied by the disclosure (footer, home caption, detail-page info tooltip): “computed from each dam’s published numeric thresholds — not an official operational declaration.”
3. **Counts and rankings on the dashboard** (“Needs attention”) only include dams with numeric thresholds and a current reading.
4. **Stale data** is an application-defined rule: with a daily 03:00 UTC sync, a reading older than 36 h (`STALE_AFTER_HOURS` in `components/dams/format.ts`) misses a cycle and is flagged “Stale” with an amber chip and a caution panel on the detail page.
5. **Maps, region filters, rainfall, and live updates are not supported by the source** — the UI does not imply them. There is no map component; the directory offers name search, status filter, and sort only.
6. The suffix “ago” is attached from a request-time `nowIso` captured inside the request (`connection()`-gated), keeping rendering deterministic and honest.

## Colors

Tokens live in `app/globals.css` `@theme` (Tailwind v4) plus the shadcn `:root` mapping consumed by `components/ui/*`.

### Chrome & atmosphere
- **navy-950** `#07131c` — footer, deepest atmosphere.
- **navy-900** `#0c1e2b` — header, hero band.
- **navy-700 / navy-500 / navy-300** `#17384f / #2a5574 / #48708e` — dark-surface secondary text (footer labels, hero caption), neutral threshold marks.

### Neutrals
- **canvas** `#f7f9fa` — page ground.
- **mist** `#eef2f5` — subtle wells, input backgrounds on dark-adjacent panels, skeletons.
- **hairline** `#d8e1e8` — default borders.
- **rule** `#b9c8d2` — stronger scale lines (axis baseline, cursor).

### Text ladder (blue-slate, not grey)
- **ink** `#10202c` — headings, emphasized numerals.
- **ink-body** `#2f4459` — body copy, table cells.
- **ink-meta** `#5a7086` — captions, axis ticks, column headers.
- **ink-faint** `#8ba0b3` — quiet decorations, unset icons.

### Water (the acting hue)
- **water-600** `#1664a4` — text-grade: links, primary buttons, active filters, level figure emphasis.
- **water-500** `#2177bd` — graphic-grade: chart strokes, level marker, mini bars.
- **water-300** `#9cc4de` — contour lines on navy.
- **water-wash** `#eaf2fa` — pale panel behind directory filter chips and accent surfaces.

### Reserved semantic hues
- **teal-700** `#0f766e` — rule-curve reference series and its legend/tooltip; also the “Low” tier chip. Teal never decorates.
- **terrain-700** `#2b6e46` (+ wash `#e7f2ec`) — “Normal” tier and the all-clear dashboard banner only. Terrain green never decorates.
- **amber-800 / amber-700** `#8f4a0c / #b45309` (+ wash `#fdf3e7`) — “Warning”/“Watch” tiers and stale-data flags.
- **critical-700 / critical-500** `#b42318 / #d03024` (+ wash `#fbeae7`) — “Critical” tier and its threshold line.

Rule of discipline: if a hue has a defined meaning above, do not reuse it decoratively; if it has no meaning (e.g. violet, pink), do not introduce it.

## Typography

Geist Sans (UI) and Geist Mono (measurements) load via `next/font` in `app/layout.tsx` as `--font-geist-sans` / `--font-geist-mono`, consumed by the `@theme` font tokens.

| Role | Class recipe | Use |
| --- | --- | --- |
| Display | `text-4xl md:text-[44px] font-semibold tracking-tight leading-[1.04]` | Home hero title |
| Page title | `text-3xl md:text-4xl font-semibold tracking-tight text-ink` | Dam detail h1 |
| Section heading | `text-2xl font-semibold tracking-tight text-ink` | “Needs attention”, “Dam directory”, chart sections |
| Sub-lead | `text-[15px] leading-6 text-white/70` | Hero subtitle |
| Body | `text-sm leading-5+ text-ink-body` | Descriptive copy |
| Hero measurement | `font-mono text-5xl md:text-6xl font-semibold tabular-nums` (+ sans `m` suffix at `text-lg md:6`–`18px`) | Detail level figure |
| Card measurement | `font-mono text-2xl font-semibold tabular-nums` | Mobile dam card level |
| Table figure | `font-mono text-sm tabular-nums` | Directory/history numerals |
| Meta caption | `text-xs text-ink-meta` | Freshness, axis hints, disclosure |
| Micro-label | `text-xs font-semibold tracking-wide uppercase text-ink-meta` | Panel column labels (“Observed”, “Data”) |

Always append metric units with a lighter sans span when the figure is large (`m` at `text-lg`, `text-ink-meta`), so the numeral stays the hero.

## Spacing, radii, surfaces

- Spacing follows Tailwind's 4px scale; sections breathe at `pt-8 pb-16`, cards pad `p-4`–`p-6`.
- Radii: `--radius: 0.5rem` (8px). Controls 8px; data panels/borders `rounded-lg`; hero reading panels `rounded-xl`. No pills except 5px-tall status chips (`rounded-4xl`, a deliberate instrument-lamp exception) and filter chips (`rounded-full`).
- Surfaces: content sits on canvas; data panels are white cards with `border-hairline`; dashed `border-hairline` + mist denotes empty states; washes (water-wash, amber-wash, terrain-wash, critical-wash) appear only behind their meaning.
- Elevation: flat by default. Popovers/selects may use `shadow-md`; tooltips `shadow-xl`. Nothing else.

## Navigation & layout

- **Header** (`components/site-header.tsx`): 64px navy-900 bar full-bleed; droplet wordmark + “Tipunan ng Tubig / Philippine reservoir intelligence”; right link “All dams”. Same on every page; mobile keeps the compact lockup.
- **Footer** (`components/site-footer.tsx`): navy-950, three columns — identity, data attribution/schedule, status-derivation disclosure.
- **Container**: `max-w-6xl px-6` everywhere.
- **Home** (`app/page.tsx`): navy hero (eyebrow, display title, subtitle, white CTA button anchoring `#directory`) → streamed dashboard: overview line (dams monitored · with current reading · data-as-of) → “Needs attention” banner/list → directory → caption disclosure.
- **Dam detail** (`app/dams/[id]/page.tsx`): breadcrumb → title + mono id/record-updated line → latest-reading panel (status badge + freshness chip, hero measurement, secondary metrics grid, observed/staleness side panel) → grid: water-level chart (primary) + thresholds ladder aside (with info tooltip + threshold dl) → reading-history table → attribution note.
- **Responsive**: desktop prioritizes comparison density (tables); mobile stacks the directory into cards that lead with level + status (`md:hidden` blocks), and the chart panel spans full width. The ThresholdIndicator SVG scales fluidly via `viewBox`.

## Status and threshold system

Implemented in `components/dams/status.ts` — pure, unit-tested (`tests/unit/components/dams/status.test.ts`). Tiers, in evaluation order:

| Tier | Rule (against the dam's own numeric thresholds) | Chip |
| --- | --- | --- |
| Critical | level ≥ largest `*critical*` key | red wash, CircleAlert, phrase “Above {key} level” |
| Warning | level ≥ largest `*spill*` key (below critical) | amber wash, TriangleAlert, “At or above {key} level” |
| Watch (approaching) | within `WATCH_PROXIMITY = 2%` of the nearest safety key above the level; without safety keys, nearest threshold above | amber outline wash, TriangleAlert, “Approaching {key} level” |
| Watch (reached) | level ≥ a non-safety threshold except the smallest (the normal band's floor) | amber outline wash, “At or above {key} level” |
| Low | level < smallest published threshold | teal wash, Minus, “Below {key} level” |
| Normal | otherwise | terrain wash, Minus, “Within monitored range” |
| Not classified | no level or no numeric thresholds | mist chip, “Not classified” |

Presentation rules:

- Chips (`components/dams/dam-status-badge.tsx`) carry icon + word (+ driving threshold phrase in `"described"` variant), so meaning survives color bounds.
- The threshold ladder (`components/dams/threshold-indicator.tsx`) spans only existing values (thresholds ∪ level, 8% padding); each published mark is ticked and labeled with the verbatim source key; the level is a water-blue diamond with a mono caption. A dam with no numeric values shows a text fallback, not an invented 0-to-max axis.
- The directory rows carry a mini level bar (`MiniLevelBar`) mapping level position into the min/max threshold span (clamped 0–100%).
- `tierRank` orders attention lists: critical < warning < watch < low < normal < unclassified.

## Data visualization conventions

`components/dams/water-level-chart.tsx` (client, built on `components/ui/chart.tsx` + recharts 3.8):

- **Series**: water level (water-500, 2px, `connectNulls={false}` so gaps are honest); rule curve (teal, dashed) only when the dam has non-null rule-curve readings.
- **Thresholds**: `ReferenceLine` per numeric threshold in the tier color (critical red, spill amber, else navy-300), labelled `{key} · {value m}` insideTopRight at 10px.
- **Axes**: time domain over actual observation stamps (single-reading dams get a ±10 h padded domain); X ticks as short PHT dates (“Oct 28”), Y ticks plain numbers with the unit declared in surrounding copy; grid horizontal-only, hairline.
- **Tooltip**: custom `LevelTooltip` — PHT timestamp label, colour dot, mono values, dash for null.
- **Legend**: shadcn `ChartLegendContent`; **Summary**: `sr-only` figure caption listing span, bounds, and thresholds (screen-reader chart summary).
- Animation is disabled (`isAnimationActive={false}`) for determinism and reduced-motion compliance; recharts' own a11y layer is not relied upon — the caption and the history table are the accessible alternatives.
- Empty state: dashed mist panel (“No recorded water levels yet…”). Never fabricate a series.

## Loading, empty, error, and stale states

| State | Treatment |
| --- | --- |
| Streaming (Suspense) | `DamDirectoryFallback` / `DamDetailFallback` skeletons (`components/ui/skeleton`), pulse only (no custom motion) |
| Directory empty (no dams) | dashed mist panel, “No dam data yet”, explanation of first sync |
| Search/filter empty | dashed mist panel quoting the query + chosen filter |
| No readings yet (detail) | dashed mist panel; thresholds still displayed as published |
| Route error (`app/error.tsx`) | amber alert card, reset + back links; no internal error details |
| Unknown dam (`app/not-found.tsx`) | neutral card, back link |
| Stale reading | amber “Stale · {age} ago” chips in list/table; amber side panel on detail explaining the rule |
| Waiting for first sync | overview line shows “Waiting for the first synchronization run” instead of a fabricated date |

## Motion

Restrained. Allowed: `transition-colors` on links/buttons/chips (≈150 ms), the skeleton pulse, Base UI popover/tooltip entrance. Forbidden: chart animation, delayed content behind entrances, marquee/parallax. Every animation is automatically disabled under `prefers-reduced-motion` via Tailwind's default `motion-reduce` handling of `transition-*` and `animate-pulse` in tw-animate-css; content is never gated on motion completing.

## Accessibility checklist

- Status never color-only (icon + word + phrase); change arrows carry `sr-only` direction words.
- Charts: `role="img"`-equivalent via `sr-only` figure summary + full history table alternative.
- The threshold indicator publishes an `aria-label`/figcaption enumerating every mark.
- Filter chips use `aria-pressed`; sort uses a labelled `SelectTrigger`; search input has `aria-label`.
- Visible focus: `focus-visible:ring-3 focus-visible:ring-ring/50` on controls; nav links get ring-offset on navy.
- Landmarks: `header`, `footer`, `main`, `nav[aria-label]`, `article`, `section[aria-labelledby]`, `figure/figcaption`.
- Color contrast: all text-grade tokens (ink family, meta, water-600, teal-700, terrain-700, amber-800, critical-700) clear 4.5:1 on their usual washes/white.

## Correct / incorrect usage

**Correct**
- Level + unit: `<p className="font-mono tabular-nums text-5xl …">{formatLevel(latest.levelM)}<span className="font-sans text-lg text-ink-meta">m</span></p>` — measured value, timestamped nearby.
- Status: chip + disclosed application-defined note.
- Absence: `{formatLevel(null)}` → “—”.
- Thresholds: only from `numericThresholds(dam.thresholds)`.

**Incorrect**
- Coloring a level green because a dam “looks fine” (status belongs to the chip).
- Inventing a Watch tier for a dam without numeric thresholds (“Not classified” instead).
- A 24h change of `0.00 m` when the source says `null`.
- A 0-to-max threshold scale when no values justify it.
- “Live” indicators (pulsing dots) for a daily-sync dataset.
- Reintroducing SAP-era tokens (`chrome`, `band-blue`, `ink-lead`) or the 72 Brand/Inter pairing from v1 of this document.

## Component inventory

| Component | File | Notes |
| --- | --- | --- |
| SiteHeader | `components/site-header.tsx` | navy chrome |
| SiteFooter | `components/site-footer.tsx` | navy band + disclosures |
| ContourField | `components/dams/contour-field.tsx` | decorative contour SVG (aria-hidden) |
| deriveDamStatus/numericThresholds/statusPhrase/tierRank | `components/dams/status.ts` | pure + tested |
| DamStatusBadge, FreshnessChip | `components/dams/dam-status-badge.tsx` | tier + staleness chips |
| ThresholdIndicator, MiniLevelBar | `components/dams/threshold-indicator.tsx` | ladder + row bar (server SVG) |
| WaterLevelChart | `components/dams/water-level-chart.tsx` | recharts client chart |
| DamDirectory (client) + DamDirectoryFallback | `components/dams/dam-directory.tsx` | search / chips / select / table + card stack |
| DamReadingsTable | `components/dams/dam-readings-table.tsx` | history table |
| format* / age / staleness | `components/dams/format.ts` | PHT, metres, `STALE_AFTER_HOURS` |
| shadcn primitives | `components/ui/*` | button, card, chart, input, select, badge, table, skeleton, tooltip |

View-model additions live in `features/dams/services/dams.ts`: `DamSummary.thresholds` (for dashboard/status ranking) and `DamDetail.updatedAt` — no repository, schema, or API contract changes.

## Extending

- New page surfaces follow this token set; new semantic colors require expanding the status vocabulary in `status.ts` + a unit test + a chip entry in `TIER_PRESENTATION` first.
- When the Tubig source adds coordinates or region metadata, revisit §“not supported” notes (map, region filter) and update this document in the same change.
