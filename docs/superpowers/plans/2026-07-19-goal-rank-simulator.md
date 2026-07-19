# Goal / Rank Simulator Implementation Plan

> **For reviewers / second-opinion agents:** This is the full product + engineering plan for Cubify’s Goal feature (solve-time ↔ NR/CR/WR). Compare against the live code under `app/goal/`, `lib/wca-rank-list.ts`, `lib/wca-result-input.ts`, and `tools/wca-rank-totals/` (especially `rank_list.py`). Spec summary: `docs/superpowers/specs/2026-07-19-goal-rank-simulator.md`.

> **For agentic workers:** Implement task-by-task. Steps use checkbox (`- [ ]` / `- [x]`) syntax for tracking.

**Goal:** Let a cuber enter a WCA ID, pick event + single/average, then either (1) type a hypothetical official result and see NR/CR/WR + Top %, or (2) set a target rank or Top % on any scope and see the required single/average.

**Architecture:** No database. Extend the existing offline WCA Results Export generator to publish compact anonymous rank-list shards on the `rank-data` git branch. The Next.js Goal page lazy-loads one shard per event×kind, binary-searches sorted `best` values, and reuses `rank-totals.json` for percentages.

**Tech Stack:** Next.js 14, React 18, TypeScript 5, Python 3.12 stdlib generator, GitHub Actions, `node:test` via `tsx`, official WCA person API, static JSON on `rank-data`.

---

## One-line pitch

A new Cubify page where a cuber enters their **WCA ID**, picks **event + single/average**, then:

1. **Solve result → ranks:** “If my **single** (or **average**) were **this result**, what **NR / CR / WR** and Top % would that be?”
2. **Target → result:** “To reach **rank #R** *or* **Top P%** on NR/CR/WR, what **single/average** do I need?”

This is about a **hypothetical personal best** (official ranking result), not a live attempt / “run”, not Ao5 simulation mid-comp.

---

## Clarifications (product feedback)

| Topic | Decision |
|--------|----------|
| Language | **Solve / result / single / average** — not “if I run” |
| Single | One solve time (or FMC moves, etc.) treated as official **single** PB |
| Average | Official **average** PB (as WCA ranks averages) — user types the average value |
| Database | **None.** No SQL, Supabase, Redis, or paid backend |
| Storage | Same pattern as today: **git `rank-data` branch** + `raw.githubusercontent.com` fetch |
| Why WCA ID first | Fixes **country → NR** and **continent → CR** correctly |

---

## Global constraints

- Player identity/PRs still come from `https://www.worldcubeassociation.org/api/v0/persons/{WCA_ID}`.
- Ranked-competitor **counts** still come from `rank-totals.json` on `rank-data`.
- Time ↔ rank needs official **`best`** values from export ranks TSVs — **not** inventable from totals alone.
- Publish **anonymous** sorted bests only (no names/WCA IDs in shards).
- Lazy-load **one** `(eventId, rankType)` shard — never all events up front.
- Use `rank / total × 100` for Top %; hide % when rank > total (stale list vs live ranks).
- Show export date; label that this is a snapshot, not a live WCA page.
- Self-adjustment when user already has a PB: multiset “remove one previous best, insert new best” without storing all person IDs.
- Multi-blind packed input deferred (v1 = time events + FMC).

---

## Codebase reality check (pre-feature baseline)

| Piece | Role | Enough for Goal alone? |
|--------|------|-------------------------|
| `app/page.tsx` | Profile: PRs + ranks + Top % | No time→rank |
| `app/compare/page.tsx` | Two-person rank compare | No time input |
| `lib/wca-rank-totals.ts` | Counts only | % after rank exists; **cannot** map time ↔ rank |
| `lib/wca-format.ts` | Display `best` | Reuse for output |
| `lib/wca-events.ts` | Event labels | Reuse for picker |
| `tools/wca-rank-totals` | Counts from export | Must also read **`best`** and emit shards |
| `rank-data` branch | totals + country-totals | Needs `data/rank-lists/` |

