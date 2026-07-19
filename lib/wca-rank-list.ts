import {
  calculateTopPercent,
  type RankTotalsDocument,
  type RankType,
  getScopedTotals,
} from "@/lib/wca-rank-totals"

export const RANK_LISTS_BASE_URL =
  "https://raw.githubusercontent.com/peterish8/Cubify/rank-data/data/rank-lists"

export type RankScope = "nr" | "cr" | "wr"

export interface RankListSource {
  name: string
  exportDate: string
  exportFormatVersion: string
  archiveUrl: string
  url: string
  attribution: string
}

export interface RankListDocument {
  schemaVersion: 1
  eventId: string
  rankType: RankType
  encoding: "delta-i32+u16+u8-b64"
  source: RankListSource
  count: number
  countries: string[]
  continents: string[]
  bestsB64: string
  countryIdxB64: string
  continentIdxB64: string
}

/** Decoded in-memory shard ready for binary search. */
export interface RankListIndex {
  eventId: string
  rankType: RankType
  source: RankListSource
  count: number
  bests: Int32Array
  /** country iso2 per row */
  countryIso2: string[]
  /** continent id per row */
  continentId: string[]
  /** Lazy NR/CR filtered caches keyed by region code */
  _scopeCache?: Map<string, Int32Array>
}

export interface ScopeRankResult {
  rank: number
  total: number | null
  topPercent: number | null
  tiesWith: number
}

export interface AllScopeRanks {
  nr: ScopeRankResult
  cr: ScopeRankResult
  wr: ScopeRankResult
}

const SOURCE_NAME = "World Cube Association Results Export"
const SOURCE_URL = "https://www.worldcubeassociation.org/export/results"
const ENCODING = "delta-i32+u16+u8-b64"

const memoryCache = new Map<string, RankListIndex>()

function isPlainPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0
}

function isPlainNonNegInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
}

function base64ToBytes(b64: string): Uint8Array {
  // Prefer browser-native decoder so the client bundle never depends on Node Buffer.
  if (typeof globalThis.atob === "function") {
    const bin = globalThis.atob(b64)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  }
  // Node / tsx tests only
  const NodeBuffer = (globalThis as { Buffer?: { from(data: string, enc: string): Uint8Array } }).Buffer
  if (NodeBuffer) return Uint8Array.from(NodeBuffer.from(b64, "base64"))
  throw new Error("No base64 decoder available")
}

function unpackI32Deltas(b64: string, count: number): Int32Array {
  if (count === 0) {
    if (b64) throw new Error("unexpected bests payload")
    return new Int32Array(0)
  }
  const bytes = base64ToBytes(b64)
  if (bytes.byteLength !== count * 4) throw new Error("bests payload length mismatch")
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const bests = new Int32Array(count)
  let acc = 0
  for (let i = 0; i < count; i++) {
    acc += view.getInt32(i * 4, true)
    bests[i] = acc
  }
  return bests
}

function unpackU16(b64: string, count: number): Uint16Array {
  if (count === 0) {
    if (b64) throw new Error("unexpected country payload")
    return new Uint16Array(0)
  }
  const bytes = base64ToBytes(b64)
  if (bytes.byteLength !== count * 2) throw new Error("country payload length mismatch")
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const out = new Uint16Array(count)
  for (let i = 0; i < count; i++) out[i] = view.getUint16(i * 2, true)
  return out
}

function unpackU8(b64: string, count: number): Uint8Array {
  if (count === 0) {
    if (b64) throw new Error("unexpected continent payload")
    return new Uint8Array(0)
  }
  const bytes = base64ToBytes(b64)
  if (bytes.byteLength !== count) throw new Error("continent payload length mismatch")
  return bytes
}

