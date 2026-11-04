import { apiFailure, apiJson, ApiError, parallelMap, wcaJson, wcaTtl, competitor, wcaId } from "@/lib/api-utils"
import { comparePbs, competitionId, fieldStanding, strongestTheoreticalEvent, type PersonalBests } from "@/lib/report-utils"
import { fetchWcaPersonRecentForm, type WcaEventRecentForm } from "@/lib/wca-person"
import { withDeadline, DeadlineExceededError } from "@/lib/wca-client"
import { withReportContext, noteLookupFailure } from "@/lib/request-context"

/**
 * Shared report builder behind both GET /api/v1/agent/competition-report and
 * POST /api/v1/reports, so the two endpoints cannot diverge.
 *
 * Root cause this exists to fix: the old code fetched one WCA record per
 * *registrant* (a /users/:id call, then a /persons/:id call) with no cache,
 * no retry, and no overall deadline. WCA's public API is itself slow and
 * occasionally flaky (observed 1.2s-22s per call in production), so a
 * ~50-person competition meant ~100 sequential-ish upstream calls per
 * request. A single flaky call used to abort the *entire* report via
 * Promise.all rejection -- that's the 502/504 reported. The aggregate
 * latency of ~100 slow calls is the hang reported from POST /reports.
 */

// Overall deadline for the upstream-heavy phase (fetching WCA data). Kept
// comfortably under typical serverless limits so the route always returns
// a structured response instead of letting the platform drop the
// connection. Pure in-memory aggregation after this phase is fast (<50ms).
const REPORT_DEADLINE_MS = 45_000

type Registration = { user_id: number; event_ids: string[] }
type WcaUserResponse = { user: { wca_id: string | null; name: string; gender: "m" | "f" | "o" | null; country_iso2: string } }
type Competition = { id: string; name: string; start_date: string; end_date: string; city: string; event_ids: string[]; url: string }
type CompetitionEvent = {
  id: string
  rounds?: Array<{
    id?: string
    format?: string
    cutoff?: unknown
    advancementCondition?: unknown
  }>
}
export type ReportRequest = { competitionUrl?: unknown; eventIds?: unknown; competitorWcaId?: unknown }

type FetchedUser = { wca_id: string | null; name: string; gender: "m" | "f" | "o" | null; country_iso2: string; eventIds: string[]; lookupFailed?: boolean }

function personalBests(person: Awaited<ReturnType<typeof competitor>> | null, eventId: string): PersonalBests {
  const record = person?.personal_records[eventId]
  return { single: record?.single?.best ?? null, average: record?.average?.best ?? null }
}

function buildRoundPlans(
  eventRows: Array<{ eventId: string; competitors: Array<{ personalBests: PersonalBests }>; myStanding: { average: { position: number | null } } }>,
  competitionEvents: CompetitionEvent[] | null,
) {
  if (!competitionEvents) return null
  return Object.fromEntries(eventRows.map((event) => {
    const metadata = competitionEvents.find((entry) => entry.id === event.eventId)
    const averages = event.competitors.map((entry) => entry.personalBests.average).filter((value): value is number => value !== null).sort((a, b) => a - b)
    const rounds = (metadata?.rounds ?? []).map((round) => {
      const condition = round.advancementCondition
      const level = typeof condition === "object" && condition !== null && "type" in condition && condition.type === "ranking" && "level" in condition && typeof condition.level === "number" && Number.isSafeInteger(condition.level) && condition.level > 0 ? condition.level : null
      return {
        roundId: round.id ?? null,
        format: round.format ?? null,
        cutoff: round.cutoff ?? null,
        advancementCondition: condition ?? null,
        pbAverageThreshold: level ? averages[level - 1] ?? null : null,
        subjectPbAveragePosition: event.myStanding.average.position,
        subjectMeetsPbThreshold: level && event.myStanding.average.position !== null ? event.myStanding.average.position <= level : null,
      }
    })
    return [event.eventId, { rounds, source: "WCA competition event metadata", note: "PB threshold is a field estimate, not a competition-day cutoff." }]
  }))
}

