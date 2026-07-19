import assert from "node:assert/strict"
import test from "node:test"

import {
  assertCountryTotalsDocument,
  continentLabel,
  COUNTRY_TOTALS_URL,
  flagEmoji,
  type CountryTotalsDocument,
} from "../lib/wca-country-totals"

const document: CountryTotalsDocument = {
  schemaVersion: 1,
  source: {
    name: "World Cube Association Results Export",
    exportDate: "2026-07-17T03:24:49+00:00",
    exportFormatVersion: "2.0.2",
    archiveUrl: "https://example.test/export.zip",
    url: "https://www.worldcubeassociation.org/export/results",
    attribution: "Based on competition results owned and maintained by the World Cube Association.",
  },
  totalCubers: 4,
  countries: [
    { iso2: "IN", name: "India", continentId: "_Asia", cubers: 3 },
    { iso2: "US", name: "United States", continentId: "_North_America", cubers: 1 },
  ],
}

test("uses Cubify's dedicated country totals data URL", () => {
  assert.equal(
    COUNTRY_TOTALS_URL,
    "https://raw.githubusercontent.com/peterish8/Cubify/rank-data/data/country-totals.json",
  )
})

test("accepts a reconciled country totals document", () => {
  assert.doesNotThrow(() => assertCountryTotalsDocument(document))
})

test("rejects unsorted or unreconciled country totals", () => {
  const unsorted = structuredClone(document)
  unsorted.countries.reverse()
  assert.throws(() => assertCountryTotalsDocument(unsorted))

  const unreconciled = structuredClone(document)
  unreconciled.totalCubers = 5
  assert.throws(() => assertCountryTotalsDocument(unreconciled))
})

test("formats continent labels", () => {
  assert.equal(continentLabel("_North_America"), "North America")
  assert.equal(continentLabel("_South_America"), "South America")
})

test("converts ISO2 to regional flag emoji", () => {
  assert.equal(flagEmoji("IN"), String.fromCodePoint(0x1f1ee, 0x1f1f3))
  assert.equal(flagEmoji("bad"), "")
})
