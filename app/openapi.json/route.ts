import { NextResponse } from "next/server"

const wcaId = { type: "string", example: "2022RPRA01" }

const errorSchema = {
  type: "object",
  required: ["error"],
  properties: {
    error: {
      type: "object",
      required: ["code", "message", "status", "requestId"],
      properties: {
        code: { type: "string", enum: ["invalid_request", "not_found", "upstream_unavailable", "upstream_timeout", "upstream_invalid", "internal_error"] },
        message: { type: "string" },
        status: { type: "integer" },
        requestId: { type: "string", description: "Opaque identifier for this request; include it when reporting an issue.", example: "req_abc123xyz0" },
        upstream: {
          type: "object",
          nullable: true,
          description: "Present when the failure originated from the WCA data source rather than Cubify itself.",
          properties: {
            service: { type: "string", example: "wca" },
            status: { type: "integer", nullable: true, description: "HTTP status returned by the upstream call, or null if it never returned (timeout/network error)." },
            endpoint: { type: "string", example: "/persons/2022RPRA01" },
            durationMs: { type: "integer" },
          },
        },
      },
    },
  },
}

const warningSchema = { type: "object", required: ["code", "message"], properties: { code: { type: "string" }, message: { type: "string" }, count: { type: "integer" } } }

const sourceSchema = {
  type: "object",
  properties: {
    registrations: { type: "string", format: "uri" },
    provider: { type: "string", example: "World Cube Association" },
    cachedAt: { type: "string", format: "date-time", description: "When the oldest upstream resource backing this response was fetched. Equal to generatedAt on a fully cold request." },
    stale: { type: "boolean", description: "True if any upstream resource could not be freshly refetched and a cached-but-expired copy was served instead." },
  },
}

const personalBestsSchema = { type: "object", properties: { single: { type: "integer", nullable: true }, average: { type: "integer", nullable: true } } }

const errorResponses = {
  "400": { description: "The request was malformed or failed validation (bad competitionUrl, wcaId, eventIds, etc.)", content: { "application/json": { schema: errorSchema } } },
  "404": { description: "The requested WCA resource was not found", content: { "application/json": { schema: errorSchema } } },
  "502": { description: "The WCA data source returned an error or an invalid payload", content: { "application/json": { schema: errorSchema } } },
  "504": { description: "The WCA data source, or the overall report deadline, timed out before a response could be assembled", content: { "application/json": { schema: errorSchema } } },
}

const reportResponseSchema = {
  type: "object",
  properties: {
    data: {
      type: "object",
      properties: {
        competition: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, dates: { type: "array", items: { type: "string", format: "date" } }, city: { type: "string" }, eventIds: { type: "array", items: { type: "string" } }, url: { type: "string", format: "uri" } } },
        requestedEvents: { type: "array", items: { type: "string" } },
        byEvent: { type: "array", items: { type: "object" }, description: "Per-event field standings, competitor PBs, and comparisons." },
        personalized: { type: "object", nullable: true, description: "Present only when competitorWcaId identifies an accepted registrant." },
        warnings: { type: "array", items: warningSchema },
      },
    },
    source: sourceSchema,
    generatedAt: { type: "string", format: "date-time" },
  },
}

const agentReportResponseSchema = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["partial"], description: "Always partial: placement/podium prediction is intentionally never computed from PB rank alone." },
    warnings: { type: "array", items: warningSchema },
    competition: { type: "object" },
    subject: { type: "object", properties: { wcaId } },
    request: {
      type: "object",
      properties: {
        eventStates: { type: "array", items: { type: "object", properties: { eventId: { type: "string" }, eventName: { type: "string" }, status: { type: "string", enum: ["ANALYZED", "NOT_REGISTERED", "EVENT_NOT_AT_COMPETITION"] } } } },
        opponentDetail: { type: "string" },
        opponentPagination: { type: "object", nullable: true, properties: { offset: { type: "integer" }, limit: { type: "integer" } } },
      },
    },
    events: {
      type: "object",
      additionalProperties: {
        type: "object",
        properties: {
          eventName: { type: "string" },
          field: { type: "object", properties: { registered: { type: "integer" }, ranked: { type: "integer" }, firstTimers: { type: "integer" }, unknownStrength: { type: "integer" }, rankingBasis: { type: "string", enum: ["best-average"] } } },
          user: {
            type: "object",
            properties: {
              pbSingle: { type: "integer", nullable: true },
              pbAverage: { type: "integer", nullable: true },
              pbSingleDisplay: { type: "string", nullable: true, example: "6.75s" },
              pbAverageDisplay: { type: "string", nullable: true, example: "9.22s" },
              pbSinglePosition: { type: "integer", nullable: true },
              pbAveragePosition: { type: "integer", nullable: true },
              possibleOverallRange: { type: "object", nullable: true, properties: { best: { type: "integer" }, worst: { type: "integer" }, basis: { type: "string" } } },
            },
          },
          opponentCounts: { type: "object", properties: { ahead: { type: "integer" }, behind: { type: "integer" }, unknown: { type: "integer" } } },
          keyOpponents: { type: "array", items: { type: "object", properties: { wcaId: { type: "string", nullable: true }, name: { type: "string" }, pb: personalBestsSchema, pbDisplay: { type: "object", properties: { single: { type: "string", nullable: true }, average: { type: "string", nullable: true } } }, firstTimer: { type: "boolean" }, strength: { type: "string", enum: ["known", "unknown"] }, rankingRelativeToUser: { type: "string", enum: ["ahead", "behind", "unknown"] } } } },
          opponents: { type: "array", items: { type: "object" }, description: "Present only with include=all." },
          opponentPagination: { type: "object", nullable: true, properties: { offset: { type: "integer" }, limit: { type: "integer" }, total: { type: "integer" }, returned: { type: "integer" }, hasMore: { type: "boolean" } } },
          recentForm: { type: "object", nullable: true },
          roundPlan: { type: "object", nullable: true },
          firstTimers: { type: "array", items: { type: "object" } },
        },
      },
    },
    methodology: { type: "string" },
    resultEncoding: { type: "string" },
    source: sourceSchema,
    generatedAt: { type: "string", format: "date-time" },
  },
}

