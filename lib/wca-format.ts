/** Format official WCA personal-record `best` values for display. */

function formatTimeCentiseconds(centiseconds: number): string {
  if (!Number.isFinite(centiseconds) || centiseconds <= 0) return "—"
  const seconds = centiseconds / 100
  if (seconds < 60) return `${seconds.toFixed(2)}s`
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}:${remainder.toFixed(2).padStart(5, "0")}`
}

/** Decode new multi-blind packed result: 0DDTTTTTMM (as integer). */
export function formatMultiBlind(best: number): string {
  if (!Number.isFinite(best) || best <= 0) return "—"
  // Old format starts with 1; new format is 0DDTTTTTMM (up to 10 digits).
  if (best >= 1_000_000_000) {
    // old: 1SSAATTTTT
    const s = String(Math.trunc(best)).padStart(10, "0")
    const solved = 99 - parseInt(s.slice(1, 3), 10)
    const attempted = parseInt(s.slice(3, 5), 10)
    const timeSeconds = parseInt(s.slice(5, 10), 10)
    const timeLabel = timeSeconds === 99999 ? "?" : formatSecondsClock(timeSeconds)
    return `${solved}/${attempted} ${timeLabel}`
  }
  const s = String(Math.trunc(best)).padStart(9, "0")
  const difference = 99 - parseInt(s.slice(0, 2), 10)
  const timeSeconds = parseInt(s.slice(2, 7), 10)
  const missed = parseInt(s.slice(7, 9), 10)
  const solved = difference + missed
  const attempted = solved + missed
  const timeLabel = timeSeconds === 99999 ? "?" : formatSecondsClock(timeSeconds)
  return `${solved}/${attempted} ${timeLabel}`
}

function formatSecondsClock(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, "0")}`
}

/**
 * Format a WCA `best` field for the given event and single/average type.
 * - time events: centiseconds → e.g. 7.66s or 1:05.30
 * - 333fm single: move count
 * - 333fm average: 100× moves → e.g. 25.00 moves
 * - multi-blind: decoded solved/attempted + time
 */
export function formatResult(
  eventId: string,
  best: number,
  type: "single" | "average" = "single",
): string {
  if (!Number.isFinite(best) || best <= 0) return "—"

  if (eventId === "333fm") {
    if (type === "average") return `${(best / 100).toFixed(2)} moves`
    return `${best} moves`
  }

  if (eventId === "333mbf" || eventId === "333mbo") {
    return formatMultiBlind(best)
  }

  return formatTimeCentiseconds(best)
}
