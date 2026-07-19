# Goal / Rank Simulator

## Status

Implemented 2026-07-19 (Phases 1–3). Full plan for second-opinion review:

**`docs/superpowers/plans/2026-07-19-goal-rank-simulator.md`**

## Summary

`/goal` lets a cuber enter a WCA ID (for country/continent), pick event + single/average, then:

1. Enter a hypothetical official result → see NR / CR / WR and Top %.
2. Enter a target rank or Top % on any scope → see the required result.

## Data

- No database. Shards live on `rank-data` as `data/rank-lists/{eventId}/{single|average}.json`.
- Generated from the same WCA Results Export ranks TSV `best` column + person geography.
- Encoding: delta-int32 bests + uint16 country index + uint8 continent index, base64 (`delta-i32+u16+u8-b64`).
- Lazy-loaded per event/kind in the browser; totals still from `rank-totals.json`.

## Math

- Rank = 1 + count(best < T) on the scoped sorted list (WCA-style ties).
- If the user already has a PB, adjust as “remove one previous best, insert new best”.
- Top % uses existing `rank / total × 100` with hide-when-stale behavior.

## Non-goals (v1)

- Multi-blind packed input UI
- Live competition / Ao5 simulation
- Historical ranks
