# Cubify Rank Totals Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Cubify's many unofficial rank-list requests with one compact official-export-derived totals request and display mathematically correct top percentages.

**Architecture:** A typed client library owns the static JSON contract, scoped-total lookup, stale-data guard, and top-percentage formatting. `app/page.tsx` keeps using the official WCA person API for personal records, fetches the new aggregate once per search, and reuses it across every event.

**Tech Stack:** Next.js 14, React 18, TypeScript 5, `node:test` through `tsx`, official WCA person API, static JSON from `peterish8/wca-rank-totals`.

## Global Constraints

- Do not start until the generator completion gate in `2026-07-17-wca-rank-totals-generator.md` passes.
- Player and personal-record source remains `https://www.worldcubeassociation.org/api/v0/persons/{WCA_ID}`.
- Totals source is exactly `https://raw.githubusercontent.com/peterish8/wca-rank-totals/main/data/rank-totals.json`.
- Fetch the totals document no more than once per player search.
- Remove every runtime dependency on `robiningelbrecht/wca-rest-api`.
- Preserve official canonical continent IDs and uppercase WCA country ISO2 values for lookups.
- Use `rank / totalRankedCompetitors * 100`; never use `(rank - 1) / total` for the displayed top share.
- A missing or stale total hides only the percentage; it must not hide a valid official rank.
- Values below `0.1%` display as `Top <0.1%`, never `Top 0.0%`.
- Show the WCA export date and source attribution when totals load successfully.

---

## File map

- `lib/wca-rank-totals.ts` — JSON contract, fetch, lookup, accuracy guard, calculation, and formatting.
- `tests/wca-rank-totals.test.ts` — contract, geographic lookup, formula, and stale-total tests.
- `package.json` / `pnpm-lock.yaml` — `tsx` test runner and `test` script.
- `app/page.tsx` — one totals fetch, event-stat construction, labels, freshness, and attribution.
- `app/compare/page.tsx` — inspected only; no totals dependency is added.

### Task 1: Add a tested rank-totals client library

**Files:**
- Create: `lib/wca-rank-totals.ts`
- Create: `tests/wca-rank-totals.test.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: schema version `1` JSON published by the generator.
- Produces: `fetchRankTotals`, `getScopedTotals`, `calculateTopPercent`, and `formatTopPercent` for `app/page.tsx`.

- [ ] **Step 1: Install the TypeScript test runner and add the test script**

Run:

```bash
pnpm add -D tsx@4.20.3
pnpm pkg set scripts.test="tsx --test tests/**/*.test.ts"
```

Expected: `tsx` appears in `devDependencies`, `test` appears in `scripts`, and `pnpm-lock.yaml` changes.

- [ ] **Step 2: Write failing contract and percentage tests**

Create `tests/wca-rank-totals.test.ts`:

```typescript
import assert from "node:assert/strict"
import test from "node:test"

import {
  calculateTopPercent,
  formatTopPercent,
  getScopedTotals,
  type RankTotalsDocument,
} from "../lib/wca-rank-totals"

const totals: RankTotalsDocument = {
  schemaVersion: 1,
  source: {
    name: "World Cube Association Results Export",
    exportDate: "2026-07-17T03:24:49+00:00",
    exportFormatVersion: "2.0.2",
    archiveUrl: "https://example.test/export.zip",
    url: "https://www.worldcubeassociation.org/export/results",
    attribution: "Based on competition results owned and maintained by the World Cube Association.",
  },
  events: {
    "333": {
      single: {
        world: 1000,
        continents: { _Asia: 400 },
        countries: { IN: 100 },
      },
    },
  },
}

test("looks up world, continent, and country totals", () => {
  assert.deepEqual(getScopedTotals(totals, "333", "single", "_Asia", "in"), {
    world: 1000,
    continent: 400,
    country: 100,
  })
})

test("returns null scopes when an event or rank type is absent", () => {
  assert.deepEqual(getScopedTotals(totals, "333", "average", "_Asia", "IN"), {
    world: null,
    continent: null,
    country: null,
  })
})

test("calculates top share from rank divided by total", () => {
  assert.equal(calculateTopPercent(100, 1000), 10)
  assert.equal(calculateTopPercent(1, 1000), 0.1)
  assert.equal(calculateTopPercent(1001, 1000), null)
})

