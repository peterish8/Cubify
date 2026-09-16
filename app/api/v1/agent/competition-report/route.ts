import { OPTIONS as reportOptions, POST as createReport } from "@/app/api/v1/reports/route"
import { apiFailure, apiJson, ApiError, wcaId } from "@/lib/api-utils"
import { canonicalCompetitionId } from "@/lib/report-utils"

function requestedEvents(value: string | null) {
  if (!value) return undefined
  const events = value.split(",").map((event) => event.trim().toLowerCase()).filter(Boolean)
  if (!events.length || events.length > 25 || events.some((event) => !/^[a-z0-9]{1,12}$/.test(event))) {
    throw new ApiError("events must be a comma-separated list of at most 25 valid event IDs", 400, "invalid_request")
  }
  return events
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
    const events = Object.fromEntries(report.data.byEvent.map((event: any) => {
      const firstTimers = event.competitors.filter((entry: any) => entry.firstTime)
      const unknownStrength = event.competitors.filter((entry: any) => entry.personalBests.single === null && entry.personalBests.average === null)
      const knownRank = event.myStanding.average.position ?? event.myStanding.single.position
      const knownSize = event.myStanding.average.knownCompetitors || event.myStanding.single.knownCompetitors
      return [event.eventId, {
        field: { registered: event.registeredCount, ranked: knownSize, firstTimers: firstTimers.length, unknownStrength: unknownStrength.length },
        user: {
          pbSingle: event.myPersonalBests?.single ?? null,
          pbAverage: event.myPersonalBests?.average ?? null,
          pbSinglePosition: event.myStanding.single.position,
          pbAveragePosition: event.myStanding.average.position,
          possibleOverallRange: knownRank === null ? null : { best: knownRank, worst: knownRank + unknownStrength.length },
        },
        opponents: event.competitors.filter((entry: any) => entry.wcaId !== competitorWcaId).map((entry: any) => ({
          wcaId: entry.wcaId,
          name: entry.name,
          pb: entry.personalBests,
          firstTimer: entry.firstTime,
          strength: entry.personalBests.single === null && entry.personalBests.average === null ? "unknown" : "known",
          rankingRelativeToUser: entry.comparisonToYou?.average.result === "opponent" ? "ahead" : entry.comparisonToYou?.average.result === "you" ? "behind" : "unknown",
        })),
        firstTimers: firstTimers.filter((entry: any) => entry.wcaId !== competitorWcaId).map((entry: any) => ({ wcaId: null, name: entry.name, firstTimer: true, strength: "unknown" })),
      }]
    }))

    return apiJson({
      status: "partial",
      warnings: [{ code: "PREDICTION_NOT_AVAILABLE", message: "Placement and podium predictions require a validated historical model and are not inferred from PB rank." }],
      competition: report.data.competition,
      subject: { wcaId: competitorWcaId },
      events,
      methodology: personalized.methodology,
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
