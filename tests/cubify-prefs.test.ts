import assert from "node:assert/strict"
import test from "node:test"

import {
  DEFAULT_CUSTOM_CURSOR,
  DEFAULT_SMOOTH_SCROLL,
  readCustomCursorPref,
  readSmoothScrollPref,
  writeCustomCursorPref,
  writeSmoothScrollPref,
} from "../lib/cubify-prefs"

function installStorage(): () => void {
  const store = new Map<string, string>()
  ;(globalThis as any).window = {
    localStorage: {
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
      removeItem: (key: string) => {
        store.delete(key)
      },
    },
  }
  return () => {
    delete (globalThis as any).window
  }
}

test("prefs default to on when unset", () => {
  const cleanup = installStorage()
  try {
    assert.equal(readCustomCursorPref(), DEFAULT_CUSTOM_CURSOR)
    assert.equal(readSmoothScrollPref(), DEFAULT_SMOOTH_SCROLL)
  } finally {
    cleanup()
  }
})

test("prefs round-trip through localStorage", () => {
  const cleanup = installStorage()
  try {
    writeCustomCursorPref(false)
    assert.equal(readCustomCursorPref(), false)
    writeCustomCursorPref(true)
    assert.equal(readCustomCursorPref(), true)

    writeSmoothScrollPref(false)
    assert.equal(readSmoothScrollPref(), false)
    writeSmoothScrollPref(true)
    assert.equal(readSmoothScrollPref(), true)
  } finally {
    cleanup()
  }
})

test("reads fall back to defaults without a window (SSR)", () => {
  delete (globalThis as any).window
  assert.equal(readCustomCursorPref(), DEFAULT_CUSTOM_CURSOR)
  assert.equal(readSmoothScrollPref(), DEFAULT_SMOOTH_SCROLL)
})
