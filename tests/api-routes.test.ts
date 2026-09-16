import assert from "node:assert/strict"
import test, { afterEach } from "node:test"

import { GET as competitorGet } from "../app/api/v1/competitors/[wcaId]/route"
import { OPTIONS as competitorOptions } from "../app/api/v1/competitors/[wcaId]/route"
import { POST as comparePost, OPTIONS as compareOptions } from "../app/api/v1/comparisons/route"
import { POST as goalPost } from "../app/api/v1/goals/projection/route"
import { POST as reportPost } from "../app/api/v1/reports/route"
import { GET as agentReportGet } from "../app/api/v1/agent/competition-report/route"
import { competitionId } from "../lib/report-utils"

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function personPayload(wcaId: string, name: string, records: Record<string, unknown> = {}) {
  return {
    person: {
      name,
      wca_id: wcaId,
      country: { name: "India", iso2: "IN", continent_id: "_Asia" },
    },
    competition_count: 4,
    total_solves: 80,
    personal_records: records,
  }
}

function record(single: number, average: number) {
  return {
    single: { best: single, world_rank: 10, continent_rank: 5, country_rank: 2 },
    average: { best: average, world_rank: 12, continent_rank: 6, country_rank: 3 },
  }
}

async function bodyOf(response: Response) {
  return await response.json() as Record<string, any>
}

test("WCA competition URLs are restricted to official HTTPS pages", () => {
  assert.equal(competitionId("https://www.worldcubeassociation.org/competitions/Test2026/registrations"), "Test2026")
  assert.equal(competitionId("https://worldcubeassociation.org/competitions/Test2026"), "Test2026")
  assert.throws(() => competitionId("http://www.worldcubeassociation.org/competitions/Test2026"), /official World Cube Association HTTPS URL/)
  assert.throws(() => competitionId("https://www.worldcubeassociation.org.evil.example/competitions/Test2026"), /official World Cube Association HTTPS URL/)
  assert.throws(() => competitionId("not a url"), /valid HTTPS URL/)
})

test("invalid competitor IDs return a structured 400 without contacting WCA", async () => {
  let called = false
  globalThis.fetch = async () => {
    called = true
    return jsonResponse({})
  }
  const response = await competitorGet(new Request("http://localhost/api/v1/competitors/nope"), { params: { wcaId: "nope" } })
  const payload = await bodyOf(response)
  assert.equal(response.status, 400)
  assert.equal(payload.error.code, "invalid_request")
  assert.equal(called, false)
})

test("competitor lookup maps WCA not-found responses and exposes CORS safely", async () => {
  globalThis.fetch = async () => jsonResponse({ error: "missing" }, 404)
  const response = await competitorGet(new Request("http://localhost/api/v1/competitors/2022TEST01"), { params: { wcaId: "2022TEST01" } })
  const payload = await bodyOf(response)
  assert.equal(response.status, 404)
  assert.equal(payload.error.code, "not_found")
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*")
  assert.match(payload.error.message, /Player 2022TEST01 not found/)
})

test("comparison validates objects, rejects self-comparisons, and returns event winners", async () => {
  let calls = 0
  globalThis.fetch = async (input) => {
    calls += 1
    const id = new URL(String(input)).pathname.split("/").pop() ?? ""
    const isA = id === "2022AAAA01"
    const ranking = record(isA ? 900 : 1000, isA ? 1000 : 1100)
    ranking.single.world_rank = isA ? 5 : 10
    ranking.average.world_rank = isA ? 6 : 12
    return jsonResponse(personPayload(id, isA ? "A" : "B", { "333": ranking }))
  }
  const selfResponse = await comparePost(new Request("http://localhost/api/v1/comparisons", { method: "POST", body: JSON.stringify({ wcaIdA: "2022AAAA01", wcaIdB: "2022AAAA01" }) }))
  assert.equal(selfResponse.status, 400)
  assert.equal(calls, 0)

  const response = await comparePost(new Request("http://localhost/api/v1/comparisons", { method: "POST", body: JSON.stringify({ wcaIdA: "2022AAAA01", wcaIdB: "2022BBBB01" }) }))
  const payload = await bodyOf(response)
  assert.equal(response.status, 200)
  assert.equal(payload.data.events[0].eventId, "333")
  assert.equal(payload.data.events[0].slots[0].winner, "a")
  assert.equal(payload.data.competitors.a.wcaId, "2022AAAA01")
})

test("goal rejects numeric strings and out-of-range values at the API boundary", async () => {
  let called = false
  globalThis.fetch = async () => {
    called = true
    return jsonResponse({})
  }
  const response = await goalPost(new Request("http://localhost/api/v1/goals/projection", { method: "POST", body: JSON.stringify({ wcaId: "2022TEST01", eventId: "333", rankType: "single", hypotheticalBest: "900" }) }))
  const payload = await bodyOf(response)
  assert.equal(response.status, 400)
  assert.equal(payload.error.code, "invalid_request")
  assert.equal(called, false)
})

test("malformed JSON is a client error with a safe response", async () => {
  const response = await comparePost(new Request("http://localhost/api/v1/comparisons", { method: "POST", body: "{" }))
  const payload = await bodyOf(response)
  assert.equal(response.status, 400)
  assert.equal(payload.error.code, "invalid_request")
  assert.equal(response.headers.get("Cache-Control"), "no-store")
})

