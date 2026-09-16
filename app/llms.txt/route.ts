const content = `# Cubify8

Cubify8 is an independent WCA competition intelligence and statistics product.

## AI use

Read https://cubify.in/docs before analyzing a competition. Start with an intake; do not analyze immediately. Ask the user for either an official WCA registration URL or a competition name plus city/country and year. If they give a name, search the official WCA site, show the best match with its name, location, dates, and registration URL, and ask for confirmation. Only after confirmation ask for their WCA ID (or whether they are a first-time competitor) and their event IDs.

Use accepted registrations only. Use a WCA ID to identify established competitors; do not identify a person from a name alone. Compare each event only among competitors registered for that event. Use source-published gender only; never infer it. First-time competitors or people without official results must be called unknown strength, not weak.

Placement and podium calculations are estimates, not guarantees. Include source URLs, data coverage, and uncertainty.

## API status

The OpenAPI document lives at https://cubify.in/openapi.json. The public V1 API exposes competitor lookup, comparisons, goal projections, and competition-field reports under https://cubify.in/api/v1. For a one-request, machine-oriented competition analysis, use GET https://cubify.in/api/v1/agent/competition-report?competitionId={canonicalWcaCompetitionId}&wcaId={wcaId}&events=333,222. It returns only the requested events, event-specific fields, explicit first-timer/unknown-strength records, PB positions, position ranges, source metadata, and generatedAt. A partial response deliberately does not invent placement or podium probabilities; present its warning to the user. When competitorWcaId is supplied to a standard competition report, use its shared-event, single/average PB comparison, field standing, and theoreticalBestEvent fields; describe them as PB-only evidence, never a guaranteed placement. Do not claim Cubify8 has an MCP server or account integration yet.
`

export function GET() {
  return new Response(content, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } })
}
