/** Shared WCA person lookup used by Lookup, Compare, and Goal. */

const WCA_PERSON_API = "https://www.worldcubeassociation.org/api/v0/persons"

export interface WcaPersonRecord {
  best: number
  world_ranking: number
  continental_ranking: number
  national_ranking: number
}

export interface WcaPerson {
  name: string
  country: {
    name: string
    /** Canonical ISO2, UPPERCASE (lowercase only at the flag <img> site). */
    iso2: string
    continentId: string
  }
  /** Continent id without the leading underscore, e.g. "Europe". */
  continent: string
  wca_id: string
  avatar?: { url: string }
  personal_records: Record<
    string,
    { single?: WcaPersonRecord; average?: WcaPersonRecord }
  >
  /** Total competitions attended (from person payload). */
  competitionCount?: number
  /** Lifetime solves across all events (from person payload). */
  totalSolves?: number
}

/** Per-event solve volume from personal results. */
export interface WcaEventSolveActivity {
  eventId: string
  /** Attempts that were taken (valid + DNF; excludes DNS / empty). */
  solves: number
  /** Distinct competitions with a result in this event. */
  competitions: number
}

export type WcaPersonResultRow = {
  event_id?: string
  competition_id?: string
  attempts?: number[]
}

function mapRecord(raw: any): WcaPersonRecord {
  return {
    best: raw.best,
    world_ranking: raw.world_rank,
    continental_ranking: raw.continent_rank,
    national_ranking: raw.country_rank,
  }
}

/**
 * Fetch and normalize a WCA competitor by ID.
 * Throws a user-facing Error on not-found / invalid payload.
 * Pass an AbortSignal so callers can cancel superseded requests.
 */
export async function fetchWcaPerson(
  wcaId: string,
  signal?: AbortSignal,
): Promise<WcaPerson> {
  const normalized = wcaId.trim().toUpperCase()
  if (!normalized) throw new Error("Please enter a WCA ID")

  const response = await fetch(`${WCA_PERSON_API}/${normalized}`, { signal })
  if (!response.ok) {
    throw new Error(`Player ${normalized} not found. Check the WCA ID and try again.`)
  }

  const payload = await response.json()
  const person = payload.person
  if (!person?.name) {
    throw new Error(`Invalid player data received for ${normalized}`)
  }

  const iso2 = (person.country?.iso2 || person.country_iso2 || "XX").toUpperCase()
  const continentId: string = person.country?.continent_id || ""

  const records: WcaPerson["personal_records"] = {}
  for (const [eventId, raw] of Object.entries(payload.personal_records || {}) as [
    string,
    any,
  ][]) {
    const entry: { single?: WcaPersonRecord; average?: WcaPersonRecord } = {}
    if (raw.single) entry.single = mapRecord(raw.single)
    if (raw.average) entry.average = mapRecord(raw.average)
    records[eventId] = entry
  }

  return {
    name: person.name,
    country: {
      name: person.country?.name || iso2,
      iso2,
      continentId,
    },
    continent: continentId.replace(/^_/, ""),
    wca_id: person.wca_id || person.id || normalized,
    avatar: person.avatar?.url ? { url: person.avatar.url } : undefined,
    personal_records: records,
    competitionCount:
      typeof payload.competition_count === "number" ? payload.competition_count : undefined,
    totalSolves: typeof payload.total_solves === "number" ? payload.total_solves : undefined,
  }
}

/**
 * Count taken attempts: valid times + DNF.
 * Skip unused slots (0) and DNS (-2). -1 (DNF) counts as a taken solve.
 */
export function countTakenAttempts(attempts: unknown): number {
  if (!Array.isArray(attempts)) return 0
  let n = 0
  for (const raw of attempts) {
    const a = Number(raw)
    if (!Number.isFinite(a)) continue
    if (a === 0 || a === -2) continue
    n += 1
  }
  return n
}

/** Pure aggregation — unit-tested; used by fetchWcaPersonSolveActivity. */
export function aggregateSolveActivity(rows: WcaPersonResultRow[]): {
  byEvent: WcaEventSolveActivity[]
  mostSolved: WcaEventSolveActivity | null
  totalSolves: number
  competitionCount: number
} {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { byEvent: [], mostSolved: null, totalSolves: 0, competitionCount: 0 }
  }

  const byId = new Map<string, { solves: number; comps: Set<string> }>()
  const allComps = new Set<string>()
  let totalSolves = 0

  for (const row of rows) {
    const eventId = row.event_id
    if (!eventId || typeof eventId !== "string") continue

    const solves = countTakenAttempts(row.attempts)
    totalSolves += solves
    if (row.competition_id) allComps.add(row.competition_id)

    let entry = byId.get(eventId)
    if (!entry) {
      entry = { solves: 0, comps: new Set() }
      byId.set(eventId, entry)
    }
    entry.solves += solves
    if (row.competition_id) entry.comps.add(row.competition_id)
  }

  const byEvent: WcaEventSolveActivity[] = [...byId.entries()]
    .map(([eventId, v]) => ({
      eventId,
      solves: v.solves,
      competitions: v.comps.size,
    }))
    .filter((e) => e.solves > 0 || e.competitions > 0)
    .sort((a, b) => {
      if (b.solves !== a.solves) return b.solves - a.solves
      if (b.competitions !== a.competitions) return b.competitions - a.competitions
      return a.eventId.localeCompare(b.eventId)
    })

  return {
    byEvent,
    mostSolved: byEvent[0] ?? null,
    totalSolves,
    competitionCount: allComps.size,
  }
}

/**
 * Aggregate solve volume per event from /persons/:id/results.
 * One request; pure aggregation in-memory.
 */
export async function fetchWcaPersonSolveActivity(
  wcaId: string,
  signal?: AbortSignal,
): Promise<{
  byEvent: WcaEventSolveActivity[]
  mostSolved: WcaEventSolveActivity | null
  totalSolves: number
  competitionCount: number
}> {
  const normalized = wcaId.trim().toUpperCase()
  if (!normalized) throw new Error("Please enter a WCA ID")

  const response = await fetch(`${WCA_PERSON_API}/${normalized}/results`, { signal })
  if (!response.ok) {
    throw new Error(`Could not load results for ${normalized}`)
  }

  const rows = (await response.json()) as WcaPersonResultRow[]
  return aggregateSolveActivity(rows)
}
