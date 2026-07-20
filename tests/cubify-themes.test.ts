import assert from "node:assert/strict"
import test from "node:test"
import {
  ALL_THEME_IDS,
  CUBIFY_THEMES,
  DEFAULT_THEME,
  THEME_FAMILIES,
  getFamilyForTheme,
  getThemeById,
  isCubifyTheme,
} from "@/lib/cubify-themes"

test("theme catalog exposes eight families with three public shades each", () => {
  assert.equal(THEME_FAMILIES.length, 8)
  assert.deepEqual(
    THEME_FAMILIES.map((family) => family.id),
    ["blue", "green", "pink", "violet", "orange", "gold", "purple", "night"],
  )

  for (const family of THEME_FAMILIES) {
    assert.equal(family.variants.length, 3, `${family.id} should expose 3 shades`)
    assert.deepEqual(
      family.variants.map((variant) => variant.shade),
      ["lighter", "darker", "deep"],
    )
  }
})

test("gold and Tokyo themes keep the intended ids and blackness ladder", () => {
  assert.deepEqual(
    THEME_FAMILIES.find((family) => family.id === "gold")?.variants.map((variant) => variant.id),
    ["gold-bright", "gold", "gold-dark"],
  )

  const night = THEME_FAMILIES.find((family) => family.id === "night")
  assert.deepEqual(
    night?.variants.map((variant) => variant.id),
    ["tokyo-bright", "tokyo-night", "tokyo-deeper"],
  )
  assert.deepEqual(
    night?.variants.map((variant) => variant.swatches[3]),
    ["#12131c", "#08090f", "#000000"],
  )
})

test("theme ids validate persisted values and keep legacy dark-blue mapped to blue", () => {
  assert.equal(DEFAULT_THEME, "blue")
  assert.equal(isCubifyTheme("gold-dark"), true)
  assert.equal(isCubifyTheme("tokyo-deeper"), true)
  assert.equal(isCubifyTheme("not-real"), false)
  assert.equal(getThemeById("gold").name, "Trophy Core")
  assert.equal(getFamilyForTheme("dark-blue").id, "blue")
  assert.deepEqual(ALL_THEME_IDS, CUBIFY_THEMES.map((theme) => theme.id))
})