async function fetchUpstreamData(id: string) {
  const [competition, registrations, competitionEvents] = await Promise.all([
    wcaJson<Competition>(`/competitions/${id}`, wcaTtl.competition),
    wcaJson<Registration[]>(`/competitions/${id}/registrations`, wcaTtl.registrations),
    wcaJson<CompetitionEvent[]>(`/competitions/${id}/events`, wcaTtl.events).catch(() => null),
  ])
  if (!competition || typeof competition !== "object" || typeof competition.id !== "string" || typeof competition.name !== "string" || !Array.isArray(competition.event_ids) || !competition.event_ids.every((event) => typeof event === "string")) throw new ApiError("The WCA competition response was invalid", 502, "upstream_invalid")
  if (!Array.isArray(registrations) || registrations.length > 5000 || registrations.some((registration) => !registration || typeof registration.user_id !== "number" || !Number.isSafeInteger(registration.user_id) || registration.user_id <= 0 || !Array.isArray(registration.event_ids) || !registration.event_ids.every((event) => typeof event === "string"))) throw new ApiError("The WCA registrations response was invalid", 502, "upstream_invalid")
  return { competition, registrations, competitionEvents }
}

/**
 * Resolves every registration to a user record. A single registrant whose
 * /users/:id call fails (WCA flakiness, rate limiting, timeout) no longer
 * takes the whole report down: they're folded in as unknown strength and
 * counted so the response can say so via `warnings`.
 */
// Each registrant needs two upstream calls (/users/:id, then /persons/:id).
// Running them as one fused task per registrant -- instead of a full wave
// of every /users/:id call followed by a second full wave of every
// /persons/:id call -- means the two calls' latencies overlap across the
// batch instead of stacking phase-by-phase. Concurrency is higher than the
// "5-10" rule of thumb because live measurement showed individual WCA calls
// ranging 1.2s-22s (see lib/report-service.ts header comment); at a lower
// concurrency a ~50-person competition cannot clear even a 45s deadline.
// Retry-with-backoff (lib/wca-client.ts) absorbs the extra 429 risk.
const REGISTRANT_CONCURRENCY = 16

async function resolveRegistrant(registration: Registration) {
  let user: FetchedUser
  try {
    const data = await wcaJson<WcaUserResponse>(`/users/${registration.user_id}`, wcaTtl.user)
    user = { ...data.user, eventIds: registration.event_ids }
  } catch {
    noteLookupFailure()
    user = { wca_id: null, name: "Unknown competitor", gender: null, country_iso2: "XX", eventIds: registration.event_ids, lookupFailed: true }
  }
  const person = user.wca_id
    ? await competitor(user.wca_id).catch(() => {
        noteLookupFailure()
        return null
      })
    : null
  return { user, person }
}

async function resolveRegistrants(registrations: Registration[]) {
  return parallelMap(registrations, REGISTRANT_CONCURRENCY, resolveRegistrant)
}

