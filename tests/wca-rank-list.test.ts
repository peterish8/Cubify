import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  assertRankListDocument,
  countEqual,
  countStrictlyBetter,
  decodeRankListDocument,
  percentToTargetRank,
  rankAfterReplace,
  rankToRequiredBest,
  resultToAllScopeRanks,
  type RankListDocument,
} from "../lib/wca-rank-list"
import type { RankTotalsDocument } from "../lib/wca-rank-totals"

const SOURCE = {
  name: "World Cube Association Results Export",
  exportDate: "2026-07-17T03:24:49+00:00",
  exportFormatVersion: "2.0.2",
  archiveUrl: "https://example.test/export.zip",
  url: "https://www.worldcubeassociation.org/export/results",
  attribution: "Based on competition results owned and maintained by the World Cube Association.",
}

function packI32Deltas(values: number[]): string {
  const deltas = new Int32Array(values.length)
  let prev = 0
  for (let i = 0; i < values.length; i++) {
    deltas[i] = values[i] - prev
    prev = values[i]
  }
  return Buffer.from(deltas.buffer, deltas.byteOffset, deltas.byteLength).toString("base64")
}

function packU16(values: number[]): string {
  const arr = Uint16Array.from(values)
  return Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength).toString("base64")
}

function packU8(values: number[]): string {
  return Buffer.from(Uint8Array.from(values)).toString("base64")
}

function makeDoc(partial: {
  bests: number[]
  countryIdx: number[]
  continentIdx: number[]
  countries?: string[]
  continents?: string[]
}): RankListDocument {
  const count = partial.bests.length
  return {
    schemaVersion: 1,
    eventId: "333",
    rankType: "single",
    encoding: "delta-i32+u16+u8-b64",
    source: SOURCE,
    count,
    countries: partial.countries ?? ["IN", "US"],
    continents: partial.continents ?? ["_Asia", "_North America"],
    bestsB64: packI32Deltas(partial.bests),
    countryIdxB64: packU16(partial.countryIdx),
    continentIdxB64: packU8(partial.continentIdx),
  }
}

const totals: RankTotalsDocument = {
  schemaVersion: 1,
  source: SOURCE,
  events: {
    "333": {
      single: {
        world: 3,
        continents: { _Asia: 2, "_North America": 1 },
        countries: { IN: 2, US: 1 },
      },
    },
  },
}

describe("wca-rank-list", () => {
  it("binary searches sorted bests", () => {
    const bests = [1000, 1100, 1100, 1200]
    assert.equal(countStrictlyBetter(bests, 1100), 1)
    assert.equal(countEqual(bests, 1100), 2)
    assert.equal(countStrictlyBetter(bests, 999), 0)
    assert.equal(countStrictlyBetter(bests, 1300), 4)
  })

  it("computes rank with ties", () => {
    const bests = [1000, 1100, 1100, 1200]
    assert.deepEqual(rankAfterReplace(bests, 1100, null), { rank: 2, tiesWith: 2 })
    assert.deepEqual(rankAfterReplace(bests, 900, null), { rank: 1, tiesWith: 0 })
    assert.deepEqual(rankAfterReplace(bests, 1300, null), { rank: 5, tiesWith: 0 })
  })

  it("removes previous PB when replacing", () => {
    // You are currently 1100 (one of the ties). New 1050 should not count your old 1100 as better.
    const bests = [1000, 1100, 1100, 1200]
    assert.deepEqual(rankAfterReplace(bests, 1050, 1100), { rank: 2, tiesWith: 0 })
    // Same PB re-entered: still rank 2 among remaining, tied with one other 1100
    assert.deepEqual(rankAfterReplace(bests, 1100, 1100), { rank: 2, tiesWith: 1 })
    // Improving past #1: old 1100 removed from "better", new 900 is rank 1
    assert.deepEqual(rankAfterReplace(bests, 900, 1100), { rank: 1, tiesWith: 0 })
    // Getting slower: old 1000 was strictly better than 1150 → subtract that slot
    assert.deepEqual(rankAfterReplace(bests, 1150, 1000), { rank: 3, tiesWith: 0 })
  })

  it("rank to required best", () => {
    const bests = [1000, 1100, 1200]
    assert.equal(rankToRequiredBest(bests, 1, null), 1000)
    assert.equal(rankToRequiredBest(bests, 2, null), 1100)
    assert.equal(rankToRequiredBest(bests, 3, null), 1200)
    assert.equal(rankToRequiredBest(bests, 4, null), null)
    assert.equal(rankToRequiredBest(bests, 1, 1100), 1000)
    assert.equal(rankToRequiredBest(bests, 2, 1100), 1200)
  })

  it("percent to rank uses ceil", () => {
    assert.equal(percentToTargetRank(1, 1000), 10)
    assert.equal(percentToTargetRank(0.1, 1000), 1)
    assert.equal(percentToTargetRank(100, 1000), 1000)
    assert.equal(percentToTargetRank(0, 1000), null)
  })

  it("decodes shard and computes scoped ranks", () => {
    // Sorted: IN 1000, US 1100, IN 1100  → after sort by best: 1000 IN, 1100 US, 1100 IN
    const doc = makeDoc({
      bests: [1000, 1100, 1100],
      countryIdx: [0, 1, 0],
      continentIdx: [0, 1, 0],
    })
    assertRankListDocument(doc)
    const index = decodeRankListDocument(doc)
    const ranks = resultToAllScopeRanks(index, 1050, null, "IN", "_Asia", totals)
    assert.equal(ranks.wr.rank, 2)
    assert.equal(ranks.nr.rank, 2) // IN only: 1000, 1100 → 1050 is rank 2
    assert.equal(ranks.cr.rank, 2)
    assert.ok(ranks.wr.topPercent !== null)
  })
})
