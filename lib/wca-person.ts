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
  }
}
