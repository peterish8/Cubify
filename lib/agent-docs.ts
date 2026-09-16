export const agentDocs = `# Cubify8 Agent Documentation

Cubify8 is an independent WCA competition intelligence and statistics product.

## Machine-readable entry points

- https://cubify.in/llms.txt
- https://cubify.in/docs.txt
- https://cubify.in/docs.md
- https://cubify.in/docs/agent.md
- https://cubify.in/openapi.json
- https://cubify.in/api/openapi.json

All of these endpoints are public, server-rendered responses. They require no JavaScript, login, or cookies.

## AI workflow

Start with an official WCA registration URL, or a competition name plus city/country and year. If given a name, search the official WCA site, present the exact match with name, location, dates, and registration URL, and obtain confirmation before analysis. Then collect the competitor's canonical WCA ID and event IDs.

Use accepted registrations only. Identify established competitors by WCA ID, not by name. Compare each event only among registered competitors. Use source-published gender only. First-time competitors and people without official results are unknown strength, never weak.

## API

The public API is documented in OpenAPI at https://cubify.in/openapi.json and https://cubify.in/api/openapi.json.

For one-request competition analysis use:

GET https://cubify.in/api/v1/agent/competition-report?competitionId={canonicalWcaCompetitionId}&wcaId={wcaId}&events=333,222

The response returns only requested events, event-specific fields, explicit first-timer/unknown-strength records, PB positions, position ranges, source metadata, and generatedAt. Check request.eventStates: requested events can be ANALYZED, NOT_REGISTERED, or EVENT_NOT_AT_COMPETITION; never silently omit an event. The default returns counts and eight closest known rivals; add include=all only when every opponent is needed.

Use pbSingleDisplay and pbAverageDisplay in explanations; raw PB values are official WCA integers. possibleOverallRange and field.rankingBasis are always best-average based. Never substitute best single when an official average is absent. A partial response does not provide placement or podium probabilities; present its warning instead of inventing a forecast.

## Discovery

https://cubify.in/robots.txt allows compliant crawlers and points to https://cubify.in/sitemap.xml. The sitemap lists the human documentation pages. Do not claim Cubify8 has an MCP server or account integration yet.
`

export const agentDocsCacheControl = "public, max-age=3600"
