# Cubify

Cubify turns an official WCA ID into an easy-to-read speedcubing profile: personal records, national/continental/world ranks, and mathematically correct **Top X%** labels.

**Goal** (`/goal`) answers “if my single/average were this result, what NR/CR/WR would I have?” and the reverse (target rank or Top % → required result). It uses the same official export, published as compact per-event rank-list shards on the `rank-data` branch (no database).

## Accurate data sources

- Player identity and personal records come directly from the official WCA person API.
- Ranked-competitor totals are generated from the official WCA Results Export v2.
- Only competitors with a valid ranked result for an event are counted; merely registered WCA accounts are not included.
- Percentages use `rank / ranked competitors × 100`. If a live rank is newer than the totals dataset, Cubify hides only the percentage instead of showing a misleading value.

## Monorepo architecture

```text
app/                         Next.js Cubify website (lookup, goal, compare, countries)
lib/wca-rank-totals.ts       Typed totals client and percentage helpers
lib/wca-rank-list.ts         Lazy rank-list shards (time ↔ rank)
tests/                       Frontend data-contract tests
tools/wca-rank-totals/       Python 3.12 official-export generator
.github/workflows/           Daily validation and publication
rank-data branch             rank-totals.json, country-totals.json, rank-lists/
```

The generator uses no SQL database and no paid backend. It first tries HTTP byte-range access so Python's ZIP reader downloads only the required archive blocks. If the WCA host does not support a trustworthy range response, it safely falls back to the complete ZIP.

Every generated bucket must satisfy both invariants before publication:

```text
world total = sum of country totals
world total = sum of continent totals
```

Invalid metadata, duplicate rank rows, non-positive ranks, missing current-person mappings, malformed ZIP responses, or failed reconciliation stop the refresh. The previous JSON remains available as the last-known-good dataset.

## Development

```bash
pnpm install
pnpm test
pnpm build

cd tools/wca-rank-totals
PYTHONPATH=src python -m unittest discover -s tests -v
PYTHONPATH=src python -m wca_rank_totals.cli
```

The scheduled workflow checks the official export daily. If the WCA export date is unchanged, it skips the ZIP entirely. Changed output is committed only to `rank-data`, keeping routine data refreshes separate from website source history.

## Attribution

Competition results are owned and maintained by the [World Cube Association](https://www.worldcubeassociation.org/). Cubify is an independent project and is not an official WCA service.