export function assertRankListDocument(value: unknown): asserts value is RankListDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid rank list document")
  }
  const doc = value as Partial<RankListDocument>
  if (doc.schemaVersion !== 1) throw new Error("Unsupported rank list schema")
  if (doc.encoding !== ENCODING) throw new Error("Unsupported rank list encoding")
  if (typeof doc.eventId !== "string" || !doc.eventId) throw new Error("Invalid event id")
  if (doc.rankType !== "single" && doc.rankType !== "average") throw new Error("Invalid rank type")
  if (!isPlainNonNegInt(doc.count)) throw new Error("Invalid count")
  const source = doc.source
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
    throw new Error("Rank list source metadata is invalid")
  }
  if (!Array.isArray(doc.countries) || !Array.isArray(doc.continents)) {
    throw new Error("Missing region tables")
  }
  if (doc.count > 0 && (doc.countries.length === 0 || doc.continents.length === 0)) {
    throw new Error("Empty region tables")
  }
  for (const iso2 of doc.countries) {
    if (typeof iso2 !== "string" || !/^[A-Z]{2}$/.test(iso2)) throw new Error("Invalid country code")
  }
  for (const continentId of doc.continents) {
    if (typeof continentId !== "string" || !continentId.startsWith("_")) {
      throw new Error("Invalid continent id")
    }
  }
  if (
    typeof doc.bestsB64 !== "string" ||
    typeof doc.countryIdxB64 !== "string" ||
    typeof doc.continentIdxB64 !== "string"
  ) {
    throw new Error("Missing packed payloads")
  }

  // Structural decode check (also validates sorted bests)
  const bests = unpackI32Deltas(doc.bestsB64, doc.count)
  const countryIdx = unpackU16(doc.countryIdxB64, doc.count)
  const continentIdx = unpackU8(doc.continentIdxB64, doc.count)
  let previous = 0
  for (let i = 0; i < doc.count; i++) {
    const best = bests[i]
    if (!isPlainPositiveInt(best)) throw new Error("Non-positive best in list")
    if (i > 0 && best < previous) throw new Error("Bests must be non-decreasing")
    previous = best
    if (countryIdx[i] >= doc.countries.length) throw new Error("Country index out of range")
    if (continentIdx[i] >= doc.continents.length) throw new Error("Continent index out of range")
  }
}

export function decodeRankListDocument(doc: RankListDocument): RankListIndex {
  assertRankListDocument(doc)
  const bests = unpackI32Deltas(doc.bestsB64, doc.count)
  const countryIdx = unpackU16(doc.countryIdxB64, doc.count)
  const continentIdx = unpackU8(doc.continentIdxB64, doc.count)
  const countryIso2 = new Array<string>(doc.count)
  const continentId = new Array<string>(doc.count)
  for (let i = 0; i < doc.count; i++) {
    countryIso2[i] = doc.countries[countryIdx[i]]
    continentId[i] = doc.continents[continentIdx[i]]
  }
  return {
    eventId: doc.eventId,
    rankType: doc.rankType,
    source: doc.source,
    count: doc.count,
    bests,
    countryIso2,
    continentId,
  }
}

export function rankListUrl(eventId: string, rankType: RankType): string {
  return `${RANK_LISTS_BASE_URL}/${encodeURIComponent(eventId)}/${rankType}.json`
}

export async function fetchRankList(
  eventId: string,
  rankType: RankType,
  signal?: AbortSignal,
): Promise<RankListIndex> {
  const cacheKey = `${eventId}/${rankType}`
  const cached = memoryCache.get(cacheKey)
  if (cached) return cached

  const response = await fetch(rankListUrl(eventId, rankType), {
    signal,
    // Avoid sticky 404s / stale shards while rank-data is refreshed.
    cache: "no-store",
  })
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        "Rank list not published yet (404). Run the WCA generator / GitHub Action so rank-data includes data/rank-lists/.",
      )
    }
    throw new Error(`Rank list request failed with ${response.status}`)
  }
  const document: unknown = await response.json()
  assertRankListDocument(document)
  const index = decodeRankListDocument(document)
  memoryCache.set(cacheKey, index)
  // Intentionally skip sessionStorage: large events (e.g. 333 single ~2.5MB) blow quota.
  return index
}

