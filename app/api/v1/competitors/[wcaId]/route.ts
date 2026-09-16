import { apiFailure, apiJson, apiOptions, competitor, publicPerson, wcaId } from "@/lib/api-utils"

export function OPTIONS() {
  return apiOptions()
}

export async function GET(_: Request, { params }: { params: { wcaId: string } }) {
  try {
    const person = await competitor(wcaId(params.wcaId), true)
    return apiJson({ data: publicPerson(person), source: "World Cube Association", generatedAt: new Date().toISOString() }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" } })
  } catch (error) {
    return apiFailure(error, "Competitor lookup failed")
  }
}