async function buildReportPayload(input: ReportRequest) {
  const body = input
  const id = competitionId(body.competitionUrl)
  if (body.eventIds !== undefined && !Array.isArray(body.eventIds)) throw new ApiError("eventIds must be an array of event IDs", 400, "invalid_request")
  const rawEvents = Array.isArray(body.eventIds) ? body.eventIds : []
  if (rawEvents.length > 25 || rawEvents.some((event) => typeof event !== "string" || !/^[a-z0-9]+$/i.test(event.trim()) || event.trim().length > 12)) throw new ApiError("eventIds must contain at most 25 valid event IDs", 400, "invalid_request")
  const selectedEvents: string[] = rawEvents.map((event) => (event as string).trim().toLowerCase())
  const me = body.competitorWcaId === undefined || body.competitorWcaId === null || body.competitorWcaId === "" ? null : wcaId(body.competitorWcaId)

  const { result: upstream, context } = await withDeadline(withReportContext(async () => {
    const data = await fetchUpstreamData(id)
    const people = await resolveRegistrants(data.registrations)
    return { ...data, people }
  }), REPORT_DEADLINE_MS)

  const { competition, competitionEvents, people } = upstream
  const requestedEvents: string[] = selectedEvents.length ? selectedEvents.filter((event) => competition.event_ids.includes(event)) : competition.event_ids
  if (!requestedEvents.length) throw new ApiError("No requested events are offered at this competition", 400, "invalid_request")

  const mine = me ? people.find(({ user }) => user.wca_id === me) ?? null : null
  if (me && !mine) throw new ApiError("competitorWcaId is not an accepted registration for this competition", 400, "invalid_request")
  const events = mine ? requestedEvents.filter((eventId) => mine.user.eventIds.includes(eventId)) : requestedEvents
  if (me && !events.length) throw new ApiError("None of the requested events are shared with your accepted registration", 400, "invalid_request")

  const byEvent = events.map((eventId) => {
    const competitors = people.filter(({ user }) => user.eventIds.includes(eventId)).map(({ user, person }) => {
      const bests = personalBests(person, eventId)
      return { wcaId: user.wca_id, name: user.name, gender: user.gender, countryIso2: user.country_iso2, firstTime: !user.wca_id && !user.lookupFailed, lookupFailed: user.lookupFailed ?? false, personalBests: bests }
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
      firstTime: !user.wca_id && !user.lookupFailed,
      sharedEventIds,
      eventComparisons: sharedEventIds.map((eventId) => {
        const yours = personalBests(mine.person, eventId)
        const theirs = personalBests(person, eventId)
        return { eventId, yours, theirs, single: comparePbs(yours.single, theirs.single), average: comparePbs(yours.average, theirs.average) }
      }),
    }
  }).filter((entry) => entry.sharedEventIds.length > 0) : []

  const recentForm: WcaEventRecentForm[] = me
    ? await withDeadline(fetchWcaPersonRecentForm(me, events).catch(() => []), 15_000).catch(() => [])
    : []
  const roundPlans = buildRoundPlans(byEvent, competitionEvents)
  const personalized = mine && me ? {
    competitorWcaId: me,
    sharedEventIds: events,
    theoreticalBestEvent: {
      bySingle: strongestTheoreticalEvent(byEvent, "single"),
      byAverage: strongestTheoreticalEvent(byEvent, "average"),
    },
    sharedCompetitors,
    recentForm,
    roundPlans,
    methodology: "Positions use official PBs only. Lower WCA result values are better. Unknown or first-time strength is never ranked.",
  } : null

  const warnings = [
    ...(competitionEvents ? [] : [{ code: "ROUND_METADATA_UNAVAILABLE", message: "WCA round metadata was unavailable; advancement thresholds were not calculated." }]),
    ...(me && !recentForm.length ? [{ code: "RECENT_FORM_UNAVAILABLE", message: "Recent official averages were unavailable; PBs remain the only ranking basis." }] : []),
    ...(context.failedLookups > 0 ? [{ code: "COMPETITOR_LOOKUP_FAILED", message: `${context.failedLookups} competitor lookup(s) failed and are marked unknown strength.`, count: context.failedLookups }] : []),
  ]

  return {
    data: { competition: { id: competition.id, name: competition.name, dates: [competition.start_date, competition.end_date], city: competition.city, eventIds: competition.event_ids, url: competition.url, roundPlans }, requestedEvents: events, personalized, byEvent, warnings },
    source: { registrations: `${competition.url}/registrations`, provider: "World Cube Association", cachedAt: new Date(context.oldestCachedAt).toISOString(), stale: context.stale },
    generatedAt: new Date().toISOString(),
  }
}

export async function buildCompetitionReport(input: ReportRequest) {
  try {
    return apiJson(await buildReportPayload(input))
  } catch (error) {
    if (error instanceof DeadlineExceededError) {
      return apiFailure(new ApiError("The competition report took too long to assemble from WCA data", 504, "upstream_timeout", { service: "wca", status: null, endpoint: "report-aggregation", durationMs: error.deadlineMs }), "Competition report failed")
    }
    return apiFailure(error, "Competition report failed")
  }
}
