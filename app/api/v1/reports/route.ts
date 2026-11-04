import { apiFailure, apiOptions, ApiError } from "@/lib/api-utils"
import { buildCompetitionReport, type ReportRequest } from "@/lib/report-service"

// Explicit and generous: the upstream WCA fan-out is bounded by
// REPORT_DEADLINE_MS (45s) in lib/report-service.ts, but the route's own
// limit must be comfortably above that so a near-deadline response always
// has time to be written out, instead of depending on whatever an
// unconfigured platform default happens to be.
export const maxDuration = 60

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json()
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new ApiError("Request body must be a JSON object", 400, "invalid_request")
    return await buildCompetitionReport(body as ReportRequest)
  } catch (error) {
    return apiFailure(error, "Competition report failed")
  }
}

export function OPTIONS() {
  return apiOptions()
}
