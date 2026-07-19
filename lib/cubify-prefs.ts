/** Browser prefs for Cubify (not from other projects — keys are cubify-prefixed). */

export const CURSOR_STORAGE_KEY = "cubify-custom-cursor"
export const SMOOTH_SCROLL_STORAGE_KEY = "cubify-smooth-scroll"

/** Defaults: both on. */
export const DEFAULT_CUSTOM_CURSOR = true
export const DEFAULT_SMOOTH_SCROLL = true

function readBoolPref(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return fallback
    return raw === "1" || raw === "true"
  } catch {
    return fallback
  }
}

function writeBoolPref(key: string, enabled: boolean): void {
  try {
    window.localStorage.setItem(key, enabled ? "1" : "0")
  } catch {
    /* ignore quota / private mode */
  }
}

export function readCustomCursorPref(): boolean {
  return readBoolPref(CURSOR_STORAGE_KEY, DEFAULT_CUSTOM_CURSOR)
}

export function writeCustomCursorPref(enabled: boolean): void {
  writeBoolPref(CURSOR_STORAGE_KEY, enabled)
}

export function readSmoothScrollPref(): boolean {
  return readBoolPref(SMOOTH_SCROLL_STORAGE_KEY, DEFAULT_SMOOTH_SCROLL)
}

export function writeSmoothScrollPref(enabled: boolean): void {
  writeBoolPref(SMOOTH_SCROLL_STORAGE_KEY, enabled)
}
