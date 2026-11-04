/** Shared low-level HTTP layer for talking to the WCA public API. */

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504])

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function backoffDelayMs(attempt: number) {
  const base = 300 * 2 ** attempt
  return base + Math.random() * base * 0.5
}

/**
 * Fetches a URL, retrying on 429/5xx and on network errors (never on an
 * AbortError from the caller's own deadline). Honors `Retry-After` on 429.
 * Default of 2 retries (3 attempts total) matches the "max 2-3 attempts"
 * requirement for upstream resilience.
 */
export async function wcaFetch(url: string, opts: { signal?: AbortSignal; retries?: number } = {}): Promise<Response> {
  const retries = opts.retries ?? 2
  let attempt = 0
  let lastError: unknown
  while (attempt <= retries) {
    try {
      const response = await fetch(url, { signal: opts.signal, next: { revalidate: 900 } })
      if (RETRYABLE_STATUSES.has(response.status) && attempt < retries) {
        const retryAfterHeader = Number(response.headers.get("retry-after"))
        const delay = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0 ? retryAfterHeader * 1000 : backoffDelayMs(attempt)
        await sleep(delay)
        attempt += 1
        continue
      }
      return response
    } catch (error) {
      if (opts.signal?.aborted || attempt >= retries) throw error
      lastError = error
      await sleep(backoffDelayMs(attempt))
      attempt += 1
    }
  }
  throw lastError instanceof Error ? lastError : new Error("WCA request failed")
}

export class DeadlineExceededError extends Error {
  constructor(public readonly deadlineMs: number) {
    super(`Exceeded the ${deadlineMs}ms overall deadline`)
  }
}

/**
 * Races `promise` against an overall deadline. Resolves/rejects with
 * whichever settles first; a slow `promise` that loses the race keeps
 * running in the background (its own per-call timeouts will eventually end
 * it) but can never make the response itself hang past `deadlineMs`.
 */
export function withDeadline<T>(promise: Promise<T>, deadlineMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new DeadlineExceededError(deadlineMs)), deadlineMs)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}
