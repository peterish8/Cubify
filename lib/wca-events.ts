export const EVENT_NAMES: Record<string, string> = {
  "333": "3×3 Cube",
  "222": "2×2 Cube",
  "444": "4×4 Cube",
  "555": "5×5 Cube",
  "666": "6×6 Cube",
  "777": "7×7 Cube",
  "333bf": "3×3 Blindfolded",
  "333fm": "3×3 Fewest Moves",
  "333oh": "3×3 One-Handed",
  clock: "Clock",
  minx: "Megaminx",
  pyram: "Pyraminx",
  skewb: "Skewb",
  sq1: "Square-1",
  "444bf": "4×4 Blindfolded",
  "555bf": "5×5 Blindfolded",
  "333mbf": "3×3 Multi-Blind",
  "333ft": "3×3 With Feet",
  "333mbo": "3×3 Multi-Blind Old",
  magic: "Rubik's Magic",
  mmagic: "Master Magic",
}

export function eventDisplayName(eventId: string): string {
  return EVENT_NAMES[eventId] || eventId.toUpperCase()
}
