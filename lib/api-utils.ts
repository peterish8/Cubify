import { fetchWcaPerson, fetchWcaPersonSolveActivity, type WcaPerson } from "@/lib/wca-person"
import { wcaFetch } from "@/lib/wca-client"
import { cached } from "@/lib/wca-cache"
import { noteCacheResult } from "@/lib/request-context"

const WCA_API = "https://www.worldcubeassociation.org/api/v0"
const WCA_ID = /^\d{4}[A-Z]{4}\d{2}$/
const SOURCE_TIMEOUT_MS = 12_000

// Registrations change up to competition day; keep this short. Competition
// metadata, user-id -> wcaId mappings, and competitor PBs change rarely, so
// they can be cached far longer and safely served stale on a WCA outage.
const REGISTRATIONS_TTL_MS = 5 * 60_000
const COMPETITION_TTL_MS = 15 * 60_000
const USER_TTL_MS = 6 * 60 * 60_000
const PERSON_TTL_MS = 6 * 60 * 60_000
const STALE_WINDOW_MS = 24 * 60 * 60_000

export type ApiErrorCode =
  | "invalid_request"
  | "not_found"
  | "upstream_unavailable"
  | "upstream_timeout"
  | "upstream_invalid"
  | "internal_error"

export type UpstreamInfo = { service: string; status: number | null; endpoint: string; durationMs: number }

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: ApiErrorCode,
    readonly upstream?: UpstreamInfo,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export function requestId() {
  return `req_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

export function apiError(message: string, status = 400, code: ApiErrorCode = status >= 500 ? "internal_error" : "invalid_request", headers?: HeadersInit, upstream?: UpstreamInfo) {
  return Response.json({ error: { code, message, status, requestId: requestId(), ...(upstream ? { upstream } : {}) } }, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      Vary: "Origin",
      ...headers,
    },
  })
}

export function apiFailure(error: unknown, fallback: string) {
  if (error instanceof ApiError) return apiError(error.message, error.status, error.code, undefined, error.upstream)
  if (error instanceof SyntaxError) return apiError("Request body must be valid JSON", 400, "invalid_request")
  return apiError(fallback, 502, "upstream_unavailable")
}

export function apiJson<T>(payload: T, init: ResponseInit = {}) {
  const headers = new Headers(init.headers)
  headers.set("Access-Control-Allow-Origin", "*")
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  headers.set("Access-Control-Allow-Headers", "Content-Type")
  headers.set("Vary", "Origin")
  return Response.json(payload, { ...init, headers })
}

export function apiOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "600",
      Vary: "Origin",
    },
  })
}

export function wcaId(value: unknown) {
  const id = typeof value === "string" ? value.trim().toUpperCase() : ""
  if (!WCA_ID.test(id)) throw new ApiError("wcaId must be a valid WCA ID, for example 2022RPRA01", 400, "invalid_request")
  return id
}

export async function competitor(id: string, withActivity = false, options: { ttlMs?: number; staleMs?: number } = {}) {
  const ttlMs = options.ttlMs ?? PERSON_TTL_MS
  const staleMs = options.staleMs ?? STALE_WINDOW_MS
  try {
    const result = await cached(`wca:person:${id}:${withActivity}`, ttlMs, staleMs, async () => {
      const person = await withSourceTimeout((signal) => fetchWcaPerson(id, signal), `/persons/${id}`)
      const activity = withActivity
        ? await withSourceTimeout((signal) => fetchWcaPersonSolveActivity(id, signal), `/persons/${id}/results`).catch(() => null)
        : null
      return { ...person, activity }
    })
    noteCacheResult(result.stale, result.cachedAt)
    return result.value
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (error instanceof Error && /^Player .* not found\./.test(error.message)) {
      throw new ApiError(error.message, 404, "not_found")
    }
    throw new ApiError("WCA competitor data is temporarily unavailable", 502, "upstream_unavailable", { service: "wca", status: null, endpoint: `/persons/${id}`, durationMs: 0 })
  }
}

export function publicPerson(person: WcaPerson & { activity?: unknown }) {
  return {
    wcaId: person.wca_id,
    name: person.name,
    country: person.country,
    continent: person.continent,
    personalRecords: person.personal_records,
    competitionCount: person.competitionCount ?? null,
    totalSolves: person.totalSolves ?? null,
    activity: person.activity ?? null,
  }
}

/** TTL presets for the WCA resources wcaJson is called with; see call sites. */
export const wcaTtl = {
  competition: { ttlMs: COMPETITION_TTL_MS, staleMs: STALE_WINDOW_MS },
  registrations: { ttlMs: REGISTRATIONS_TTL_MS, staleMs: STALE_WINDOW_MS },
  events: { ttlMs: COMPETITION_TTL_MS, staleMs: STALE_WINDOW_MS },
  user: { ttlMs: USER_TTL_MS, staleMs: STALE_WINDOW_MS },
}

export async function wcaJson<T>(path: string, options: { ttlMs?: number; staleMs?: number } = {}): Promise<T> {
  const ttlMs = options.ttlMs ?? COMPETITION_TTL_MS
  const staleMs = options.staleMs ?? STALE_WINDOW_MS
  try {
    const result = await cached(`wca:${path}`, ttlMs, staleMs, () => fetchWcaJson<T>(path))
    noteCacheResult(result.stale, result.cachedAt)
    return result.value
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError("The WCA data source is temporarily unavailable", 502, "upstream_unavailable", { service: "wca", status: null, endpoint: path, durationMs: 0 })
  }
}

async function fetchWcaJson<T>(path: string): Promise<T> {
  const start = Date.now()
  return await withSourceTimeout(async (signal) => {
    const response = await wcaFetch(`${WCA_API}${path}`, { signal, retries: 2 })
    const durationMs = Date.now() - start
    if (response.status === 404) throw new ApiError("The requested WCA resource was not found", 404, "not_found", { service: "wca", status: 404, endpoint: path, durationMs })
    if (!response.ok) throw new ApiError("The WCA data source is temporarily unavailable", 502, "upstream_unavailable", { service: "wca", status: response.status, endpoint: path, durationMs })
    try {
      return await response.json() as T
    } catch {
      throw new ApiError("The WCA data source returned an invalid response", 502, "upstream_invalid", { service: "wca", status: response.status, endpoint: path, durationMs })
    }
  }, path)
}

async function withSourceTimeout<T>(task: (signal: AbortSignal) => Promise<T>, endpoint = "unknown") {
  const start = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SOURCE_TIMEOUT_MS)
  try {
    return await task(controller.signal)
  } catch (error) {
    if (controller.signal.aborted) throw new ApiError("The WCA data source timed out", 504, "upstream_timeout", { service: "wca", status: null, endpoint, durationMs: Date.now() - start })
    throw error
  } finally {
    clearTimeout(timer)
  }
}

export async function parallelMap<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>) {
  if (!Number.isInteger(limit) || limit < 1) throw new ApiError("Concurrency limit must be a positive integer", 500, "internal_error")
  const output: R[] = []
  let cursor = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      output[index] = await task(items[index])
    }
  }))
  return output
}

export function compareProfiles(a: WcaPerson, b: WcaPerson) {
  const eventIds = [...new Set([...Object.keys(a.personal_records), ...Object.keys(b.personal_records)])].sort()
  const score = { sharedEvents: { a: 0, b: 0 }, allEvents: { a: 0, b: 0 } }
  const events = eventIds.map((eventId) => {
    const left = a.personal_records[eventId]
    const right = b.personal_records[eventId]
    const slots: Array<"single" | "average"> = ["single", "average"]
    const wins = slots.map((slot) => {
      const ar = left?.[slot]?.world_ranking
      const br = right?.[slot]?.world_ranking
      const winner = typeof ar === "number" && typeof br === "number" ? ar === br ? null : ar < br ? "a" : "b" : typeof ar === "number" ? "a" : typeof br === "number" ? "b" : null
      if (winner) score.allEvents[winner] += 1
      if (winner && left && right) score.sharedEvents[winner] += 1
      return { type: slot, aWorldRank: ar ?? null, bWorldRank: br ?? null, winner }
    })
    return { eventId, shared: Boolean(left && right), slots: wins }
  })
  return { events, score }
}