const healthResponseSchema = {
  type: "object",
  properties: {
    data: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["ok"] },
        cubify: { type: "string", enum: ["ok"] },
        wca: { type: "object", properties: { reachable: { type: "boolean" }, status: { type: "integer", nullable: true }, durationMs: { type: "integer" }, stale: { type: "boolean" }, checkedAt: { type: "string", format: "date-time" } } },
        generatedAt: { type: "string", format: "date-time" },
      },
    },
  },
}

export function GET() {
  return NextResponse.json({
    openapi: "3.1.0",
    info: { title: "Cubify8 API", version: "0.1.1", description: "Public V1 endpoints for WCA competitor intelligence. Responses include source and generatedAt metadata. Every error response carries a stable `error.code`, a `requestId`, and -- when the failure came from WCA rather than Cubify -- an `error.upstream` block with the upstream endpoint, status, and timing." },
    servers: [{ url: "https://cubify.in" }],
    components: { schemas: { Error: errorSchema } },
    paths: {
      "/api/v1/health": { get: { summary: "Cubify and upstream WCA reachability", description: "Cheap, cached (30s) check of Cubify's own status and whether the public WCA API is currently reachable. Use this to distinguish a Cubify incident from a WCA-side outage before filing a bug.", responses: { "200": { description: "Successful response", content: { "application/json": { schema: healthResponseSchema } } } } } },
      "/api/v1/competitors/{wcaId}": { get: { summary: "Lookup official competitor intelligence", parameters: [{ name: "wcaId", in: "path", required: true, schema: wcaId }], responses: { "200": { description: "Successful response" }, "400": errorResponses["400"], "404": errorResponses["404"], "502": errorResponses["502"], "504": errorResponses["504"] } } },
      "/api/v1/comparisons": { post: { summary: "Compare two competitors", requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["wcaIdA", "wcaIdB"], properties: { wcaIdA: wcaId, wcaIdB: wcaId } } } } }, responses: { "200": { description: "Successful response" }, "400": errorResponses["400"], "404": errorResponses["404"], "502": errorResponses["502"], "504": errorResponses["504"] } } },
      "/api/v1/goals/projection": { post: { summary: "Project rank movement from a result", requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["wcaId", "eventId", "rankType", "hypotheticalBest"], properties: { wcaId, eventId: { type: "string", example: "333" }, rankType: { type: "string", enum: ["single", "average"] }, hypotheticalBest: { type: "integer", description: "Official WCA result units", example: 1500 } } } } } }, responses: { "200": { description: "Successful response" }, "400": errorResponses["400"], "404": errorResponses["404"], "502": errorResponses["502"], "504": errorResponses["504"] } } },
      "/api/v1/reports": {
        post: {
          summary: "Create a competition intelligence report",
          description: "Fetches accepted WCA registrations for the competition and every registrant's official personal bests, then computes field standings. Shares its implementation with GET /api/v1/agent/competition-report (lib/report-service.ts), so the two cannot diverge. A registrant whose WCA record cannot be loaded (upstream flakiness) is returned as unknown strength with a `COMPETITOR_LOOKUP_FAILED` warning, never dropped or treated as weak. Target latency is under 10s warm / under 25s cold; an internal 45s deadline guarantees a structured response (never a dropped connection) even on a bad WCA day.",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["competitionUrl"], properties: { competitionUrl: { type: "string", format: "uri", example: "https://www.worldcubeassociation.org/competitions/CubeathonBengaluru2026/registrations", description: "An official WCA competition or registrations page URL. A trailing /registrations, case, and query string are all normalized." }, competitorWcaId: wcaId, eventIds: { type: "array", items: { type: "string", example: "333" }, description: "Defaults to the competitor's registered events when omitted." } } } } } },
          responses: { "200": { description: "Successful response", content: { "application/json": { schema: reportResponseSchema } } }, ...errorResponses },
        },
      },
      "/api/v1/agent/competition-report": {
        get: {
          summary: "Get a compact competition report for an AI agent",
          description: "A thin, machine-readable adapter over POST /api/v1/reports (same underlying report-service, so behavior cannot diverge). Cubify fetches official WCA registrations, competitor records, recent form, and round metadata server-side. Clients should call this endpoint directly instead of scraping or searching WCA pages.",
          parameters: [{ name: "competitionId", in: "query", required: true, schema: { type: "string", example: "CubeathonBengaluru2026" } }, { name: "wcaId", in: "query", required: true, schema: wcaId }, { name: "events", in: "query", required: false, description: "Comma-separated WCA event IDs. Defaults to the competitor's registered events.", schema: { type: "string", example: "333,222,444" } }, { name: "include", in: "query", required: false, description: "Use all to include every opponent. The default returns only the closest known rivals.", schema: { type: "string", enum: ["all"] } }, { name: "offset", in: "query", required: false, description: "Zero-based opponent offset when include=all.", schema: { type: "integer", minimum: 0, maximum: 5000, default: 0 } }, { name: "limit", in: "query", required: false, description: "Number of opponents when include=all (maximum 100).", schema: { type: "integer", minimum: 0, maximum: 100, default: 100 } }],
          responses: { "200": { description: "Successful response", content: { "application/json": { schema: agentReportResponseSchema } } }, ...errorResponses },
        },
      },
    },
  })
}
