import { agentDocs, agentDocsCacheControl } from "@/lib/agent-docs"

export function GET() {
  return new Response(agentDocs, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": agentDocsCacheControl } })
}
