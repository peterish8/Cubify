import assert from "node:assert/strict"
import test from "node:test"

import { cached, resetWcaCache } from "../lib/wca-cache"

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

test("cached serves fresh values without re-calling the fetcher", async () => {
  resetWcaCache()
  let calls = 0
  const fetcher = async () => {
    calls += 1
    return "value"
  }
  const first = await cached("k1", 10_000, 10_000, fetcher)
  const second = await cached("k1", 10_000, 10_000, fetcher)
  assert.equal(calls, 1)
  assert.equal(first.stale, false)
  assert.equal(second.stale, false)
})

test("cached re-fetches once the TTL has elapsed", async () => {
  resetWcaCache()
  let calls = 0
  const fetcher = async () => {
    calls += 1
    return calls
  }
  await cached("k2", 5, 10_000, fetcher)
  await sleep(15)
  const second = await cached("k2", 5, 10_000, fetcher)
  assert.equal(calls, 2)
  assert.equal(second.value, 2)
})

test("cached serves a stale value when the upstream fetch fails (serve-stale-on-error)", async () => {
  resetWcaCache()
  let calls = 0
  const fetcher = async () => {
    calls += 1
    if (calls === 1) return "good"
    throw new Error("upstream 5xx")
  }
  const first = await cached("k3", 5, 10_000, fetcher)
  assert.equal(first.value, "good")
  await sleep(15)
  const second = await cached("k3", 5, 10_000, fetcher)
  assert.equal(second.value, "good")
  assert.equal(second.stale, true)
})

test("cached rethrows when there is no fresh or stale entry to fall back to", async () => {
  resetWcaCache()
  await assert.rejects(cached("k4", 10_000, 10_000, async () => {
    throw new Error("upstream down")
  }), /upstream down/)
})
