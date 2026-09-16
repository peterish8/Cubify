import { NextResponse } from "next/server"

const success = { "200": { description: "Successful response" }, "400": { description: "Invalid request" } }
const wcaId = { type: "string", example: "2022RPRA01" }

export function GET() {
  return NextResponse.json({
    openapi: "3.1.0",
    info: { title: "Cubify8 API", version: "0.1.0", description: "Public V1 endpoints for WCA competitor intelligence. Responses include source and generatedAt metadata." },
    servers: [{ url: "https://cubify.in" }],
    paths: {
      "/api/v1/competitors/{wcaId}": { get: { summary: "Lookup official competitor intelligence", parameters: [{ name: "wcaId", in: "path", required: true, schema: wcaId }], responses: { ...success, "404": { description: "WCA ID was not found" } } } },
      "/api/v1/comparisons": { post: { summary: "Compare two competitors", requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["wcaIdA", "wcaIdB"], properties: { wcaIdA: wcaId, wcaIdB: wcaId } } } } }, responses: success } },
      "/api/v1/goals/projection": { post: { summary: "Project rank movement from a result", requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["wcaId", "eventId", "rankType", "hypotheticalBest"], properties: { wcaId, eventId: { type: "string", example: "333" }, rankType: { type: "string", enum: ["single", "average"] }, hypotheticalBest: { type: "integer", description: "Official WCA result units", example: 1500 } } } } } }, responses: success } },
      "/api/v1/reports": { post: { summary: "Create a competition intelligence report", requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["competitionUrl"], properties: { competitionUrl: { type: "string", format: "uri", example: "https://www.worldcubeassociation.org/competitions/CubeathonBengaluru2026/registrations" }, competitorWcaId: wcaId, eventIds: { type: "array", items: { type: "string", example: "333" } } } } } } }, responses: success } },
      "/api/v1/agent/competition-report": { get: { summary: "Get a compact competition report for an AI agent", parameters: [{ name: "competitionId", in: "query", required: true, schema: { type: "string", example: "CubeathonBengaluru2026" } }, { name: "wcaId", in: "query", required: true, schema: wcaId }, { name: "events", in: "query", required: false, description: "Comma-separated WCA event IDs. Defaults to the competitor's registered events.", schema: { type: "string", example: "333,222,444" } }, { name: "include", in: "query", required: false, description: "Use all to include every opponent. The default returns only the closest known rivals.", schema: { type: "string", enum: ["all"] } }], responses: { ...success, "502": { description: "WCA response was invalid or unavailable" } } } },
    },
  })
}