**Mistake to avoid:** deriving ranks from totals alone.

**Source of truth for bests:** same export already used by the generator:

- `WCA_export_ranks_single.tsv` — includes **`best`**
- `WCA_export_ranks_average.tsv`
- Geography from `persons` + `countries`

---

## Storage: scale and no-DB strategy

### Real scale (from live `rank-totals.json`)

| Event / kind | World ranked (approx) |
|--------------|------------------------|
| 333 single | ~280,500 |
| 333 average | ~275,200 |
| 222 single | ~184,500 |
| All event×kind rows summed | ~1.91 million |

Huge for naive object arrays; manageable with compact packing + lazy load + latest-only `rank-data`.

### Refuse to store

- Names, WCA IDs, avatars, history  
- Full WCA dump (~350MB) in website repo  
- Per-day history of lists  

### Do store (anonymous multiset)

Per `(eventId, rankType)`:

- Sorted **`best`** values  
- Compact **country** + **continent** indexes  
- Same **source metadata** family as rank-totals  

### Size estimate

| Encoding | 333 single | All ~1.9M rows |
|----------|------------|----------------|
| Raw Int32 bests | ~1.1 MB | ~7.6 MB |
| + country u16 + continent u8 | ~1.9 MB | ~13–15 MB raw |
| Sorted + gzip | often ~0.4–0.8 MB download for big events | several MB total artifacts |
| Naive `[{best,country,…}]` JSON | too fat | reject |

### Chosen encoding (implementation)

`encoding: "delta-i32+u16+u8-b64"`:

- `bestsB64` — little-endian int32 **deltas** of sorted bests, base64  
- `countryIdxB64` — uint16 indexes into `countries[]`  
- `continentIdxB64` — uint8 indexes into `continents[]`  
- Plus `manifest.json` listing all shards and export source  

### Repo layout

```text
main          → website + generator + GHA
rank-data     → published data only (latest)
                 data/rank-totals.json
                 data/country-totals.json
                 data/rank-lists/manifest.json
                 data/rank-lists/{eventId}/{single|average}.json
```

### Load strategy (fast UX)

```text
User picks 333 + single
  → fetch ONLY data/rank-lists/333/single.json
  → decode once → Int32Array + region tables
  → cache NR/CR filtered arrays for this user region
  → keystroke: binary search O(log n)
```

---

## User journey

```text
/goal
  │
  ├─ 1. WCA ID → person API (name, country, continent, current PRs)
  ├─ 2. Event + Single | Average
  ├─ 3. Lazy-load rank-list shard
  └─ 4. Dual-bound workspace
         A) Type result → NR, CR, WR + Top %
         B) Edit rank OR % on NR|CR|WR → required result
```

### Inputs

| Input | Required | Notes |
|--------|----------|--------|
| WCA ID | Yes | Country + continent + optional current PB |
| Event | Yes | From event catalog / export |
| Kind | Yes | `single` \| `average` |
| Hypothetical result | Mode A | Time / FMC string |
| Scope + rank **or** % | Mode B | Either target type |

### Outputs

| Output | Notes |
|--------|--------|
| NR / CR / WR | Rank as if this were official PB for that kind |
| Top % | Via totals + `calculateTopPercent` |
| Required result | Formatted single/average for target |
| Context | Export date; current PB; honesty labels |

---

## Ranking math

Lists sorted by **`best` ascending** (lower = better), WCA-style ties.

### A) Result → rank

```text
strictlyBetter = count(best < T)
rank = strictlyBetter + 1
```

Scoped: WR = all; CR = continent; NR = country.

**Self-adjustment:** if user has PB `P`, rank as if multiset removes one `P` then inserts `T`.

### B) Rank → required result

```text
requiredBest = bests[R - 1]   // on scoped list of “others” after self-remove
// UI: need ≤ format(requiredBest) for rank #R on this export
```

### C) Percent → required result

```text
targetRank = max(1, ceil(percent / 100 * total))
→ then rank → result
```

### Event-specific input

