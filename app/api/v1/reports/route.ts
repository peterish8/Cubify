import { apiFailure, apiJson, apiOptions, ApiError, parallelMap, wcaJson, competitor, wcaId } from "@/lib/api-utils"
import { comparePbs, competitionId, fieldStanding, strongestTheoreticalEvent, type PersonalBests } from "@/lib/report-utils"

type Registration = { user_id: number; event_ids: string[] }
type WcaUserResponse = { user: { wca_id: string | null; name: string; gender: "m" | "f" | "o" | null; country_iso2: string } }
type Competition = { id: string; name: string; start_date: string; end_date: string; city: string; event_ids: string[]; url: string }
type ReportRequest = { competitionUrl?: unknown; eventIds?: unknown; competitorWcaId?: unknown }
function personalBests(person: Awaited<ReturnType<typeof competitor>> | null, eventId: string): PersonalBests {
  const record = person?.personal_records[eventId]
  return { single: record?.single?.best ?? null, average: record?.average?.best ?? null }
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json()
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new ApiError("Request body must be a JSON object", 400, "invalid_request")
    const input = body as ReportRequest
    const id = competitionId(input.competitionUrl)
    if (input.eventIds !== undefined && !Array.isArray(input.eventIds)) throw new ApiError("eventIds must be an array of event IDs", 400, "invalid_request")
    const rawEvents = Array.isArray(input.eventIds) ? input.eventIds : []
    if (rawEvents.length > 25 || rawEvents.some((event) => typeof event !== "string" || !/^[a-z0-9]+$/i.test(event.trim()) || event.trim().length > 12)) throw new ApiError("eventIds must contain at most 25 valid event IDs", 400, "invalid_request")
    const selectedEvents: string[] = rawEvents.map((event) => (event as string).trim().toLowerCase())
    const me = input.competitorWcaId === undefined || input.competitorWcaId === null || input.competitorWcaId === "" ? null : wcaId(input.competitorWcaId)
    const [competition, registrations] = await Promise.all([
      wcaJson<Competition>(`/competitions/${id}`),
      wcaJson<Registration[]>(`/competitions/${id}/registrations`),
    ])
    if (!competition || typeof competition !== "object" || typeof competition.id !== "string" || typeof competition.name !== "string" || !Array.isArray(competition.event_ids) || !competition.event_ids.every((event) => typeof event === "string")) throw new ApiError("The WCA competition response was invalid", 502, "upstream_invalid")
    if (!Array.isArray(registrations) || registrations.length > 5000 || registrations.some((registration) => !registration || typeof registration.user_id !== "number" || !Number.isSafeInteger(registration.user_id) || registration.user_id <= 0 || !Array.isArray(registration.event_ids) || !registration.event_ids.every((event) => typeof event === "string"))) throw new ApiError("The WCA registrations response was invalid", 502, "upstream_invalid")
    const requestedEvents: string[] = selectedEvents.length ? selectedEvents.filter((event) => competition.event_ids.includes(event)) : competition.event_ids
    if (!requestedEvents.length) throw new ApiError("No requested events are offered at this competition", 400, "invalid_request")

    const users = await parallelMap(registrations, 8, async (registration) => {
      const data = await wcaJson<WcaUserResponse>(`/users/${registration.user_id}`)
      return { ...data.user, eventIds: registration.event_ids }
    })
    const people = await parallelMap(users, 6, async (user) => ({ user, person: user.wca_id ? await competitor(user.wca_id).catch(() => null) : null }))
    const mine = me ? people.find(({ user }) => user.wca_id === me) ?? null : null
    if (me && !mine) throw new ApiError("competitorWcaId is not an accepted registration for this competition", 400, "invalid_request")
    const events = mine ? requestedEvents.filter((eventId) => mine.user.eventIds.includes(eventId)) : requestedEvents
    if (me && !events.length) throw new ApiError("None of the requested events are shared with your accepted registration", 400, "invalid_request")

    const byEvent = events.map((eventId) => {
      const competitors = people.filter(({ user }) => user.eventIds.includes(eventId)).map(({ user, person }) => {
        const bests = personalBests(person, eventId)
        return { wcaId: user.wca_id, name: user.name, gender: user.gender, countryIso2: user.country_iso2, firstTime: !user.wca_id, personalBests: bests }
      })
      const mineInEvent = me ? competitors.find((entry) => entry.wcaId === me) ?? null : null
      const singleValues = competitors.map((entry) => entry.personalBests.single)
      const averageValues = competitors.map((entry) => entry.personalBests.average)
      const myStanding = {
        single: fieldStanding(mineInEvent?.personalBests.single ?? null, singleValues),
        average: fieldStanding(mineInEvent?.personalBests.average ?? null, averageValues),
      }
      const competitorsWithComparison = competitors.map((entry) => ({
        ...entry,
        comparisonToYou: me ? {
          single: comparePbs(mineInEvent?.personalBests.single ?? null, entry.personalBests.single),
          average: comparePbs(mineInEvent?.personalBests.average ?? null, entry.personalBests.average),
        } : null,
      })).sort((a, b) => (a.personalBests.average ?? a.personalBests.single ?? Number.MAX_SAFE_INTEGER) - (b.personalBests.average ?? b.personalBests.single ?? Number.MAX_SAFE_INTEGER))
      return {
        eventId,
        registeredCount: competitors.length,
        knownSingleCount: singleValues.filter((value) => value !== null).length,
        knownAverageCount: averageValues.filter((value) => value !== null).length,
        unknownStrengthCount: competitors.filter((entry) => entry.personalBests.single === null && entry.personalBests.average === null).length,
        myPersonalBests: mineInEvent?.personalBests ?? null,
        myStanding,
        competitors: competitorsWithComparison,
      }
    })

    const sharedCompetitors = mine && me ? people.filter(({ user }) => user.wca_id !== me).map(({ user, person }) => {
      const sharedEventIds = events.filter((eventId) => user.eventIds.includes(eventId))
      return {
        wcaId: user.wca_id,
        name: user.name,
        gender: user.gender,
        firstTime: !user.wca_id,
        sharedEventIds,
        eventComparisons: sharedEventIds.map((eventId) => {
          const yours = personalBests(mine.person, eventId)
          const theirs = personalBests(person, eventId)
          return { eventId, yours, theirs, single: comparePbs(yours.single, theirs.single), average: comparePbs(yours.average, theirs.average) }
        }),
      }
    }).filter((entry) => entry.sharedEventIds.length > 0) : []

    const personalized = mine && me ? {
      competitorWcaId: me,
      sharedEventIds: events,
      theoreticalBestEvent: {
        bySingle: strongestTheoreticalEvent(byEvent, "single"),
        byAverage: strongestTheoreticalEvent(byEvent, "average"),
      },
      sharedCompetitors,
      methodology: "Positions use official PBs only. Lower WCA result values are better. Unknown or first-time strength is never ranked.",
    } : null

    return apiJson({ data: { competition: { id: competition.id, name: competition.name, dates: [competition.start_date, competition.end_date], city: competition.city, eventIds: competition.event_ids, url: competition.url }, requestedEvents: events, personalized, byEvent }, source: { registrations: `${competition.url}/registrations`, provider: "World Cube Association" }, generatedAt: new Date().toISOString() })
  } catch (error) {
    return apiFailure(error, "Competition report failed")
  }
}

export function OPTIONS() {
  return apiOptions()
}
