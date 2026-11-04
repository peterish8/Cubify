import assert from "node:assert/strict"
import test, { afterEach } from "node:test"

import { POST as reportPost } from "../app/api/v1/reports/route"
import { resetWcaCache } from "../lib/wca-cache"

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  resetWcaCache()
})

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } })
}

function personPayload(wcaId: string, name: string, records: Record<string, unknown> = {}) {
  return { person: { name, wca_id: wcaId, country: { name: "India", iso2: "IN", continent_id: "_Asia" } }, competition_count: 4, total_solves: 80, personal_records: records }
}

function record(single: number, average: number) {
  return { single: { best: single, world_rank: 10, continent_rank: 5, country_rank: 2 }, average: { best: average, world_rank: 12, continent_rank: 6, country_rank: 3 } }
}

async function bodyOf(response: Response) {
  return await response.json() as Record<string, any>
}

test("one registrant's failed /users/:id lookup is folded in as unknown strength, not a total failure", async () => {
  globalThis.fetch = async (input) => {
    const path = new URL(String(input)).pathname
    if (path === "/api/v0/competitions/Flaky2026") return jsonResponse({ id: "Flaky2026", name: "Flaky Open", start_date: "2026-10-01", end_date: "2026-10-02", city: "Bengaluru", event_ids: ["333"], url: "https://www.worldcubeassociation.org/competitions/Flaky2026" })
    if (path === "/api/v0/competitions/Flaky2026/registrations") return jsonResponse([
      { user_id: 1, event_ids: ["333"] },
      { user_id: 2, event_ids: ["333"] },
      { user_id: 3, event_ids: ["333"] },
    ])
    if (path === "/api/v0/users/1") return jsonResponse({ user: { wca_id: "2022TEST01", name: "You", gender: "m", country_iso2: "IN" } })
    // Registrant 2's upstream lookup is persistently broken -- this used to
    // throw inside Promise.all and abort the entire report (502/504).
    if (path === "/api/v0/users/2") return jsonResponse({ error: "boom" }, 500)
    if (path === "/api/v0/users/3") return jsonResponse({ user: { wca_id: "2020OTHER01", name: "Other", gender: "m", country_iso2: "IN" } })
    if (path.startsWith("/api/v0/persons/")) return jsonResponse(personPayload(path.split("/").pop() ?? "", "Someone", { "333": record(900, 1000) }))
    throw new Error(`Unexpected WCA request: ${path}`)
  }

  const response = await reportPost(new Request("http://localhost/api/v1/reports", { method: "POST", body: JSON.stringify({ competitionUrl: "https://www.worldcubeassociation.org/competitions/Flaky2026/registrations", competitorWcaId: "2022TEST01", eventIds: ["333"] }) }))
  const payload = await bodyOf(response)

  assert.equal(response.status, 200)
  const event = payload.data.byEvent[0]
  assert.equal(event.registeredCount, 3)
  assert.equal(event.unknownStrengthCount, 1)
  const failedEntry = event.competitors.find((entry: any) => entry.lookupFailed)
  assert.ok(failedEntry, "the failed lookup should still appear as a competitor, not be dropped")
  assert.equal(failedEntry.wcaId, null)
  assert.equal(failedEntry.firstTime, false, "a lookup failure must never be reported as a confirmed first-timer")
  assert.ok(payload.data.warnings.some((warning: any) => warning.code === "COMPETITOR_LOOKUP_FAILED" && warning.count === 1))
})

test("a failed person (PB) lookup for an otherwise-known registrant is also surfaced as a warning, never as a weak result", async () => {
  globalThis.fetch = async (input) => {
    const path = new URL(String(input)).pathname
    if (path === "/api/v0/competitions/Flaky2027") return jsonResponse({ id: "Flaky2027", name: "Flaky Open 2027", start_date: "2027-10-01", end_date: "2027-10-02", city: "Bengaluru", event_ids: ["333"], url: "https://www.worldcubeassociation.org/competitions/Flaky2027" })
    if (path === "/api/v0/competitions/Flaky2027/registrations") return jsonResponse([
      { user_id: 1, event_ids: ["333"] },
      { user_id: 2, event_ids: ["333"] },
    ])
    if (path === "/api/v0/users/1") return jsonResponse({ user: { wca_id: "2022TEST01", name: "You", gender: "m", country_iso2: "IN" } })
    if (path === "/api/v0/users/2") return jsonResponse({ user: { wca_id: "2021RIVAL01", name: "Rival", gender: "f", country_iso2: "IN" } })
    if (path === "/api/v0/persons/2022TEST01") return jsonResponse(personPayload("2022TEST01", "You", { "333": record(900, 1000) }))
    // Rival has a WCA ID, but their person record is persistently unavailable.
    if (path === "/api/v0/persons/2021RIVAL01") return jsonResponse({ error: "boom" }, 503)
    throw new Error(`Unexpected WCA request: ${path}`)
  }

  const response = await reportPost(new Request("http://localhost/api/v1/reports", { method: "POST", body: JSON.stringify({ competitionUrl: "https://www.worldcubeassociation.org/competitions/Flaky2027/registrations", competitorWcaId: "2022TEST01", eventIds: ["333"] }) }))
  const payload = await bodyOf(response)

  assert.equal(response.status, 200)
  const rival = payload.data.byEvent[0].competitors.find((entry: any) => entry.wcaId === "2021RIVAL01")
  assert.equal(rival.personalBests.single, null)
  assert.equal(rival.personalBests.average, null)
  assert.equal(rival.firstTime, false, "a known WCA ID whose PBs failed to load is not a first-timer")
  assert.ok(payload.data.warnings.some((warning: any) => warning.code === "COMPETITOR_LOOKUP_FAILED" && warning.count === 1))
})