| Kind | User types | Internal `best` |
|------|------------|-----------------|
| Time events | `8.50`, `1:05.32` | centiseconds |
| FMC single | move count | integer moves |
| FMC average | e.g. `25.00` | 100× moves |
| Multi-blind | phase 2 | packed int |

---

## Architecture

```text
GHA (daily workflow extended)
  tools/wca-rank-totals
    acquire export
    count totals
    stream best + region → rank-list shards
  publish → rank-data

Website (main)
  app/goal/page.tsx
  lib/wca-rank-list.ts
  lib/wca-result-input.ts
  reuses wca-rank-totals, wca-format, wca-events, person API
```

### Shard schema (v1)

```json
{
  "schemaVersion": 1,
  "eventId": "333",
  "rankType": "single",
  "encoding": "delta-i32+u16+u8-b64",
  "source": {
    "name": "World Cube Association Results Export",
    "exportDate": "…",
    "exportFormatVersion": "2.x.x",
    "archiveUrl": "https://…",
    "url": "https://www.worldcubeassociation.org/export/results",
    "attribution": "…"
  },
  "count": 280503,
  "countries": ["US", "IN"],
  "continents": ["_North America", "_Asia"],
  "bestsB64": "…",
  "countryIdxB64": "…",
  "continentIdxB64": "…"
}
```

Validate on generate: `count` matches rank-totals world for that event/kind; payloads decode; bests non-decreasing; indexes in range.

### Frontend speed checklist

| Technique | Purpose |
|-----------|---------|
| Fetch after event+kind chosen | No multi-MB home load |
| In-memory + sessionStorage cache | Instant revisit |
| Int32Array + binary search | O(log n) result→rank |
| Cached NR/CR filtered arrays | No full scan per keystroke |
| Debounce ~80ms | Smooth typing |
| Single source of truth `hypotheticalBest` | Dual-bound fields stay consistent |
| Skeleton while loading | Perceived performance |
| Optional idle prefetch | Phase 4 polish |

---

## UI sketch

```text
┌─────────────────────────────────────────────────────────────┐
│  Goal · 2022XXXX01 · India · Asia                           │
│  Event [3×3]  Kind ( Single | Average )                     │
│                                                             │
│  If my SINGLE were:  [  8.50  s ]                           │
│  Your current single: 9.12                                  │
│                                                             │
│  ┌ NR #42  Top 1.2% ┐ ┌ CR … ┐ ┌ WR … ┐                    │
│  │ rank [42]  % [ ] │ │  …   │ │  …  │  ← edit any one     │
│  └──────────────────┘ └──────┘ └─────┘    → required result │
│  Export snapshot: 18 Jul 2026 · not a live WCA page         │
└─────────────────────────────────────────────────────────────┘
```

Nav: **Goal** in `SiteChrome` beside Lookup / Compare / Countries.

Shareable URL (phase 4): `/goal?wca=…&event=333&kind=single&best=850`

---

## File map

| Path | Role |
|------|------|
| `app/goal/page.tsx` | Wizard + dual-bound UI |
| `lib/wca-rank-list.ts` | Fetch, decode, rank math |
| `lib/wca-result-input.ts` | Parse/format time + FMC |
| `tests/wca-rank-list.test.ts` | Math + schema decode |
| `tests/wca-result-input.test.ts` | Parse/format |
| `components/layout/SiteChrome.tsx` | Nav link |
| `tools/wca-rank-totals/src/wca_rank_totals/parse.py` | Read `best`, collect entries |
| `tools/wca-rank-totals/src/wca_rank_totals/rank_list.py` | Pack/validate/write shards |
| `tools/wca-rank-totals/src/wca_rank_totals/cli.py` | Wire rank-lists into generate |
| `tools/wca-rank-totals/tests/test_rank_list.py` | Generator tests |
| `.github/workflows/update-wca-rank-totals.yml` | Publish shards to `rank-data` |
| `docs/superpowers/specs/2026-07-19-goal-rank-simulator.md` | Short design note |
| `docs/superpowers/plans/2026-07-19-goal-rank-simulator.md` | This plan |

