import assert from "node:assert/strict"
import test from "node:test"

import { formatMultiBlind, formatResult } from "../lib/wca-format"

test("formats centisecond times", () => {
  assert.equal(formatResult("333", 766, "single"), "7.66s")
  assert.equal(formatResult("333", 12530, "average"), "2:05.30")
})

test("formats fewest-moves singles and averages", () => {
  assert.equal(formatResult("333fm", 25, "single"), "25 moves")
  assert.equal(formatResult("333fm", 2500, "average"), "25.00 moves")
})

test("formats multi-blind packed results", () => {
  // difference=1 => DD=98, time=3456s, missed=2 => solved=3, attempted=5
  // packed: 98 * 1e7 + 3456 * 100 + 2 = 980345602
  assert.equal(formatMultiBlind(980345602), "3/5 57:36")
  assert.equal(formatResult("333mbf", 980345602, "single"), "3/5 57:36")
})

test("formats old-format multi-blind packed results", () => {
  // Old format 1SSAATTTTT (best >= 1e9): "1970303456"
  // SS=97 => solved = 99 - 97 = 2; AA=03 => attempted = 3;
  // TTTTT=03456 => 3456s => 57:36.
  assert.equal(formatMultiBlind(1970303456), "2/3 57:36")
  assert.equal(formatResult("333mbf", 1970303456, "single"), "2/3 57:36")
})

test("renders '?' when the multi-blind time field is 99999", () => {
  // Old format "1950799999": SS=95 => solved = 4; AA=07 => attempted = 7;
  // TTTTT=99999 => unknown time => "?".
  assert.equal(formatMultiBlind(1950799999), "4/7 ?")
  assert.equal(formatResult("333mbo", 1950799999, "single"), "4/7 ?")
})

test("returns em dash for invalid values", () => {
  assert.equal(formatResult("333", 0, "single"), "—")
  assert.equal(formatResult("333", -1, "single"), "—")
})
