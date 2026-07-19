import {
  calculateTopPercent,
  type RankTotalsDocument,
  type RankType,
  getScopedTotals,
} from "@/lib/wca-rank-totals"
import {
  assertRankListDocument,
  decodeRankListDocument,
  isPlainPositiveInt,
  type RankListDocument,
  type RankListIndex,
} from "@/lib/wca-rank-list-codec"

// Re-export the codec's public surface so existing importers keep their paths.
export {
  assertRankListDocument,
  decodeRankListDocument,
} from "@/lib/wca-rank-list-codec"
export type {
  RankListDocument,
  RankListIndex,
  RankListSource,
} from "@/lib/wca-rank-list-codec"

export const RANK_LISTS_BASE_URL =
  "https://raw.githubusercontent.com/peterish8/Cubify/rank-data/data/rank-lists"

export type RankScope = "nr" | "cr" | "wr"

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

/**
 * In-memory decoded-shard cache with a TTL. rank-data refreshes ~daily, so a
 * cached shard is allowed to go stale for a few hours before we re-fetch,
 * instead of being held for the entire tab session (which showed stale ranks
 * until a hard reload).
 */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours
interface CacheEntry {
  index: RankListIndex
  storedAt: number
}
const memoryCache = new Map<string, CacheEntry>()

function getCachedIndex(key: string): RankListIndex | null {
  const entry = memoryCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.storedAt > CACHE_TTL_MS) {
    memoryCache.delete(key)
    return null
  }
  return entry.index
}

function setCachedIndex(key: string, index: RankListIndex): void {
  memoryCache.set(key, { index, storedAt: Date.now() })
}

// --- Off-main-thread decode -------------------------------------------------
// A single reusable worker decodes shards so the UI thread never unpacks a
// multi-MB payload. Falls back to synchronous decode when workers are
// unavailable (SSR, tests, older browsers, or worker init failure).

let decodeWorker: Worker | null = null
let workerUnavailable = false
let nextMessageId = 0
const pendingDecodes = new Map<
  number,
  { resolve: (index: RankListIndex) => void; reject: (err: Error) => void }
>()

function getDecodeWorker(): Worker | null {
  if (workerUnavailable) return null
  if (typeof window === "undefined" || typeof Worker === "undefined") return null
  if (decodeWorker) return decodeWorker
  try {
    decodeWorker = new Worker(new URL("./wca-rank-list.worker.ts", import.meta.url))
    decodeWorker.onmessage = (
      event: MessageEvent<
        | { id: number; ok: true; index: RankListIndex }
        | { id: number; ok: false; error: string }
      >,
    ) => {
      const data = event.data
      const pending = pendingDecodes.get(data.id)
      if (!pending) return
      pendingDecodes.delete(data.id)
      if (data.ok) pending.resolve(data.index)
      else pending.reject(new Error(data.error))
    }
    decodeWorker.onerror = () => {
      // Reject everything in flight; callers fall back to sync decode.
      for (const [, pending] of pendingDecodes) pending.reject(new Error("worker error"))
      pendingDecodes.clear()
      decodeWorker = null
      workerUnavailable = true
    }
    return decodeWorker
  } catch {
    workerUnavailable = true
    return null
  }
}

function decodeOnWorker(doc: RankListDocument): Promise<RankListIndex> {
  return new Promise((resolve, reject) => {
    const worker = getDecodeWorker()
    if (!worker) {
      reject(new Error("worker unavailable"))
      return
    }
    const id = nextMessageId++
    pendingDecodes.set(id, { resolve, reject })
    try {
      worker.postMessage({ id, doc })
    } catch (err) {
      pendingDecodes.delete(id)
      reject(err instanceof Error ? err : new Error("postMessage failed"))
    }
  })
}

async function decodeRankList(doc: unknown): Promise<RankListIndex> {
  try {
    // Worker decode runs the same full validation inside decodeRankListDocument.
    return await decodeOnWorker(doc as RankListDocument)
  } catch {
    // Fallback: validate + decode synchronously on the current thread. On an
    // invalid document this re-throws the real validation error to the caller.
    assertRankListDocument(doc)
    return decodeRankListDocument(doc)
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
  const cached = getCachedIndex(cacheKey)
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
  const index = await decodeRankList(document)
  setCachedIndex(cacheKey, index)
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
      if (getCachedIndex(key)) continue
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
    // Only remove a copy of previousBest if it is actually present in this scoped
    // multiset. If the person improved after the export snapshot (their WCA-API PB
    // is newer than the shard), previousBest won't be in the list and subtracting
    // would phantom-remove an unrelated competitor, making the rank one place too good.
    const prevInList = countEqual(sortedBests, previousBest) > 0
    if (prevInList) {
      if (previousBest < newBest) {
        better = Math.max(0, better - 1)
      } else if (previousBest === newBest) {
        equal = Math.max(0, equal - 1)
      }
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
