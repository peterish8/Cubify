import { ApiError } from "@/lib/api-utils"

export type PersonalBests = { single: number | null; average: number | null }

export function competitionId(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) throw new ApiError("competitionUrl is required", 400, "invalid_request")
  if (value.length > 500) throw new ApiError("competitionUrl is too long", 400, "invalid_request")
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new ApiError("competitionUrl must be a valid HTTPS URL", 400, "invalid_request")
  }
  const hostname = url.hostname.toLowerCase()
  if (url.protocol !== "https:" || !["www.worldcubeassociation.org", "worldcubeassociation.org"].includes(hostname) || url.username || url.password || url.port) throw new ApiError("competitionUrl must be an official World Cube Association HTTPS URL", 400, "invalid_request")
  const match = url.pathname.match(/^\/competitions\/([A-Za-z0-9]+)(?:\/registrations)?\/?$/)
  if (!match) throw new ApiError("competitionUrl must point to a WCA competition or registrations page", 400, "invalid_request")
  return match[1]
}

export function fieldStanding(best: number | null, values: Array<number | null>) {
  const known = values.filter((value): value is number => value !== null)
  if (best === null) return { position: null, ties: 0, knownCompetitors: known.length, fieldPercentile: null }
  const position = known.filter((value) => value < best).length + 1
  return { position, ties: known.filter((value) => value === best).length, knownCompetitors: known.length, fieldPercentile: known.length ? Number(((position / known.length) * 100).toFixed(2)) : null }
}

export function comparePbs(yours: number | null, theirs: number | null) {
  if (yours === null || theirs === null) return { yours, theirs, result: "unknown" as const, difference: null }
  return { yours, theirs, result: yours === theirs ? "tie" as const : yours < theirs ? "you" as const : "opponent" as const, difference: yours - theirs }
}

type Standing = ReturnType<typeof fieldStanding>

export function strongestTheoreticalEvent(events: Array<{ eventId: string; myStanding: { single: Standing; average: Standing } }>, kind: keyof PersonalBests) {
  const candidates = events.map((event) => ({ eventId: event.eventId, ...event.myStanding[kind] })).filter((event) => event.position !== null && event.fieldPercentile !== null)
  candidates.sort((a, b) => a.fieldPercentile! - b.fieldPercentile! || a.position! - b.position!)
  const best = candidates[0]
  return best ? { ...best, basis: kind, interpretation: "PB-only standing among competitors with known official results" } : null
}
