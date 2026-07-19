import assert from "node:assert/strict"
import test from "node:test"

import { EVENT_NAMES, eventDisplayName } from "../lib/wca-events"

test("maps known event ids to display names", () => {
  assert.equal(eventDisplayName("333"), "3×3 Cube")
  assert.equal(eventDisplayName("333bf"), "3×3 Blindfolded")
  assert.equal(eventDisplayName("minx"), "Megaminx")
})

test("falls back to uppercased id for unknown events", () => {
  assert.equal(eventDisplayName("nonsense"), "NONSENSE")
  assert.equal(eventDisplayName(""), "")
})

test("catalog includes feet and old multi-blind so rank-data events resolve", () => {
  assert.equal(EVENT_NAMES["333ft"], "3×3 With Feet")
  assert.equal(EVENT_NAMES["333mbo"], "3×3 Multi-Blind Old")
})