/** Warm the in-memory cache for nearby events (idle-time). */
export function prefetchRankLists(
  pairs: Array<{ eventId: string; rankType: RankType }>,
): void {
  if (typeof window === "undefined") return
  const run = () => {
    for (const { eventId, rankType } of pairs) {
      const key = `${eventId}/${rankType}`
      if (memoryCache.has(key)) continue
      void fetchRankList(eventId, rankType).catch(() => {
        /* ignore prefetch failures */
      })
    }
  }
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(() => run(), { timeout: 4000 })
  } else {
    setTimeout(run, 800)
  }
}

/** Count of values in sorted ascending array that are strictly less than target. */
export function countStrictlyBetter(sortedBests: ArrayLike<number>, target: number): number {
  let lo = 0
  let hi = sortedBests.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (sortedBests[mid] < target) lo = mid + 1
    else hi = mid
  }
  return lo
}

/** Count of values equal to target in sorted ascending array. */
export function countEqual(sortedBests: ArrayLike<number>, target: number): number {
  const first = countStrictlyBetter(sortedBests, target)
  let lo = first
  let hi = sortedBests.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (sortedBests[mid] <= target) lo = mid + 1
    else hi = mid
  }
  return lo - first
}

/**
 * Rank after treating the multiset as: remove one copy of previousBest (if any), insert newBest.
 * Sorted ascending, lower is better. WCA-style rank = 1 + count(strictly better).
 */
export function rankAfterReplace(
  sortedBests: ArrayLike<number>,
  newBest: number,
  previousBest: number | null,
): { rank: number; tiesWith: number } {
  if (!isPlainPositiveInt(newBest)) return { rank: 0, tiesWith: 0 }

  let better = countStrictlyBetter(sortedBests, newBest)
  let equal = countEqual(sortedBests, newBest)

  if (previousBest !== null && isPlainPositiveInt(previousBest)) {
    // Remove one occurrence of previousBest from the multiset conceptually.
    if (previousBest < newBest) {
      better = Math.max(0, better - 1)
    } else if (previousBest === newBest) {
      equal = Math.max(0, equal - 1)
    }
  }

  // After insert, people equal to newBest (excluding self) is `equal` from the adjusted multiset.
  return { rank: better + 1, tiesWith: equal }
}

function filterBests(
  index: RankListIndex,
  predicate: (i: number) => boolean,
): Int32Array {
  const tmp: number[] = []
  for (let i = 0; i < index.count; i++) {
    if (predicate(i)) tmp.push(index.bests[i])
  }
  return Int32Array.from(tmp)
}

export function scopedBests(
  index: RankListIndex,
  scope: RankScope,
  countryIso2: string,
  continentId: string,
): Int32Array {
  if (scope === "wr") return index.bests
  const iso = countryIso2.toUpperCase()
  const key = scope === "nr" ? `nr:${iso}` : `cr:${continentId}`
  if (!index._scopeCache) index._scopeCache = new Map()
  const cached = index._scopeCache.get(key)
  if (cached) return cached
  const filtered =
    scope === "nr"
      ? filterBests(index, (i) => index.countryIso2[i] === iso)
      : filterBests(index, (i) => index.continentId[i] === continentId)
  index._scopeCache.set(key, filtered)
  return filtered
}

export function resultToScopeRank(
  index: RankListIndex,
  scope: RankScope,
  newBest: number,
  previousBest: number | null,
  countryIso2: string,
  continentId: string,
  total: number | null,
): ScopeRankResult {
  const bests = scopedBests(index, scope, countryIso2, continentId)
  // previousBest only adjusts if the previous PB was in the same multiset (always true for
  // official national/continental/world lists for a person from that country).
  const { rank, tiesWith } = rankAfterReplace(bests, newBest, previousBest)
  return {
    rank,
    total,
    topPercent: calculateTopPercent(rank, total),
    tiesWith,
  }
}