test("formats very small and ordinary top shares", () => {
  assert.equal(formatTopPercent(0.004), "Top <0.1%")
  assert.equal(formatTopPercent(0.25), "Top 0.25%")
  assert.equal(formatTopPercent(10), "Top 10%")
  assert.equal(formatTopPercent(null), null)
})
```

- [ ] **Step 3: Run the test and verify it fails**

Run: `pnpm test`

Expected: module-not-found failure for `../lib/wca-rank-totals`.

- [ ] **Step 4: Implement the typed contract and pure helpers**

Create `lib/wca-rank-totals.ts`:

```typescript
export const RANK_TOTALS_URL =
  "https://raw.githubusercontent.com/peterish8/wca-rank-totals/main/data/rank-totals.json"

export type RankType = "single" | "average"

export interface RankBucket {
  world: number
  continents: Record<string, number>
  countries: Record<string, number>
}

export interface RankTotalsDocument {
  schemaVersion: 1
  source: {
    name: string
    exportDate: string
    exportFormatVersion: string
    archiveUrl: string
    url: string
    attribution: string
  }
  events: Record<string, Partial<Record<RankType, RankBucket>>>
}

export interface ScopedTotals {
  world: number | null
  continent: number | null
  country: number | null
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0
}

export function assertRankTotalsDocument(value: unknown): asserts value is RankTotalsDocument {
  if (!value || typeof value !== "object") throw new Error("Invalid rank totals document")
  const document = value as Partial<RankTotalsDocument>
  if (document.schemaVersion !== 1) throw new Error("Unsupported rank totals schema")
  if (!document.source || typeof document.source.exportDate !== "string") {
    throw new Error("Rank totals source metadata is missing")
  }
  if (!document.events || typeof document.events !== "object") {
    throw new Error("Rank totals events are missing")
  }
}

export async function fetchRankTotals(signal?: AbortSignal): Promise<RankTotalsDocument> {
  const response = await fetch(RANK_TOTALS_URL, { signal })
  if (!response.ok) throw new Error(`Rank totals request failed with ${response.status}`)
  const document: unknown = await response.json()
  assertRankTotalsDocument(document)
  return document
}

export function getScopedTotals(
  document: RankTotalsDocument,
  eventId: string,
  rankType: RankType,
  continentId: string,
  countryIso2: string,
): ScopedTotals {
  const bucket = document.events[eventId]?.[rankType]
  if (!bucket) return { world: null, continent: null, country: null }
  const world = isPositiveInteger(bucket.world) ? bucket.world : null
  const continent = isPositiveInteger(bucket.continents[continentId]) ? bucket.continents[continentId] : null
  const country = isPositiveInteger(bucket.countries[countryIso2.toUpperCase()])
    ? bucket.countries[countryIso2.toUpperCase()]
    : null
  return { world, continent, country }
}

export function calculateTopPercent(rank: number, total: number | null): number | null {
  if (!isPositiveInteger(rank) || !isPositiveInteger(total) || rank > total) return null
  return (rank / total) * 100
}

function trimZeros(value: string): string {
  return value.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1")
}

export function formatTopPercent(value: number | null): string | null {
  if (value === null) return null
  if (value < 0.1) return "Top <0.1%"
  const digits = value < 1 ? 2 : 1
  return `Top ${trimZeros(value.toFixed(digits))}%`
}
```

- [ ] **Step 5: Run tests and verify they pass**

Run: `pnpm test`

Expected: four passing tests and zero failures.

- [ ] **Step 6: Commit the client library**

```bash
git add package.json pnpm-lock.yaml lib/wca-rank-totals.ts tests/wca-rank-totals.test.ts
git commit -m "feat: add official WCA rank totals client"
```

### Task 2: Replace per-event unofficial requests with one aggregate lookup

**Files:**
- Modify: `app/page.tsx`
- Test: `tests/wca-rank-totals.test.ts`

**Interfaces:**
- Consumes: the four library exports from Task 1 and the official person's canonical country fields.
- Produces: event statistics containing official rank, ranked-person total, and nullable `topPercent` for each scope.

- [ ] **Step 1: Add a stale-total regression test**

Append to `tests/wca-rank-totals.test.ts`:

```typescript
test("hides a percentage when the live rank is newer than the total", () => {
  assert.equal(calculateTopPercent(101, 100), null)
})
```

- [ ] **Step 2: Run the focused test**

Run: `pnpm test`

Expected: five passing tests.

- [ ] **Step 3: Import the totals helpers and preserve canonical region identifiers**

At the top of `app/page.tsx`, add:

```typescript
import {
  calculateTopPercent,
  fetchRankTotals,
  formatTopPercent,
  getScopedTotals,
  type RankTotalsDocument,
} from "@/lib/wca-rank-totals"
```

Change the player country type to include the official continent ID:

```typescript
country: {
  name: string
  iso2: string
  continentId: string
}
```

Build it directly from the official response:

```typescript
const countryIso = (player.country?.iso2 || player.country_iso2 || "XX").toUpperCase()
const continentId = player.country?.continent_id || ""

