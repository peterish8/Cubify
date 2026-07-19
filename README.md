<p align="center">
  <img src="docs/brand/cubify-wordmark.svg" alt="Cubify" width="280" />
</p>

<p align="center">
  <strong>WCA stats analyzer</strong> for speedcubers — ranks, Top %, goals, compare, and country stats.<br/>
  Official WCA data · no database · static JSON on the <code>rank-data</code> branch.
</p>

<p align="center">
  <img src="docs/brand/cubify-cube.svg" alt="Cubify isometric cube logo" width="96" />
</p>

---

## What is Cubify?

Look up any official **WCA ID** and get an easy-to-read speedcubing profile: personal records, national / continental / world ranks, and mathematically correct **Top X%** labels.

Everything else builds on that same accurate dataset — goal simulation, head-to-head compare, and country populations.

---

## Features

### Pages

| Route | Feature | Description |
| --- | --- | --- |
| `/` | **Lookup** | WCA ID → name, country, avatar, PRs, NR/CR/WR ranks, Top % rings |
| `/goal` | **Goal simulator** | Result → predicted NR/CR/WR · reverse (target rank or Top % → required result) |
| `/compare` | **Compare** | Side-by-side two cubers — times, ranks, facelet-style winners |
| `/countries` | **Countries** | Country cuber totals — search, virtualized list, chart views |
| `/settings` | **Settings** | Theme families, custom cursor on/off, smooth scroll on/off |

### Stats & accuracy

- Official **WCA person API** for identity, avatar, and personal records  
- Ranked-competitor totals from the official **WCA Results Export v2**  
- Only people with a **valid ranked result** count (not every registered account)  
- **Top %** = `rank ÷ ranked competitors × 100`  
- If a live rank is newer than the totals snapshot, the % is **hidden** (never faked)  
- Daily GitHub Action refreshes data when the WCA export date changes  
- No SQL · no paid backend · compact rank-list shards for Goal

### Product / UX

- Dark glass editorial UI (Space Grotesk + Geist)  
- **Custom cube brand SVG** (WR · NR · CR faces)  
- **Facelet badges** for NR / CR / WR (same colors as the logo)  
- **Theme system** — 7 color families × 3 shades (Lighter / Darker / Deep)  
- **Custom cursor** + **Lenis smooth scroll** (Settings toggles)  
- Motion: count-up stats, floating theme cube, glass sheen, percentile rings  
- Loading / error / 404 pages wired in App Router  

---

## Brand SVGs

Source of truth in code: [`components/brand/CubeLogo.tsx`](components/brand/CubeLogo.tsx)  
Static copies for docs / favicon-style use:

| File | Use |
| --- | --- |
| [`docs/brand/cubify-cube.svg`](docs/brand/cubify-cube.svg) | Isometric cube mark |
| [`docs/brand/cubify-wordmark.svg`](docs/brand/cubify-wordmark.svg) | Logo + “Cubify” wordmark |
| [`docs/brand/cubify-facelets.svg`](docs/brand/cubify-facelets.svg) | NR / CR / WR color legend |
| [`public/cubify-cube.svg`](public/cubify-cube.svg) | Served at `/cubify-cube.svg` |

### Cube mark

<p align="center">
  <img src="docs/brand/cubify-cube.svg" alt="Cubify cube" width="112" />
</p>

Isometric cube — each face is a ranking scope:

| Face | Scope | Color | Hex |
| --- | --- | --- | --- |
| **Top** | WR (World) | Silver | `#E8E8EC` |
| **Left** | NR (National) | Emerald | `#3DFFA8` |
| **Right** | CR (Continental) | Amber | `#FFC14A` |

```svg
<!-- paths from CubeLogo.tsx (viewBox 0 0 32 32) -->
<path d="M16 3L28 10L16 17L4 10L16 3Z" fill="#E8E8EC"/> <!-- WR top -->
<path d="M4 10L16 17V29L4 22V10Z" fill="#3DFFA8"/>     <!-- NR left -->
<path d="M16 17L28 10V22L16 29V17Z" fill="#FFC14A"/>   <!-- CR right -->
```

React usage:

```tsx
import { CubeLogo, CubeWordmark } from "@/components/brand/CubeLogo"

<CubeLogo size={28} />
<CubeWordmark />  // header nav
```

### Facelet legend (UI chips)

Same palette as rank rows, compare winners, and footer legend:

<p align="center">
  <img src="docs/brand/cubify-facelets.svg" alt="NR CR WR facelet colors" width="420" />
</p>

| Class | Scope | Fill |
| --- | --- | --- |
| `.facelet-nr` | National | Emerald `#3DFFA8` |
| `.facelet-cr` | Continental | Amber `#FFC14A` |
| `.facelet-wr` | World | Silver `#E8E8EC` |

### Other custom graphics (in code)

