import assert from "node:assert/strict"
import test from "node:test"

import {
  assertRankTotalsDocument,
  calculateTopPercent,
  formatTopPercent,
  getScopedTotals,
  RANK_TOTALS_URL,
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
      single: { world: 1000, continents: { _Asia: 1000 }, countries: { IN: 1000 } },
    },
  },
}

test("uses Cubify's dedicated rank-data branch", () => {
  assert.equal(
    RANK_TOTALS_URL,
    "https://raw.githubusercontent.com/peterish8/Cubify/rank-data/data/rank-totals.json",
  )
})

test("looks up world, continent, and country totals", () => {
  assert.deepEqual(getScopedTotals(totals, "333", "single", "_Asia", "in"), {
    world: 1000,
    continent: 1000,
    country: 1000,
  })
})

test("returns null scopes when an event or rank type is absent", () => {
  assert.deepEqual(getScopedTotals(totals, "333", "average", "_Asia", "IN"), {
    world: null,
    continent: null,
    country: null,
  })
})

test("calculates top share from rank divided by ranked-result total", () => {
  assert.equal(calculateTopPercent(100, 1000), 10)
  assert.equal(calculateTopPercent(1, 1000), 0.1)
})

test("hides percentages for missing or stale totals without changing the rank", () => {
  const officialRank = 1001
  assert.equal(calculateTopPercent(officialRank, null), null)
  assert.equal(calculateTopPercent(officialRank, 1000), null)
  assert.equal(officialRank, 1001)
})

test("formats very small and ordinary top shares", () => {
  assert.equal(formatTopPercent(0.004), "Top <0.1%")
  assert.equal(formatTopPercent(0.25), "Top 0.25%")
  assert.equal(formatTopPercent(10), "Top 10%")
  assert.equal(formatTopPercent(null), null)
})

test("rejects empty or unreconciled documents", () => {
  assert.throws(() => assertRankTotalsDocument({ ...totals, events: {} }))
  const invalid = structuredClone(totals)
  invalid.events["333"].single!.countries.IN = 999
  assert.throws(() => assertRankTotalsDocument(invalid))
})
