import { AsyncLocalStorage } from "node:async_hooks"

/**
 * Per-request accumulator for cache staleness and partial-failure counts.
 * Scoped with AsyncLocalStorage (not a module-level mutable) because a warm
 * serverless instance can interleave concurrent requests.
 */
export type ReportRunContext = {
  stale: boolean
  oldestCachedAt: number
  failedLookups: number
}

const als = new AsyncLocalStorage<ReportRunContext>()

export async function withReportContext<T>(fn: () => Promise<T>): Promise<{ result: T; context: ReportRunContext }> {
  const context: ReportRunContext = { stale: false, oldestCachedAt: Date.now(), failedLookups: 0 }
  const result = await als.run(context, fn)
  return { result, context }
}

export function noteCacheResult(stale: boolean, cachedAt: number) {
  const context = als.getStore()
  if (!context) return
  if (stale) context.stale = true
  if (cachedAt < context.oldestCachedAt) context.oldestCachedAt = cachedAt
}

export function noteLookupFailure() {
  const context = als.getStore()
  if (context) context.failedLookups += 1
}
