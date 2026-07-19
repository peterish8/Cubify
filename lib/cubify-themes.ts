export const THEME_STORAGE_KEY = "cubify-theme"

export const CUBIFY_THEMES = [
  {
    id: "blue",
    name: "Blue Matrix",
    description: "The default Cubify glow.",
    swatches: ["#dbeafe", "#60a5fa", "#2563eb", "#020617"],
  },
  {
    id: "green",
    name: "Emerald Circuit",
    description: "Clean green signal over black glass.",
    swatches: ["#dcfce7", "#4ade80", "#16a34a", "#02140a"],
  },
  {
    id: "pink",
    name: "Neon Sakura",
    description: "Hot pink highlights with soft bloom.",
    swatches: ["#fce7f3", "#f472b6", "#db2777", "#17040d"],
  },
  {
    id: "violet",
    name: "Violet Nebula",
    description: "Cool violet light with deep contrast.",
    swatches: ["#ede9fe", "#a78bfa", "#7c3aed", "#0d071a"],
  },
  {
    id: "orange",
    name: "Solar Core",
    description: "Warm amber energy on black chrome.",
    swatches: ["#ffedd5", "#fb923c", "#ea580c", "#160a02"],
  },
  {
    id: "purple",
    name: "Royal Pulse",
    description: "Purple-blue neon with polished depth.",
    swatches: ["#f3e8ff", "#c084fc", "#9333ea", "#10051a"],
  },
  {
    id: "dark-blue",
    name: "Abyss Drive",
    description: "Deeper blue, quieter and sharper.",
    swatches: ["#dbeafe", "#38bdf8", "#1e40af", "#020617"],
  },
  {
    id: "tokyo-night",
    name: "tokyo night",
    description: "Ink blue with lavender and cyan accents.",
    swatches: ["#c0caf5", "#7aa2f7", "#bb9af7", "#1a1b26"],
  },
] as const

export type CubifyThemeId = (typeof CUBIFY_THEMES)[number]["id"]

export const DEFAULT_THEME: CubifyThemeId = "blue"

export function isCubifyTheme(value: string | null): value is CubifyThemeId {
  return CUBIFY_THEMES.some((theme) => theme.id === value)
}
