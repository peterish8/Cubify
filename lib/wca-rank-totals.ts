export const RANK_TOTALS_URL =
  "https://raw.githubusercontent.com/peterish8/Cubify/rank-data/data/rank-totals.json"

export type RankType = "single" | "average"

export interface RankBucket {
  world: number
  continents: Record<string, number>
  countries: Record<string, number>
}

export interface RankTotalsDocument {
  schemaVersion: 1
  source: {
    name: string
    exportDate: string
    exportFormatVersion: string
    archiveUrl: string
    url: string
    attribution: string
  }
  events: Record<string, Partial<Record<RankType, RankBucket>>>
}

export interface ScopedTotals {
  world: number | null
  continent: number | null
  country: number | null
}

const SOURCE_NAME = "World Cube Association Results Export"
const SOURCE_URL = "https://www.worldcubeassociation.org/export/results"

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0
}

function isRankBucket(value: unknown): value is RankBucket {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const bucket = value as Partial<RankBucket>
  if (!isPositiveInteger(bucket.world)) return false
  for (const scope of [bucket.continents, bucket.countries]) {
    if (!scope || typeof scope !== "object" || Array.isArray(scope) || Object.keys(scope).length === 0) return false
    if (!Object.entries(scope).every(([key, count]) => key.length > 0 && isPositiveInteger(count))) return false
    if (Object.values(scope).reduce((sum, count) => sum + count, 0) !== bucket.world) return false
  }
  return true
}

export function assertRankTotalsDocument(value: unknown): asserts value is RankTotalsDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid rank totals document")
  }
  const document = value as Partial<RankTotalsDocument>
  if (document.schemaVersion !== 1) throw new Error("Unsupported rank totals schema")
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
    throw new Error("Rank totals source metadata is invalid")
  }
  if (!document.events || typeof document.events !== "object" || Array.isArray(document.events)) {
    throw new Error("Rank totals events are missing")
  }
  const entries = Object.entries(document.events)
  if (entries.length === 0) throw new Error("Rank totals events are empty")
  for (const [eventId, event] of entries) {
    if (!eventId || !event || typeof event !== "object" || Array.isArray(event)) {
      throw new Error("Rank totals event is invalid")
    }
    const rankEntries = Object.entries(event)
    if (
      rankEntries.length === 0 ||
      !rankEntries.every(([rankType, bucket]) =>
        (rankType === "single" || rankType === "average") && isRankBucket(bucket),
      )
    ) {
      throw new Error(`Rank totals event ${eventId} is invalid`)
    }
  }
}

export async function fetchRankTotals(signal?: AbortSignal): Promise<RankTotalsDocument> {
  const response = await fetch(RANK_TOTALS_URL, { signal, cache: "no-store" })
  if (!response.ok) throw new Error(`Rank totals request failed with ${response.status}`)
  const document: unknown = await response.json()
  assertRankTotalsDocument(document)
  return document
}

export function getScopedTotals(
  document: RankTotalsDocument,
  eventId: string,
  rankType: RankType,
  continentId: string,
  countryIso2: string,
): ScopedTotals {
  const bucket = document.events[eventId]?.[rankType]
  if (!bucket) return { world: null, continent: null, country: null }
  return {
    world: isPositiveInteger(bucket.world) ? bucket.world : null,
    continent: isPositiveInteger(bucket.continents[continentId]) ? bucket.continents[continentId] : null,
    country: isPositiveInteger(bucket.countries[countryIso2.toUpperCase()])
      ? bucket.countries[countryIso2.toUpperCase()]
      : null,
  }
}

export function calculateTopPercent(rank: number, total: number | null): number | null {
  if (!isPositiveInteger(rank) || !isPositiveInteger(total) || rank > total) return null
  return (rank / total) * 100
}

function trimZeros(value: string): string {
  return value.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1")
}

export function formatTopPercent(value: number | null): string | null {
  if (value === null) return null
  if (value < 0.1) return "Top <0.1%"
  const digits = value < 1 ? 2 : 1
  return `Top ${trimZeros(value.toFixed(digits))}%`
}
