import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  aggregateSolveActivity,
  countTakenAttempts,
  fetchWcaPerson,
  fetchWcaPersonSolveActivity,
} from "../lib/wca-person"

describe("countTakenAttempts", () => {
  it("counts valid times and DNF, skips DNS and empty slots", () => {
    // format a: 5 slots — one DNS (-2), one empty (0), one DNF (-1), two times
    assert.equal(countTakenAttempts([1525, 1516, -1, -2, 0]), 3)
  })

  it("returns 0 for missing / empty arrays", () => {
    assert.equal(countTakenAttempts(undefined), 0)
    assert.equal(countTakenAttempts(null), 0)
    assert.equal(countTakenAttempts([]), 0)
  })
})

describe("aggregateSolveActivity", () => {
  it("picks the event with the most solves and counts competitions per event", () => {
    const rows = [
      {
        event_id: "333",
        competition_id: "CompA",
        attempts: [1000, 1100, 1200, 1300, 900],
      },
      {
        event_id: "333",
        competition_id: "CompB",
        attempts: [950, 960, 970, 980, 940],
      },
      {
        event_id: "pyram",
        competition_id: "CompA",
        attempts: [300, 310, 290, 0, 0],
      },
      {
        event_id: "pyram",
        competition_id: "CompC",
        attempts: [280, 285, 275, 0, 0],
      },
      {
        event_id: "pyram",
        competition_id: "CompD",
        attempts: [270, 260, 250, 0, 0],
      },
    ]

    const result = aggregateSolveActivity(rows)
    // 333: 10 solves, 2 comps · pyram: 9 solves, 3 comps → 333 wins on solves
    assert.equal(result.mostSolved?.eventId, "333")
    assert.equal(result.mostSolved?.solves, 10)
    assert.equal(result.mostSolved?.competitions, 2)

    const pyram = result.byEvent.find((e) => e.eventId === "pyram")
    assert.equal(pyram?.solves, 9)
    assert.equal(pyram?.competitions, 3)
    assert.equal(result.competitionCount, 4) // CompA–D
    assert.equal(result.totalSolves, 19)
  })

  it("breaks ties by more competitions, then event id", () => {
    const rows = [
      { event_id: "skewb", competition_id: "A", attempts: [100, 100, 100] },
      { event_id: "pyram", competition_id: "A", attempts: [100, 100, 100] },
      { event_id: "pyram", competition_id: "B", attempts: [100, 100, 100] },
    ]
    // skewb 3 solves / 1 comp · pyram 6 solves / 2 comps
    const a = aggregateSolveActivity(rows)
    assert.equal(a.mostSolved?.eventId, "pyram")

    // equal solves: more comps wins
    const tied = aggregateSolveActivity([
      { event_id: "zzz", competition_id: "A", attempts: [1, 1, 1] },
      { event_id: "aaa", competition_id: "A", attempts: [1, 1, 1] },
      { event_id: "aaa", competition_id: "B", attempts: [0, 0, 0] }, // 0 solves but +1 comp
    ])
    // aaa: 3 solves, 2 comps · zzz: 3 solves, 1 comp
    assert.equal(tied.mostSolved?.eventId, "aaa")
    assert.equal(tied.mostSolved?.competitions, 2)
  })

  it("returns empty for empty input", () => {
    const empty = aggregateSolveActivity([])
    assert.equal(empty.mostSolved, null)
    assert.equal(empty.totalSolves, 0)
    assert.equal(empty.competitionCount, 0)
  })
})

describe("WCA person fetch activity fields", () => {
  const originalFetch = globalThis.fetch

  it("maps competition_count and total_solves from the person payload", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          person: {
            name: "Activity Cuber",
            wca_id: "2026ACTI01",
            country: { name: "India", iso2: "IN", continent_id: "_Asia" },
          },
          competition_count: 12,
          total_solves: 345,
          personal_records: {
            "333": {
              single: { best: 900, world_rank: 50, continent_rank: 10, country_rank: 2 },
            },
          },
        }),
        { status: 200 },
      )) as typeof fetch

    try {
      const person = await fetchWcaPerson("2026acti01")
      assert.equal(person.competitionCount, 12)
      assert.equal(person.totalSolves, 345)
      assert.equal(person.country.iso2, "IN")
      assert.equal(person.personal_records["333"].single?.world_ranking, 50)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("fetches /results and aggregates solve activity", async () => {
    const urls: string[] = []
    globalThis.fetch = (async (input: string | URL | Request) => {
      urls.push(String(input))
      return new Response(
        JSON.stringify([
          { event_id: "333", competition_id: "A", attempts: [1, 1, 1, 1, 1] },
          { event_id: "222", competition_id: "B", attempts: [1, 1, 0, -2, -1] },
        ]),
        { status: 200 },
      )
    }) as typeof fetch

    try {
      const activity = await fetchWcaPersonSolveActivity("2026acti01")
      assert.equal(urls[0], "https://www.worldcubeassociation.org/api/v0/persons/2026ACTI01/results")
      assert.equal(activity.mostSolved?.eventId, "333")
      assert.equal(activity.totalSolves, 8)
      assert.equal(activity.competitionCount, 2)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
