/**
 * In-memory TTL cache with stale-while-revalidate for WCA upstream lookups.
 *
 * The competition-report endpoints fan out dozens of individual WCA API
 * calls per request (one per registrant). WCA's public API is slow and
 * occasionally flaky, so repeating that fan-out on every request is what
 * turns "slow" into "times out" or "rate limited". Caching the same
 * competition/person/user lookups across requests on a warm instance is
 * the single highest-leverage fix.
 */

type Entry<T> = { value: T; cachedAt: number; freshUntil: number; staleUntil: number }

const store = new Map<string, Entry<unknown>>()

export type CacheResult<T> = { value: T; stale: boolean; cachedAt: number }

/**
 * Returns a cached value if still fresh. If stale or missing, calls
 * `fetcher`; on fetcher failure, falls back to a stale-but-not-expired
 * entry rather than failing the whole request.
 */
export async function cached<T>(key: string, ttlMs: number, staleMs: number, fetcher: () => Promise<T>): Promise<CacheResult<T>> {
  const now = Date.now()
  const entry = store.get(key) as Entry<T> | undefined
  if (entry && entry.freshUntil > now) return { value: entry.value, stale: false, cachedAt: entry.cachedAt }
  try {
    const value = await fetcher()
    store.set(key, { value, cachedAt: now, freshUntil: now + ttlMs, staleUntil: now + ttlMs + staleMs })
    return { value, stale: false, cachedAt: now }
  } catch (error) {
    if (entry && entry.staleUntil > now) return { value: entry.value, stale: true, cachedAt: entry.cachedAt }
    throw error
  }
}

/** Test-only: clears all entries so fixtures in one test can't leak into another. */
export function resetWcaCache() {
  store.clear()
}