country: {
  name: player.country?.name || countryIso,
  iso2: countryIso.toLowerCase(),
  continentId,
},
```

Keep the existing human-readable `continent` field only for display. Delete `CONTINENT_CODES`, because the compact document uses canonical IDs directly.

- [ ] **Step 4: Replace the statistics shape and formula**

Use this `RegionStats` interface:

```typescript
interface RegionStats {
  totalCompetitors: number | null
  topPercent: number | null
}
```

Replace `calculateStats` with:

```typescript
const calculateStats = (rank: number, totalCompetitors: number | null): RegionStats => ({
  totalCompetitors,
  topPercent: calculateTopPercent(rank, totalCompetitors),
})
```

Initialize empty scopes with `{ totalCompetitors: null, topPercent: null }`.

- [ ] **Step 5: Fetch totals once and replace the six-request event loop**

Immediately after `setPlayerInfo(transformedPlayer)`, fetch the aggregate once without making player lookup depend on its availability:

```typescript
let rankTotals: RankTotalsDocument | null = null
try {
  rankTotals = await fetchRankTotals()
  setRankTotalsExportDate(rankTotals.source.exportDate)
} catch (totalsError) {
  console.error("Rank percentages are temporarily unavailable", totalsError)
  setRankTotalsExportDate(null)
}
```

Add state near the existing state declarations:

```typescript
const [rankTotalsExportDate, setRankTotalsExportDate] = useState<string | null>(null)
```

For each event, replace all six network responses and JSON parses with:

```typescript
const singleTotals = rankTotals
  ? getScopedTotals(rankTotals, eventId, "single", continentId, countryIso)
  : { world: null, continent: null, country: null }
const averageTotals = rankTotals
  ? getScopedTotals(rankTotals, eventId, "average", continentId, countryIso)
  : { world: null, continent: null, country: null }

eventStats.single.wr = calculateStats(eventStats.single.rank.wr, singleTotals.world)
eventStats.single.cr = calculateStats(eventStats.single.rank.cr, singleTotals.continent)
eventStats.single.nr = calculateStats(eventStats.single.rank.nr, singleTotals.country)
eventStats.average.wr = calculateStats(eventStats.average.rank.wr, averageTotals.world)
eventStats.average.cr = calculateStats(eventStats.average.rank.cr, averageTotals.continent)
eventStats.average.nr = calculateStats(eventStats.average.rank.nr, averageTotals.country)
```

Delete the six `fetch(...)` calls, response-status logging, `data.total` reads, and the old percentile branches.

- [ ] **Step 6: Replace repeated percentage math in the six labels**

For each NR, CR, and WR label in both Single and Average, render the already calculated value:

```tsx
{formatTopPercent(eventStats.single.nr.topPercent) && (
  <span className="text-glass-muted">{formatTopPercent(eventStats.single.nr.topPercent)}</span>
)}
```

Use the corresponding `single.cr`, `single.wr`, `average.nr`, `average.cr`, and `average.wr` values in the other five locations. Do not recalculate percentages in JSX.

- [ ] **Step 7: Run tests and production build**

Run:

```bash
pnpm test
pnpm build
```

Expected: five tests pass and Next.js reports a successful production build.

- [ ] **Step 8: Commit the one-fetch integration**

```bash
git add app/page.tsx tests/wca-rank-totals.test.ts
git commit -m "feat: use compact official WCA rank totals"
```

### Task 3: Add freshness, attribution, and graceful degradation

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `rankTotalsExportDate` from Task 2.
- Produces: visible data provenance and a clear percentage-unavailable state without affecting official rank cards.

- [ ] **Step 1: Add a stable export-date formatter**

Near the component helpers in `app/page.tsx`, add:

```typescript
const formatExportDate = (value: string): string =>
  new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(value))
