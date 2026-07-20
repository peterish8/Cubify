import assert from "node:assert/strict"
import test from "node:test"
import { flagWashGradient, getFlagColors } from "@/lib/flag-colors"

test("flag color helper returns country-specific pairs", () => {
  assert.deepEqual(getFlagColors("CN"), ["#DE2910", "#FFDE00"])
  assert.deepEqual(getFlagColors("us"), ["#B22234", "#3C3B6E"])
  assert.deepEqual(getFlagColors("IN"), ["#FF9933", "#138808"])
})

test("flag color helper falls back for missing or unknown countries", () => {
  assert.deepEqual(getFlagColors(null), ["#3b82f6", "#38bdf8"])
  assert.deepEqual(getFlagColors("ZZ"), ["#3b82f6", "#38bdf8"])
})

test("flag wash gradient uses both flag colors at low opacity", () => {
  const gradient = flagWashGradient("CN", "90deg")
  assert.equal(
    gradient,
    "linear-gradient(90deg, color-mix(in srgb, #DE2910 14%, transparent), transparent 48%, color-mix(in srgb, #FFDE00 11%, transparent))",
  )
})
