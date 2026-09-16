import { apiFailure, apiJson, apiOptions, competitor, publicPerson, wcaId, ApiError } from "@/lib/api-utils"
import { fetchRankList, resultToAllScopeRanks } from "@/lib/wca-rank-list"
import { fetchRankTotals, type RankType } from "@/lib/wca-rank-totals"

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json()
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new ApiError("Request body must be a JSON object", 400, "invalid_request")
    const input = body as Record<string, unknown>
    const id = wcaId(input.wcaId)
    const eventId = typeof input.eventId === "string" && /^[a-z0-9]+$/i.test(input.eventId.trim()) ? input.eventId.trim().toLowerCase() : ""
    const rankType: RankType | null = input.rankType === "single" || input.rankType === "average" ? input.rankType : null
    const hypotheticalBest = input.hypotheticalBest
    if (!eventId || eventId.length > 12 || !rankType || typeof hypotheticalBest !== "number" || !Number.isSafeInteger(hypotheticalBest) || hypotheticalBest <= 0 || hypotheticalBest > 2_000_000_000) throw new ApiError("eventId, rankType, and a positive integer hypotheticalBest are required", 400, "invalid_request")
    const person = await competitor(id)
    const [list, totals] = await Promise.all([fetchRankList(eventId, rankType), fetchRankTotals().catch(() => null)])
    const previousBest = person.personal_records[eventId]?.[rankType]?.best ?? null
    const projectedRanks = resultToAllScopeRanks(list, hypotheticalBest, previousBest, person.country.iso2, person.country.continentId, totals)
    return apiJson({ data: { competitor: publicPerson(person), eventId, rankType, previousBest, hypotheticalBest, projectedRanks, source: totals?.source ?? null }, generatedAt: new Date().toISOString() })
  } catch (error) {
    return apiFailure(error, "Goal projection failed")
  }
}

export function OPTIONS() {
  return apiOptions()
}