```

- [ ] **Step 2: Render official source freshness below the player summary**

Add:

```tsx
{rankTotalsExportDate ? (
  <p className="mt-3 text-center text-xs text-glass-muted">
    Rank totals based on official WCA results as of {formatExportDate(rankTotalsExportDate)}. {" "}
    <a
      href="https://www.worldcubeassociation.org/export/results"
      target="_blank"
      rel="noreferrer"
      className="underline underline-offset-2 hover:text-white"
    >
      Source
    </a>
  </p>
) : playerInfo ? (
  <p className="mt-3 text-center text-xs text-amber-300/80">
    Official ranks are available; percentage totals are temporarily unavailable.
  </p>
) : null}
```

- [ ] **Step 3: Reset freshness on every search**

Beside `setPlayerInfo(null)` and `setEventsData(null)`, add:

```typescript
setRankTotalsExportDate(null)
```

This prevents a failed second search from displaying the first search's freshness date.

- [ ] **Step 4: Verify compare remains independent**

Run:

```bash
rg -n "rank-totals|wca-rest-api" app/compare/page.tsx
```

Expected: no output. The compare page continues using only official personal ranks.

- [ ] **Step 5: Run tests and build**

Run: `pnpm test && pnpm build`

Expected: all tests and production build pass.

- [ ] **Step 6: Commit provenance UI**

```bash
git add app/page.tsx
git commit -m "feat: show WCA rank data freshness"
```

### Task 4: Verify production behavior and publish Cubify

**Files:**
- Inspect: `app/page.tsx`
- Inspect: `app/compare/page.tsx`
- Inspect: `lib/wca-rank-totals.ts`

**Interfaces:**
- Consumes: deployed generator JSON and completed Cubify integration.
- Produces: verified `main` commits in `peterish8/Cubify`.

- [ ] **Step 1: Verify the deployed totals contract**

Run:

```bash
curl --fail --silent --show-error \
  https://raw.githubusercontent.com/peterish8/wca-rank-totals/main/data/rank-totals.json \
  | python -c 'import json,sys; d=json.load(sys.stdin); assert d["schemaVersion"] == 1; assert "333" in d["events"]; print(d["source"]["exportDate"])'
```

Expected: prints the official export date.

- [ ] **Step 2: Confirm all unofficial runtime URLs are gone**

Run:

```bash
if rg -n "robiningelbrecht|wca-rest-api|rank/world|rank/.*single" app lib; then
  echo "unexpected unofficial dependency remains" >&2
  exit 1
fi
```

Expected: exit status `0` with no matches.

- [ ] **Step 3: Run the final automated verification**

Run:

```bash
pnpm test
pnpm build
```

Expected: all tests pass and the production build succeeds.

- [ ] **Step 4: Smoke-test three official competitors**

Run the production build locally with `pnpm start`, then test:

- `2009ZEMD01` — Oceania geographic lookup.
- `2012PARK03` — North America geographic lookup.
- `2019WANY36` — Asia geographic lookup.

For each ID, verify the player loads, official ranks remain visible, percentages appear only when totals are present and not stale, percentages match `rank / total * 100`, and the export date appears once.

- [ ] **Step 5: Publish through the connected GitHub app**

Synchronize the changed files to `peterish8/Cubify` `main` with the exact local contents, preserving unrelated remote changes. Verify the resulting remote commit contains:

```text
package.json
pnpm-lock.yaml
lib/wca-rank-totals.ts
tests/wca-rank-totals.test.ts
app/page.tsx
```

Expected: the connected GitHub app returns successful commit SHAs and remote `main` contains no unofficial totals URLs.

- [ ] **Step 6: Verify the production deployment**

Open the deployed Cubify website, repeat one known WCA ID search, and confirm there are only two relevant data requests: the official WCA person request and the compact rank-totals request.

## Final completion gate

- Generator is public, automated, reconciled, and benchmarked.
- Cubify has no unofficial rank-totals dependency.
- One player search makes one person request and one totals request.
- The formula is `rank / total * 100` and formatting never shows `Top 0.0%`.
- Missing or stale totals hide percentages without hiding official ranks.
- Tests and production build pass.
- Remote GitHub `main` and production deployment are verified.