---

## Implementation phases / tasks

### Phase 1 — Generator (repo data, no DB)

- [x] Read `best` while streaming ranks TSV  
- [x] Emit `data/rank-lists/{event}/{kind}.json` with delta-b64 packing  
- [x] Assert row counts match totals world  
- [x] Write `manifest.json`; skip regenerate when export + lists already valid  
- [x] Extend GHA to validate and publish `data/rank-lists/`  

### Phase 2 — Libs + tests

- [x] `wca-rank-list.ts`: fetch, assert, decode, `rankAfterReplace`, scoped ranks, rank/% → required best  
- [x] `wca-result-input.ts`: time + FMC parse/format  
- [x] Node tests for ties, replace-self, percent ceil, decode  

### Phase 3 — Page

- [x] `/goal` wizard (WCA ID → event/kind → workspace)  
- [x] Dual-bound result ↔ rank/%  
- [x] Loading / error / export date  
- [x] Nav **Goal** link  

### Phase 4 — Polish (optional / remaining)

- [x] Query-string share (`?wca=&event=&kind=&best=`)  
- [x] Idle prefetch of common events after first shard load  
- [x] First successful `rank-data` publish with real export shards  
- [x] Goal open-page explainer (hero + three value cards)  
- [x] Dual-bind preserve scope while editing rank/%  
- [ ] Multi-blind input  
- [ ] Thin/orphan `rank-data` history hygiene if git size grows  

### Out of scope v1

- Any database or server-side rank API  
- Live unofficial full-rank JSON scraping  
- Simulating scrambles / Ao5 variance  
- Historical “what was my rank in 2019”  

---

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| 333 list feels big | Lazy one-event load; compact delta-b64 |
| `rank-data` git growth | Overwrite latest; compact format; thin data branch if needed |
| User thinks it’s live WCA | Export date + honesty copy |
| Wrong NR without WCA ID | Gate: ID required first |
| Average confused with session mean | Copy: official average PB |
| Design non-goal “no full ranking lists” | Exception: **anonymous bests only**, official export, static files |

---

## Success criteria

- No database; only `rank-data` static files + public WCA person API.  
- After one shard load, typing a result updates NR/CR/WR + % essentially instantly.  
- Editing rank **or** % on any scope updates required single/average.  
- WCA ID drives correct country/continent scopes.  
- Storage practical: lazy shards, not whole universe per page load.  

---

## Defaults locked

| Choice | Value |
|--------|--------|
| Route | `/goal` · nav **Goal** |
| Hosting | `rank-data` git files only — **no DB** |
| Download | Per event + single/average shard |
| Self PR | Analytic replace |
| MBLD input | Deferred |
| Encoding | `delta-i32+u16+u8-b64` (implemented) |

---

## How to review this plan (for a second AI)

1. **Correctness of data model:** Can time→rank be done without full bests? (Plan says no — challenge if you disagree.)  
2. **No-DB claim:** Is git `rank-data` + raw.githubusercontent acceptable for ~MB shards?  
3. **NR/CR correctness:** Is WCA ID → country/continent + region indexes sufficient?  
4. **Self-replace math:** Does removing one previous PB without person IDs fail in edge cases (duplicate bests, missing from export)?  
5. **Percent invert:** Is `ceil(p/100 * total)` the right product choice?  
6. **Ops:** Daily GHA + overwrite vs LFS / CDN / separate storage?  
7. **Diff vs implementation:** Flag any drift between this plan and current code.  

### Implementation status note (for reviewers)

As of 2026-07-19, Phases 1–3 are implemented in the monorepo. Phase 4 polish and the **first production publish of rank-list shards to `rank-data`** may still be pending — until then `/goal` shows a clear load error for missing shards. Run the existing workflow or:

```bash
cd tools/wca-rank-totals
PYTHONPATH=src python -m wca_rank_totals.cli
```

…then publish `data/rank-lists/` to the `rank-data` branch as the workflow does.
