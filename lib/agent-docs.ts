/**
 * Exported separately (not just inlined in agentDocs) so the human /docs
 * page can render the exact same text an LLM reads from llms.txt/docs.md/
 * docs.txt/docs/agent.md -- one source, five places, never drifts.
 */
export const presentingResultsSection = `## Presenting results to users

Once you have the report, present it the same way every time -- do not invent a new layout per conversation. These rules apply after any successful call to \`GET /api/v1/agent/competition-report\`.

### Audience and tone

The reader may be a first-time Cubify user and possibly a first-time competitor. Use plain words. Explain "PB", "average", and "cut" on first use in one short phrase each ("PB = personal best", "cut = how many people advance to the next round"). Sentence case. No hype. Never present a ranking as a prediction.

### Fields to read (GET /api/v1/agent/competition-report)

- Competition: \`competition.name\`, \`competition.dates\`, \`competition.city\`
- Per event, from \`events.{eventId}\` (an object keyed by event ID, not an array): \`eventName\`, \`user.pbSingleDisplay\`, \`user.pbAverageDisplay\`, \`user.pbAveragePosition\`, \`user.possibleOverallRange.{best,worst}\`, \`field.{registered,ranked,firstTimers,unknownStrength}\`, \`opponentCounts.{ahead,behind,unknown}\`, \`recentForm.{latestAverage,trend,trendDelta}\`
- Cuts, from \`competition.roundPlans.{eventId}.rounds[]\`: \`roundId\`, \`advancementCondition.{type,level}\`, \`subjectPbAveragePosition\`, \`subjectMeetsPbThreshold\`
- Status: \`request.eventStates[]\` (every requested event must appear), \`warnings[]\`, \`source.{stale,cachedAt}\`, \`generatedAt\`
- Always use the \`*Display\` fields for times. Never format raw integers yourself (they are centiseconds).

### Verdict rule (use exactly this, same every time)

For each event, take the tightest cut: the smallest \`advancementCondition.level\` among rounds where \`advancementCondition.type\` is \`ranking\`. Margin = that level minus \`user.pbAveragePosition\`.

- margin >= 5: "Comfortable" (green)
- margin 0 to 4: "Close" (amber)
- margin < 0: "Under the cut" (red)

If no ranking-type cut exists, or the user has no official average, show "No verdict" (gray) and say why in one short phrase. If \`advancementCondition.type\` is not \`ranking\`, show the condition as given and do not compute a margin.

"Worst case" = \`possibleOverallRange.worst\`: everyone with unknown strength is assumed faster. Compute the verdict again from that position and show it as a separate view, labelled clearly.

### Event states

Show every event in \`request.eventStates\`. \`NOT_REGISTERED\` and \`EVENT_NOT_AT_COMPETITION\` get one plain line each ("You're not registered for 5x5 here"), never silently omitted.

### Warnings and errors

- \`PREDICTION_NOT_AVAILABLE\` is normal for \`status: "partial"\`. Do not alarm the user. Say once: "This is a ranking from past averages, not a prediction."
- \`COMPETITOR_LOOKUP_FAILED\` or any other warning: tell the user in plain words which part may be incomplete.
- If \`source.stale\` is true, say the data may be a bit old and give \`source.cachedAt\`.
- On any non-200, show the endpoint and the error \`code\`, \`message\`, \`status\`, and \`requestId\` if present, say Cubify couldn't get the data right now, and suggest trying again shortly. Never fill the gap with WCA data from elsewhere unless the user asks, and label it clearly if they do.

### Output mode A: clients that can render UI (artifact, widget, HTML, canvas)

Render a single interactive report, flat design, readable in light and dark mode, using these parts in this order:

1. Header: competition name, dates, city, WCA ID.
2. Three summary cards: counts of Comfortable / Close / Under the cut (green / amber / red).
3. A toggle: "On paper" (default) and "If every unknown is faster" (worst case). The toggle changes each dot position and verdict.
4. One row per event, ordered best margin first. Each row shows: event name, best average, "Nth of {registered} registered", the cut(s) ("Round 1: top 18"), the verdict pill, and a horizontal position bar: a track the width of \`field.registered\`, a dot at the user's position, a shaded band from \`possibleOverallRange.best\` to \`.worst\`, and a vertical line at each cut level.
5. Tap-to-expand details per event: best single, best average, faster / slower / unknown counts, possible spot range, latest average and trend, all cuts.
6. A "Coach me on {event}" button per event that sends a follow-up message to the chat.
7. A one-line footer: "A ranking from official averages, not a predicted finish. Source: Cubify, built on WCA data, {generatedAt date}."

Rules: color is never the only signal (always show the verdict word). No fabricated numbers. No placeholder content. Keep it to one screen without nested scrolling.

### Output mode B: clients that cannot render UI (plain text / markdown)

Use exactly this structure:

\`\`\`
**Your {competition name} report** ({dates}, {city})

**In one line:** {Best event} is your strongest event, and {tightest event(s)} are your toughest.

**Where you stand on paper**

| Event | Your best average | Your spot | Out of | Verdict |
|---|---|---|---|---|
| ... one row per event, best margin first ... |

**What this means**
- {one bullet per notable event: comfortable / close to the cut / under the cut, with the numbers}

**Where to put your practice time**
1. {event with the smallest or negative margin, with the number of places}
2. {next}
3. {next}

**Good to know**
- "Your spot" ranks you only among people who already have an official average. {N} others have no average yet, so your real spot could be as low as {worst}.
- This is a ranking, not a prediction of where you'll finish.
- Recent results can be slower or faster than your best ({one concrete example from recentForm}).

*Source: Cubify (cubify.in), built on World Cube Association data, {date}.*
\`\`\`

"Out of" is \`field.ranked\` (people with an official average). Use text labels for verdicts; emojis (green, amber, red circles) are optional and only if the client renders them. If the user asked for a short answer, give the "In one line" summary plus the table only.

### Follow-ups

Offer, but do not auto-run: goal projection (\`POST /api/v1/goals/projection\`), comparison with another competitor (\`POST /api/v1/comparisons\`), and Kinch rank (only if Cubify supplies it; never treat PB position as Kinch rank).`