test("competition reports return shared PB standings and theoretical best event", async () => {
  const people: Record<string, unknown> = {
    "2022TEST01": personPayload("2022TEST01", "You", { "333": record(1000, 1100), "222": record(200, 250) }),
    "2021RIVAL01": personPayload("2021RIVAL01", "Rival", { "333": record(900, 1000) }),
    "2020OTHER01": personPayload("2020OTHER01", "Other", { "222": record(210, 260) }),
  }
  globalThis.fetch = async (input) => {
    const url = new URL(String(input))
    if (url.pathname === "/api/v0/competitions/Test2026") return jsonResponse({ id: "Test2026", name: "Test Open", start_date: "2026-10-01", end_date: "2026-10-02", city: "Bengaluru", event_ids: ["333", "222"], url: "https://www.worldcubeassociation.org/competitions/Test2026" })
    if (url.pathname === "/api/v0/competitions/Test2026/registrations") return jsonResponse([
      { user_id: 1, event_ids: ["333", "222"] },
      { user_id: 2, event_ids: ["333"] },
      { user_id: 3, event_ids: ["222"] },
      { user_id: 4, event_ids: ["333"] },
    ])
    if (url.pathname === "/api/v0/users/1") return jsonResponse({ user: { wca_id: "2022TEST01", name: "You", gender: "m", country_iso2: "IN" } })
    if (url.pathname === "/api/v0/users/2") return jsonResponse({ user: { wca_id: "2021RIVAL01", name: "Rival", gender: "f", country_iso2: "IN" } })
    if (url.pathname === "/api/v0/users/3") return jsonResponse({ user: { wca_id: "2020OTHER01", name: "Other", gender: "m", country_iso2: "IN" } })
    if (url.pathname === "/api/v0/users/4") return jsonResponse({ user: { wca_id: null, name: "First Timer", gender: "o", country_iso2: "IN" } })
    if (url.pathname.startsWith("/api/v0/persons/")) return jsonResponse(people[url.pathname.split("/").pop() ?? ""] ?? {})
    throw new Error(`Unexpected WCA request: ${url.pathname}`)
  }

  const response = await reportPost(new Request("http://localhost/api/v1/reports", { method: "POST", body: JSON.stringify({ competitionUrl: "https://www.worldcubeassociation.org/competitions/Test2026/registrations", competitorWcaId: "2022TEST01", eventIds: ["333", "222"] }) }))
  const payload = await bodyOf(response)
  assert.equal(response.status, 200)
  assert.deepEqual(payload.data.requestedEvents, ["333", "222"])
  assert.equal(payload.data.personalized.sharedEventIds.length, 2)
  assert.equal(payload.data.byEvent[0].myStanding.single.position, 2)
  assert.equal(payload.data.personalized.theoreticalBestEvent.bySingle.eventId, "222")
  assert.equal(payload.data.personalized.sharedCompetitors.find((entry: any) => entry.firstTime)?.name, "First Timer")
})

test("agent competition report makes one Cubify request sufficient and keeps uncertainty explicit", async () => {
  const people: Record<string, unknown> = {
    "2022TEST01": personPayload("2022TEST01", "You", { "333": record(1000, 1100) }),
    "2021RIVAL01": personPayload("2021RIVAL01", "Rival", { "333": record(900, 1000) }),
  }
  globalThis.fetch = async (input) => {
    const path = new URL(String(input)).pathname
    if (path === "/api/v0/competitions/Test2026") return jsonResponse({ id: "Test2026", name: "Test Open", start_date: "2026-10-01", end_date: "2026-10-02", city: "Bengaluru", event_ids: ["333"], url: "https://www.worldcubeassociation.org/competitions/Test2026" })
    if (path === "/api/v0/competitions/Test2026/registrations") return jsonResponse([{ user_id: 1, event_ids: ["333"] }, { user_id: 2, event_ids: ["333"] }, { user_id: 3, event_ids: ["333"] }])
    if (path === "/api/v0/users/1") return jsonResponse({ user: { wca_id: "2022TEST01", name: "You", gender: "m", country_iso2: "IN" } })
    if (path === "/api/v0/users/2") return jsonResponse({ user: { wca_id: "2021RIVAL01", name: "Rival", gender: "f", country_iso2: "IN" } })
    if (path === "/api/v0/users/3") return jsonResponse({ user: { wca_id: null, name: "First Timer", gender: "o", country_iso2: "IN" } })
    if (path.startsWith("/api/v0/persons/")) return jsonResponse(people[path.split("/").pop() ?? ""] ?? {})
    throw new Error(`Unexpected WCA request: ${path}`)
  }
  const response = await agentReportGet(new Request("http://localhost/api/v1/agent/competition-report?competitionId=Test2026&wcaId=2022TEST01&events=333,333oh"))
  const payload = await bodyOf(response)
  assert.equal(response.status, 200)
  assert.equal(payload.events["333"].field.firstTimers, 1)
  assert.equal(payload.events["333"].user.pbAveragePosition, 2)
  assert.equal(payload.events["333"].keyOpponents[0].rankingRelativeToUser, "ahead")
  assert.equal(payload.events["333"].user.pbAverageDisplay, "11.00s")
  assert.equal(payload.events["333"].firstTimers[0].strength, "unknown")
  assert.equal(payload.request.eventStates[1].status, "EVENT_NOT_AT_COMPETITION")
  assert.equal(payload.events["333"].opponents, undefined)
  assert.equal(payload.status, "partial")
  assert.ok(payload.generatedAt)
})

test("CORS preflight is explicit for public API clients", () => {
  assert.equal(competitorOptions().status, 204)
  assert.equal(compareOptions().headers.get("Access-Control-Allow-Methods"), "GET, POST, OPTIONS")
})