export function resultToAllScopeRanks(
  index: RankListIndex,
  newBest: number,
  previousBest: number | null,
  countryIso2: string,
  continentId: string,
  totalsDoc: RankTotalsDocument | null,
): AllScopeRanks {
  const scoped = totalsDoc
    ? getScopedTotals(totalsDoc, index.eventId, index.rankType, continentId, countryIso2)
    : { world: null, continent: null, country: null }

  return {
    nr: resultToScopeRank(
      index,
      "nr",
      newBest,
      previousBest,
      countryIso2,
      continentId,
      scoped.country,
    ),
    cr: resultToScopeRank(
      index,
      "cr",
      newBest,
      previousBest,
      countryIso2,
      continentId,
      scoped.continent,
    ),
    wr: resultToScopeRank(
      index,
      "wr",
      newBest,
      previousBest,
      countryIso2,
      continentId,
      scoped.world,
    ),
  }
}

/**
 * Best result needed to achieve 1-based rank R on the scoped list
 * (after removing previousBest if present).
 * Returns null if rank is out of range.
 */
export function rankToRequiredBest(
  sortedBests: ArrayLike<number>,
  targetRank: number,
  previousBest: number | null,
): number | null {
  if (!isPlainPositiveInt(targetRank)) return null

  // Build adjusted multiset mentally: remove one previousBest, then the list length is n or n-1.
  const n = sortedBests.length
  const hasPrev = previousBest !== null && isPlainPositiveInt(previousBest)
  // For target rank R we need requiredBest = value at position R-1 in the list of "others".
  // Approximate by scanning the sorted list while skipping one previousBest match.
  if (!hasPrev) {
    if (targetRank > n) return null
    if (targetRank === n + 1) {
      // worse than last — not a useful target; null
      return null
    }
    return sortedBests[targetRank - 1]
  }

  // Collect others' bests by skipping first matching previousBest
  let skipped = false
  let othersIndex = 0
  for (let i = 0; i < n; i++) {
    const value = sortedBests[i]
    if (!skipped && value === previousBest) {
      skipped = true
      continue
    }
    othersIndex += 1
    if (othersIndex === targetRank) return value
  }
  // Rank beyond list size (would be last if you enter with any finite result after last)
  if (targetRank === othersIndex + 1 && othersIndex >= 0) {
    // need worse than last other — return last other + epsilon isn't defined for discrete bests
    // return last other's best so "≤ that" still ties last; UI can say "rank at least N"
    return null
  }
  return null
}

export function percentToTargetRank(percent: number, total: number | null): number | null {
  if (!isPlainPositiveInt(total)) return null
  if (!Number.isFinite(percent) || percent <= 0 || percent > 100) return null
  return Math.max(1, Math.ceil((percent / 100) * total))
}

export function targetToRequiredBest(
  index: RankListIndex,
  scope: RankScope,
  mode: "rank" | "percent",
  value: number,
  previousBest: number | null,
  countryIso2: string,
  continentId: string,
  totalsDoc: RankTotalsDocument | null,
): { requiredBest: number | null; targetRank: number | null } {
  const scoped = totalsDoc
    ? getScopedTotals(totalsDoc, index.eventId, index.rankType, continentId, countryIso2)
    : { world: null, continent: null, country: null }
  const total =
    scope === "wr" ? scoped.world : scope === "cr" ? scoped.continent : scoped.country

  let targetRank: number | null
  if (mode === "rank") {
    targetRank = isPlainPositiveInt(value) ? value : null
  } else {
    targetRank = percentToTargetRank(value, total)
  }
  if (targetRank === null) return { requiredBest: null, targetRank: null }

  const bests = scopedBests(index, scope, countryIso2, continentId)
  const requiredBest = rankToRequiredBest(bests, targetRank, previousBest)
  return { requiredBest, targetRank }
}

/** Clear in-memory cache (tests). */
export function clearRankListCache(): void {
  memoryCache.clear()
}