export const agentDocs = `# Cubify8 Agent Documentation

Cubify8 is an independent WCA competition intelligence and statistics product.

## Machine-readable entry points

- https://cubify.in/llms.txt
- https://cubify.in/docs.txt
- https://cubify.in/docs.md
- https://cubify.in/docs/agent.md
- https://cubify.in/openapi.json
- https://cubify.in/api/openapi.json
- https://cubify.in/api/v1/health

All of these endpoints are public, server-rendered responses. They require no JavaScript, login, or cookies.

## AI workflow

Cubify is the data source and report engine. Do not web-search the WCA or other sites for competition details. Ask for an official WCA registration URL or canonical competition ID, confirm it with the user, then collect the competitor's canonical WCA ID and event IDs. If the user gives only a name, city, or year, ask for the registration URL or canonical ID instead of searching externally.

Call the one-request agent endpoint after inputs are confirmed:

GET https://cubify.in/api/v1/agent/competition-report?competitionId={canonicalWcaCompetitionId}&wcaId={wcaId}&events=333,222

When the user gives a WCA registration URL, extract the final competition ID locally and call Cubify; do not fetch the WCA page yourself. The server fetches accepted registrations and official competitor records, then returns the report. Use accepted registrations only. Identify established competitors by WCA ID, not by name. Compare each event only among registered competitors. Use source-published gender only. First-time competitors and people without official results are unknown strength, never weak. After the call, present results using the format in "Presenting results to users".

${presentingResultsSection}

## API

The public API is documented in OpenAPI at https://cubify.in/openapi.json and https://cubify.in/api/openapi.json.

For one-request competition analysis use:

GET https://cubify.in/api/v1/agent/competition-report?competitionId={canonicalWcaCompetitionId}&wcaId={wcaId}&events=333,222

The response returns only requested events, event-specific fields, explicit first-timer/unknown-strength records, PB positions, best-average position ranges, recent official-average form (when available), WCA round/cutoff metadata, source metadata, and generatedAt. Check request.eventStates: requested events can be ANALYZED, NOT_REGISTERED, or EVENT_NOT_AT_COMPETITION; never silently omit an event. The default returns counts and eight closest known rivals. Add include=all for every opponent and use offset/limit (maximum 100) to paginate large fields.

Use pbSingleDisplay and pbAverageDisplay in explanations; raw PB values are official WCA integers. possibleOverallRange and field.rankingBasis are always best-average based. Never substitute best single when an official average is absent. A partial response does not provide placement or podium probabilities; present its warning instead of inventing a forecast. If Cubify cannot be reached because of DNS/name resolution, show the exact endpoint and error; do not silently fall back to web search.

POST /api/v1/reports and GET /api/v1/agent/competition-report run the same underlying report builder but return different response shapes: POST returns \`{data: {competition, requestedEvents, personalized, byEvent, warnings}, source, generatedAt}\` (full, uncompacted per-competitor detail, no request.eventStates), while GET returns the compact agent shape documented above (events keyed by event ID, request.eventStates, pbSingleDisplay/pbAverageDisplay, verdict-ready fields). Prefer the GET agent endpoint for anything presented to a user; use POST only when you need the full byEvent/competitors detail for your own processing.

## Errors, warnings, and staleness

An error response is always \`{"error":{"code","message","status","requestId","upstream"}}\`. \`code\` is one of invalid_request, not_found, upstream_unavailable, upstream_timeout, upstream_invalid, or internal_error. \`upstream\` is present only when the failure came from the WCA data source rather than Cubify itself, and names the upstream endpoint, its status (or null on a timeout/network error), and how long it took; quote \`requestId\` when reporting an issue. A 502 or 504 on these report endpoints usually means WCA itself is slow or unavailable, not a Cubify bug -- retry after a few seconds rather than treating it as missing data.

A successful report's \`source.cachedAt\` and \`source.stale\` say whether the WCA data behind it is fresh or a previously-cached copy served because a live refetch failed; \`stale: true\` is still real data, not a guess. \`warnings\` can also include \`COMPETITOR_LOOKUP_FAILED\` with a \`count\`: that many registrants' official records could not be loaded for this request and are reported as unknown strength. Unknown strength from a failed lookup is reported the same way as a genuine first-timer (never ranked, never called weak) but is a distinct, temporary condition -- say so if asked, rather than implying those competitors have no results.

Check https://cubify.in/api/v1/health before assuming an error is a Cubify bug; it reports Cubify's own status and a cached WCA reachability check separately.

## Discovery

https://cubify.in/robots.txt allows compliant crawlers and points to https://cubify.in/sitemap.xml. The sitemap lists the human documentation pages. Do not claim Cubify8 has an MCP server or account integration yet.
`

export const agentDocsCacheControl = "public, max-age=3600"
