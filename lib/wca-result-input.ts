/** Parse and format user-entered WCA results (solve times / FMC). */

export type ResultInputKind = "time" | "fmc-single" | "fmc-average" | "unsupported"

export function resultInputKind(eventId: string, rankType: "single" | "average"): ResultInputKind {
  if (eventId === "333mbf" || eventId === "333mbo") return "unsupported"
  if (eventId === "333fm") return rankType === "average" ? "fmc-average" : "fmc-single"
  return "time"
}

export function resultInputPlaceholder(eventId: string, rankType: "single" | "average"): string {
  const kind = resultInputKind(eventId, rankType)
  if (kind === "fmc-single") return "25"
  if (kind === "fmc-average") return "25.00"
  if (kind === "unsupported") return "Not supported yet"
  return "8.50 or 1:05.32"
}

export function resultInputHint(eventId: string, rankType: "single" | "average"): string {
  const kind = resultInputKind(eventId, rankType)
  if (kind === "fmc-single") return "Official fewest-moves single (move count)"
  if (kind === "fmc-average") return "Official FMC average (e.g. 25.00 moves)"
  if (kind === "unsupported") return "Multi-blind input is not supported in Goal yet"
  return rankType === "average"
    ? "Official average PB (as WCA ranks averages), not a single solve"
    : "Official single PB time"
}

/**
 * Parse a user string into WCA `best` units.
 * - time events: centiseconds
 * - 333fm single: moves
 * - 333fm average: 100× moves
 */
export function parseResultInput(
  eventId: string,
  rankType: "single" | "average",
  raw: string,
): number | null {
  const text = raw.trim().toLowerCase().replace(/,/g, ".")
  if (!text) return null

  const kind = resultInputKind(eventId, rankType)
  if (kind === "unsupported") return null

  if (kind === "fmc-single") {
    if (!/^\d+$/.test(text)) return null
    const moves = Number(text)
    if (!Number.isInteger(moves) || moves <= 0 || moves > 999) return null
    return moves
  }

  if (kind === "fmc-average") {
    if (!/^\d+(\.\d{1,2})?$/.test(text)) return null
    const moves = Number(text)
    if (!Number.isFinite(moves) || moves <= 0 || moves > 999) return null
    return Math.round(moves * 100)
  }

  // time: ss.cc | m:ss.cc | m:ss | ss
  const cleaned = text.replace(/s$/i, "").trim()
  let totalSeconds: number

  if (cleaned.includes(":")) {
    const parts = cleaned.split(":")
    if (parts.length !== 2) return null
    const minutes = Number(parts[0])
    const seconds = Number(parts[1])
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 599) return null
    if (seconds < 0 || seconds >= 60) return null
    // Allow 1:05 or 1:05.32
    if (!/^\d+$/.test(parts[0])) return null
    if (!/^\d{1,2}(\.\d{1,2})?$/.test(parts[1])) return null
    totalSeconds = minutes * 60 + seconds
  } else {
    if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null
    totalSeconds = Number(cleaned)
    if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return null
  }

  if (totalSeconds <= 0 || totalSeconds >= 600_000) return null
  const centiseconds = Math.round(totalSeconds * 100)
  if (!Number.isInteger(centiseconds) || centiseconds <= 0) return null
  return centiseconds
}

/** Format a WCA best back into an editable input-ish string (time/FMC only). */
export function formatResultInputValue(
  eventId: string,
  rankType: "single" | "average",
  best: number,
): string {
  if (!Number.isFinite(best) || best <= 0) return ""
  const kind = resultInputKind(eventId, rankType)
  if (kind === "fmc-single") return String(best)
  if (kind === "fmc-average") return (best / 100).toFixed(2)
  if (kind === "unsupported") return ""

  const totalSeconds = best / 100
  if (totalSeconds < 60) {
    return trimTrailingZeros(totalSeconds.toFixed(2))
  }
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds - minutes * 60
  const sec = seconds.toFixed(2).padStart(5, "0")
  return `${minutes}:${sec}`
}

function trimTrailingZeros(value: string): string {
  return value.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "")
}
