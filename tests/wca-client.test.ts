import assert from "node:assert/strict"
import test, { afterEach } from "node:test"

import { wcaFetch, withDeadline, DeadlineExceededError } from "../lib/wca-client"

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

function jsonResponse(value: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(value), { status, headers })
}

test("wcaFetch retries a 429 and returns the eventual success", async () => {
  let calls = 0
  globalThis.fetch = async () => {
    calls += 1
    if (calls === 1) return jsonResponse({ error: "rate limited" }, 429, { "retry-after": "0" })
    return jsonResponse({ ok: true })
  }
  const response = await wcaFetch("https://example.test/resource", { retries: 2 })
  assert.equal(calls, 2)
  assert.equal(response.status, 200)
})

test("wcaFetch retries a 5xx up to the configured limit, then returns the last response", async () => {
  let calls = 0
  globalThis.fetch = async () => {
    calls += 1
    return jsonResponse({ error: "down" }, 503)
  }
  const response = await wcaFetch("https://example.test/resource", { retries: 2 })
  assert.equal(calls, 3)
  assert.equal(response.status, 503)
})

test("wcaFetch does not retry a 404 (not a transient failure)", async () => {
  let calls = 0
  globalThis.fetch = async () => {
    calls += 1
    return jsonResponse({ error: "missing" }, 404)
  }
  const response = await wcaFetch("https://example.test/resource", { retries: 2 })
  assert.equal(calls, 1)
  assert.equal(response.status, 404)
})

test("withDeadline rejects with DeadlineExceededError once the deadline elapses", async () => {
  const neverResolves = new Promise(() => {})
  await assert.rejects(withDeadline(neverResolves, 20), (error) => error instanceof DeadlineExceededError)
})

test("withDeadline resolves normally when the work finishes first", async () => {
  const fast = Promise.resolve("done")
  assert.equal(await withDeadline(fast, 1_000), "done")
})
