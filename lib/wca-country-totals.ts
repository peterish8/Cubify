export const COUNTRY_TOTALS_URL =
  "https://raw.githubusercontent.com/peterish8/Cubify/rank-data/data/country-totals.json"

export interface CountryTotal {
  iso2: string
  name: string
  continentId: string
  cubers: number
}

export interface CountryTotalsDocument {
  schemaVersion: 1
  source: {
    name: string
    exportDate: string
    exportFormatVersion: string
    archiveUrl: string
    url: string
    attribution: string
  }
  totalCubers: number
  countries: CountryTotal[]
}

const SOURCE_NAME = "World Cube Association Results Export"
const SOURCE_URL = "https://www.worldcubeassociation.org/export/results"

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0
}

export function assertCountryTotalsDocument(value: unknown): asserts value is CountryTotalsDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid country totals document")
  }
  const document = value as Partial<CountryTotalsDocument>
  if (document.schemaVersion !== 1) throw new Error("Unsupported country totals schema")
  const source = document.source
  if (
    !source ||
    source.name !== SOURCE_NAME ||
    source.url !== SOURCE_URL ||
    typeof source.exportDate !== "string" ||
    !source.exportDate ||
    typeof source.exportFormatVersion !== "string" ||
    !source.exportFormatVersion.startsWith("2.") ||
    typeof source.archiveUrl !== "string" ||
    !source.archiveUrl.startsWith("https://") ||
    typeof source.attribution !== "string" ||
    !source.attribution
  ) {
    throw new Error("Country totals source metadata is invalid")
  }
  if (!isPositiveInteger(document.totalCubers)) throw new Error("Invalid total cubers")
  if (!Array.isArray(document.countries) || document.countries.length === 0) {
    throw new Error("Country totals list is empty")
  }
  let running = 0
  let previous = Infinity
  for (const entry of document.countries) {
    if (!entry || typeof entry !== "object") throw new Error("Invalid country entry")
    const { iso2, name, continentId, cubers } = entry as Partial<CountryTotal>
    if (typeof iso2 !== "string" || !/^[A-Z]{2}$/.test(iso2)) throw new Error("Invalid country iso2")
    if (typeof name !== "string" || !name) throw new Error("Invalid country name")
    if (typeof continentId !== "string" || !continentId.startsWith("_")) throw new Error("Invalid continent")
    if (!isPositiveInteger(cubers) || cubers > previous) throw new Error("Countries must be sorted descending")
    previous = cubers
    running += cubers
  }
  if (running !== document.totalCubers) throw new Error("Country totals do not reconcile")
}

export async function fetchCountryTotals(signal?: AbortSignal): Promise<CountryTotalsDocument> {
  const response = await fetch(COUNTRY_TOTALS_URL, { signal, cache: "no-store" })
  if (!response.ok) throw new Error(`Country totals request failed with ${response.status}`)
  const document: unknown = await response.json()
  assertCountryTotalsDocument(document)
  return document
}

/** ISO2 country code to flag emoji using regional-indicator code points. */
export function flagEmoji(iso2: string): string {
  if (!/^[A-Za-z]{2}$/.test(iso2)) return ""
  const base = 0x1f1e6
  const code = iso2
    .toUpperCase()
    .split("")
    .map((c) => base + (c.charCodeAt(0) - 65))
  return String.fromCodePoint(...code)
}

export const CONTINENT_LABELS: Record<string, string> = {
  _Africa: "Africa",
  _Asia: "Asia",
  _Europe: "Europe",
  _North_America: "North America",
  "_North America": "North America",
  _Oceania: "Oceania",
  _South_America: "South America",
  "_South America": "South America",
}

export function continentLabel(continentId: string): string {
  return CONTINENT_LABELS[continentId] ?? continentId.replace(/^_/, "").replace(/_/g, " ")
}
