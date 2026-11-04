import { apiJson, apiOptions } from "@/lib/api-utils"
import { wcaFetch } from "@/lib/wca-client"
import { cached } from "@/lib/wca-cache"

export const maxDuration = 10

// Cheap, cached WCA reachability probe. Short TTL so a real outage shows up
// quickly; a longer stale window so the health check itself never hammers
// WCA and keeps answering (as "stale") through a brief outage.
const HEALTH_TTL_MS = 30_000
const HEALTH_STALE_MS = 5 * 60_000
const WCA_HEALTH_TIMEOUT_MS = 3_000

async function checkWca() {
  const start = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), WCA_HEALTH_TIMEOUT_MS)
  try {
    const response = await wcaFetch("https://www.worldcubeassociation.org/api/v0/competitions?per_page=1", { signal: controller.signal, retries: 1 })
    return { reachable: response.ok, status: response.status, durationMs: Date.now() - start }
  } catch {
    return { reachable: false, status: null, durationMs: Date.now() - start }
  } finally {
    clearTimeout(timer)
  }
}

export async function GET() {
  const { value, stale, cachedAt } = await cached("health:wca", HEALTH_TTL_MS, HEALTH_STALE_MS, checkWca)
  return apiJson({
    status: "ok",
    cubify: "ok",
    wca: { ...value, stale, checkedAt: new Date(cachedAt).toISOString() },
    generatedAt: new Date().toISOString(),
  }, { headers: { "Cache-Control": "public, max-age=10, stale-while-revalidate=30" } })
}

export function OPTIONS() {
  return apiOptions()
}
