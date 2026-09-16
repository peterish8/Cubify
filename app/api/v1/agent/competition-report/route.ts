import { OPTIONS as reportOptions, POST as createReport } from "@/app/api/v1/reports/route"
import { apiFailure, apiJson, ApiError, wcaId } from "@/lib/api-utils"
import { canonicalCompetitionId } from "@/lib/report-utils"
import { eventDisplayName } from "@/lib/wca-events"
import { formatResult } from "@/lib/wca-format"

function requestedEvents(value: string | null) {
  if (!value) return undefined
  const events = value.split(",").map((event) => event.trim().toLowerCase()).filter(Boolean)
  if (!events.length || events.length > 25 || events.some((event) => !/^[a-z0-9]{1,12}$/.test(event))) {
    throw new ApiError("events must be a comma-separated list of at most 25 valid event IDs", 400, "invalid_request")
  }
  return [...new Set(events)]
}

/**
 * A compact, machine-readable view of the full competition report.  This is
 * intentionally a thin adapter over /reports so both routes share identical
 * WCA registration, PB, and unknown-strength behaviour.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const competitionId = canonicalCompetitionId(url.searchParams.get("competitionId"))
    const competitorWcaId = wcaId(url.searchParams.get("wcaId"))
    const eventIds = requestedEvents(url.searchParams.get("events"))
    const includeAll = url.searchParams.get("include") === "all"
    const reportResponse = await createReport(new Request("http://cubify.internal/api/v1/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        competitionUrl: `https://www.worldcubeassociation.org/competitions/${competitionId}`,
        competitorWcaId,
        eventIds,
      }),
    }))
    const report = await reportResponse.json() as any
    if (!reportResponse.ok) return apiJson(report, { status: reportResponse.status })

    const personalized = report.data.personalized
    const analyzedEventIds = new Set(report.data.byEvent.map((event: any) => event.eventId))
    const eventStates = (eventIds ?? report.data.requestedEvents).map((eventId: string) => ({
      eventId,
      eventName: eventDisplayName(eventId),
      status: analyzedEventIds.has(eventId) ? "ANALYZED" : report.data.competition.eventIds.includes(eventId) ? "NOT_REGISTERED" : "EVENT_NOT_AT_COMPETITION",
    }))
    const events = Object.fromEntries(report.data.byEvent.map((event: any) => {
      const firstTimers = event.competitors.filter((entry: any) => entry.firstTime)
      // This endpoint's field estimate is intentionally average-only. A single
      // can be useful context, but must never become a silent ranking fallback.
      const unknownAverageStrength = event.competitors.filter((entry: any) => entry.personalBests.average === null)
      const knownRank = event.myStanding.average.position
      const knownSize = event.myStanding.average.knownCompetitors
      const opponents = event.competitors.filter((entry: any) => entry.wcaId !== competitorWcaId)
      const toOpponent = (entry: any) => ({
        wcaId: entry.wcaId,
        name: entry.name,
        pb: entry.personalBests,
        pbDisplay: {
          single: entry.personalBests.single === null ? null : formatResult(event.eventId, entry.personalBests.single, "single"),
          average: entry.personalBests.average === null ? null : formatResult(event.eventId, entry.personalBests.average, "average"),
        },
        firstTimer: entry.firstTime,
        strength: entry.personalBests.single === null && entry.personalBests.average === null ? "unknown" : "known",
        rankingRelativeToUser: entry.comparisonToYou?.average.result === "opponent" ? "ahead" : entry.comparisonToYou?.average.result === "you" ? "behind" : "unknown",
      })
      const compactOpponents = opponents.filter((entry: any) => entry.comparisonToYou?.average.result !== "unknown").sort((a: any, b: any) => Math.abs(a.comparisonToYou.average.difference) - Math.abs(b.comparisonToYou.average.difference)).slice(0, 8).map(toOpponent)
      return [event.eventId, {
        eventName: eventDisplayName(event.eventId),
        field: { registered: event.registeredCount, ranked: knownSize, firstTimers: firstTimers.length, unknownStrength: unknownAverageStrength.length, rankingBasis: "best-average" },
        user: {
          pbSingle: event.myPersonalBests?.single ?? null,
          pbAverage: event.myPersonalBests?.average ?? null,
          pbSingleDisplay: event.myPersonalBests?.single === null || event.myPersonalBests?.single === undefined ? null : formatResult(event.eventId, event.myPersonalBests.single, "single"),
          pbAverageDisplay: event.myPersonalBests?.average === null || event.myPersonalBests?.average === undefined ? null : formatResult(event.eventId, event.myPersonalBests.average, "average"),
          pbSinglePosition: event.myStanding.single.position,
          pbAveragePosition: event.myStanding.average.position,
          possibleOverallRange: knownRank === null ? null : { best: knownRank, worst: knownRank + unknownAverageStrength.length, basis: "best-average" },
        },
        opponentCounts: {
          ahead: opponents.filter((entry: any) => entry.comparisonToYou?.average.result === "opponent").length,
          behind: opponents.filter((entry: any) => entry.comparisonToYou?.average.result === "you").length,
          unknown: opponents.filter((entry: any) => entry.comparisonToYou?.average.result === "unknown").length,
        },
        keyOpponents: compactOpponents,
        ...(includeAll ? { opponents: opponents.map(toOpponent) } : {}),
        firstTimers: firstTimers.filter((entry: any) => entry.wcaId !== competitorWcaId).map((entry: any) => ({ wcaId: null, name: entry.name, firstTimer: true, strength: "unknown" })),
      }]
    }))

    return apiJson({
      status: "partial",
      warnings: [{ code: "PREDICTION_NOT_AVAILABLE", message: "Placement and podium predictions require a validated historical model and are not inferred from PB rank." }],
      competition: report.data.competition,
      subject: { wcaId: competitorWcaId },
      request: { eventStates, opponentDetail: includeAll ? "all" : "key-only (use include=all for every opponent)" },
      events,
      methodology: personalized.methodology,
      resultEncoding: "pbSingle and pbAverage are official WCA integers; pbSingleDisplay and pbAverageDisplay are the human-readable values for this event.",
      source: report.source,
      generatedAt: report.generatedAt,
    })
  } catch (error) {
    return apiFailure(error, "Agent competition report failed")
  }
}

export function OPTIONS() {
  return reportOptions()
}
