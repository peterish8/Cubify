import { apiFailure, apiJson, apiOptions, competitor, compareProfiles, publicPerson, wcaId, ApiError } from "@/lib/api-utils"

export function OPTIONS() {
  return apiOptions()
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json()
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new ApiError("Request body must be a JSON object", 400, "invalid_request")
    const input = body as Record<string, unknown>
    const wcaIdA = wcaId(input.wcaIdA)
    const wcaIdB = wcaId(input.wcaIdB)
    if (wcaIdA === wcaIdB) throw new ApiError("wcaIdA and wcaIdB must be different competitors", 400, "invalid_request")
    const [a, b] = await Promise.all([competitor(wcaIdA), competitor(wcaIdB)])
    return apiJson({ data: { competitors: { a: publicPerson(a), b: publicPerson(b) }, ...compareProfiles(a, b) }, source: "World Cube Association", generatedAt: new Date().toISOString() })
  } catch (error) {
    return apiFailure(error, "Comparison failed")
  }
}