| Component | Type | Role |
| --- | --- | --- |
| `CubeLogo` / `CubeWordmark` | SVG | Brand mark + header |
| `PercentileRing` | SVG + Framer Motion | Animated Top % ring |
| `FloatingThemeCube` | DOM / motion | Decorative theme cube on Goal |
| Theme swatches | CSS variables | Per-family bright / core / deep colors |

`public/placeholder-*.svg|png|jpg` are generic Next/shadcn leftovers — not brand assets. Prefer `cubify-cube.svg` / `CubeLogo`.

---

## Themes (`/settings`)

Dark-stage only (brighter vs deeper glow on black — not light mode).

| Family | Lighter | Darker | Deep |
| --- | --- | --- | --- |
| **Blue** (default) | Blue Pastel | Blue Matrix | Midnight Core |
| **Green** | Mint Pastel | Emerald Circuit | Forest Link |
| **Pink** | Sakura Pastel | Neon Sakura | Rose Void |
| **Violet** | Lavender Pastel | Violet Nebula | Ion Shadow |
| **Orange** | Peach Pastel | Solar Core | Ember Pit |
| **Purple** | Lilac Pastel | Royal Pulse | Grape Depth |
| **Night** | Tokyo Pastel | Tokyo Night | Tokyo Deeper |

Stored in `localStorage` under `cubify-theme`. Legacy id `dark-blue` (Abyss Drive) still resolves if previously saved.

Prefs (also localStorage):

- `cubify-custom-cursor` — custom cursor (default on)  
- `cubify-smooth-scroll` — Lenis smooth scroll (default on)  

---

## Data sources

| Data | Source |
| --- | --- |
| Person, PRs, live ranks | [WCA person API](https://www.worldcubeassociation.org/) |
| Ranked totals + rank lists | Official **WCA Results Export v2** |
| Country populations | Same export → `country-totals.json` |

Publication target: git branch **`rank-data`**

```text
rank-totals.json
country-totals.json
rank-lists/{event}/{single|average}.json
```

Before publish, both must hold:

```text
world total = sum of country totals
world total = sum of continent totals
```

Failed validation keeps the previous JSON as last-known-good.

---

## Repo layout

```text
app/                         Lookup · Goal · Compare · Countries · Settings
components/
  brand/CubeLogo.tsx         Custom isometric cube SVG + wordmark
  layout/SiteChrome.tsx      Sticky nav island + footer
  motion/                    CountUp · CustomCursor · FloatingThemeCube · GlassSheen · SmoothScroll
  theme/CubifyThemeProvider  Theme families → CSS vars
  PercentileRing.tsx         Top % SVG ring
  ui/                        shadcn primitives + editorial fields
docs/brand/                  README SVG assets (cube · wordmark · facelets)
lib/
  cubify-themes.ts           Theme catalog
  cubify-prefs.ts            Cursor / scroll prefs
  wca-person.ts              Person fetch
  wca-rank-totals.ts         Totals + Top % helpers
  wca-rank-list.ts           Goal rank-list shards
  wca-rank-list.worker.ts    Decode worker for large shards
  wca-country-totals.ts      Country totals client
  wca-events.ts · format.ts · result-input.ts
public/cubify-cube.svg       Public brand mark
tests/                       Unit / contract tests
e2e/                         Playwright smoke tests
tools/wca-rank-totals/       Python 3.12 export → JSON generator
.github/workflows/           Daily validation + publish
```

---

## Development

```bash
pnpm install
pnpm dev            # Next.js via scripts/run-next.cjs
pnpm test           # unit / contract tests
pnpm test:e2e       # Playwright
pnpm test:website   # unit + Python generator + tsc + e2e
pnpm build
```

Python pipeline (`tools/wca-rank-totals`):

```bash
PYTHONPATH=src python -m unittest discover -s tests -v
PYTHONPATH=src python -m wca_rank_totals.cli
```

### Gitignored local clutter (safe to delete)

| Path | What |
| --- | --- |
| `.next/`, `.next-e2e/` | Next build / e2e caches |
| `.next-dev*.log`, `*.log` | Dev process logs |
| `test-results/`, `playwright-report/` | Playwright artifacts |
| `*.tsbuildinfo` | TS incremental cache |
| `node_modules/`, `__pycache__/` | Dependencies / bytecode |

---

## Stack

- **Next.js 14** (App Router) · **React 18** · **TypeScript**  
- **Tailwind CSS v4** · **Framer Motion** · **Lenis**  
- **Geist** + **Space Grotesk**  
- **pnpm** · **Playwright** · **tsx** tests  
- **Python 3.12** stdlib-only WCA export pipeline  
- **Vercel Analytics**  

---

## Attribution

Competition results are owned and maintained by the [World Cube Association](https://www.worldcubeassociation.org/).  
**Cubify is an independent project and is not an official WCA service.**
