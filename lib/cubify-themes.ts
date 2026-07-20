export const THEME_STORAGE_KEY = "cubify-theme"

export type ThemeShade = "lighter" | "darker" | "deep"

export type CubifyThemeVariant = {
  id: string
  shade: ThemeShade
  /** Short chip label in the family panel */
  shadeLabel: string
  name: string
  description: string
  swatches: readonly [string, string, string, string]
}

export type CubifyThemeFamily = {
  id: string
  name: string
  description: string
  /** Representative hue for the closed family chip */
  preview: string
  variants: readonly CubifyThemeVariant[]
}

/**
 * Color families: each opens to lighter / darker shades of the *dark* stage
 * (not a light-mode theme — just brighter vs deeper glow on black).
 *
 * Blue keeps its original ladder.
 * Other families: NEW even-lighter shade, previous “lighter” promoted to Darker,
 * previous “darker” becomes Deep.
 */
export const THEME_FAMILIES = [
  {
    id: "blue",
    name: "Blue",
    description: "Cubify’s signature electric blue family.",
    preview: "#93c5fd",
    variants: [
      {
        id: "blue-pastel",
        shade: "lighter",
        shadeLabel: "Lighter",
        name: "Blue Pastel",
        description: "Soft sky-blue pastel glow on pure black.",
        swatches: ["#eff6ff", "#bfdbfe", "#93c5fd", "#040810"],
      },
      {
        id: "blue",
        shade: "darker",
        shadeLabel: "Darker",
        name: "Blue Matrix",
        description: "Default Cubify glow — classic electric blue center.",
        swatches: ["#dbeafe", "#60a5fa", "#3b82f6", "#020617"],
      },
      {
        id: "blue-midnight",
        shade: "deep",
        shadeLabel: "Deep",
        name: "Midnight Core",
        description: "Near-ink blue. Maximum depth, minimal bloom.",
        swatches: ["#93c5fd", "#3b82f6", "#172554", "#000208"],
      },
    ],
  },
  {
    id: "green",
    name: "Green",
    description: "Emerald circuit energy.",
    preview: "#86efac",
    variants: [
      {
        id: "green-bright",
        shade: "lighter",
        shadeLabel: "Lighter",
        name: "Mint Pastel",
        description: "Soft mint pastel glow — airy, still on black glass.",
        swatches: ["#f0fdf4", "#bbf7d0", "#86efac", "#04140a"],
      },
      {
        id: "green",
        shade: "darker",
        shadeLabel: "Darker",
        name: "Emerald Circuit",
        description: "Classic green signal over black glass (former lighter).",
        swatches: ["#dcfce7", "#4ade80", "#16a34a", "#02140a"],
      },
      {
        id: "green-dark",
        shade: "deep",
        shadeLabel: "Deep",
        name: "Forest Link",
        description: "Muted forest green — denser, less neon.",
        swatches: ["#bbf7d0", "#22c55e", "#14532d", "#010a05"],
      },
    ],
  },
  {
    id: "pink",
    name: "Pink",
    description: "Hot sakura neon.",
    preview: "#f9a8d4",
    variants: [
      {
        id: "pink-bright",
        shade: "lighter",
        shadeLabel: "Lighter",
        name: "Sakura Pastel",
        description: "Soft candy-pink pastel bloom on black.",
        swatches: ["#fdf2f8", "#fbcfe8", "#f9a8d4", "#140610"],
      },
      {
        id: "pink",
        shade: "darker",
        shadeLabel: "Darker",
        name: "Neon Sakura",
        description: "Hot pink highlights with soft bloom (former lighter).",
        swatches: ["#fce7f3", "#f472b6", "#db2777", "#17040d"],
      },
      {
        id: "pink-dark",
        shade: "deep",
        shadeLabel: "Deep",
        name: "Rose Void",
        description: "Deeper magenta — night-club bloom, quieter edges.",
        swatches: ["#fbcfe8", "#db2777", "#831843", "#0c0207"],
      },
    ],
  },
  {
    id: "violet",
    name: "Violet",
    description: "Cool nebula purple.",
    preview: "#c4b5fd",
    variants: [
      {
        id: "violet-bright",
        shade: "lighter",
        shadeLabel: "Lighter",
        name: "Lavender Pastel",
        description: "Soft lavender pastel haze on black.",
        swatches: ["#f5f3ff", "#ddd6fe", "#c4b5fd", "#0e0818"],
      },
      {
        id: "violet",
        shade: "darker",
        shadeLabel: "Darker",
        name: "Violet Nebula",
        description: "Cool violet light with deep contrast (former lighter).",
        swatches: ["#ede9fe", "#a78bfa", "#7c3aed", "#0d071a"],
      },
      {
        id: "violet-dark",
        shade: "deep",
        shadeLabel: "Deep",
        name: "Ion Shadow",
        description: "Compressed violet — more ink, less haze.",
        swatches: ["#ddd6fe", "#7c3aed", "#4c1d95", "#070312"],
      },
    ],
  },
  {
    id: "orange",
    name: "Orange",
    description: "Warm solar amber.",
    preview: "#fdba74",
    variants: [
      {
        id: "orange-bright",
        shade: "lighter",
        shadeLabel: "Lighter",
        name: "Peach Pastel",
        description: "Soft peach pastel warmth on black chrome.",
        swatches: ["#fff7ed", "#fed7aa", "#fdba74", "#120a02"],
      },
      {
        id: "orange",
        shade: "darker",
        shadeLabel: "Darker",
        name: "Solar Core",
        description: "Warm amber energy on black chrome (former lighter).",
        swatches: ["#ffedd5", "#fb923c", "#ea580c", "#160a02"],
      },
      {
        id: "orange-dark",
        shade: "deep",
        shadeLabel: "Deep",
        name: "Ember Pit",
        description: "Burnt orange — heavier heat, less flash.",
        swatches: ["#fed7aa", "#ea580c", "#7c2d12", "#0c0501"],
      },
    ],
  },
  {
    id: "gold",
    name: "Gold",
    description: "Trophy metal — WR podium glow.",
    preview: "#fbbf24",
    variants: [
      {
        id: "gold-bright",
        shade: "lighter",
        shadeLabel: "Lighter",
        name: "Champagne Pastel",
        description: "Soft champagne gold on pure black glass.",
        swatches: ["#fffbeb", "#fde68a", "#fbbf24", "#0c0902"],
      },
      {
        id: "gold",
        shade: "darker",
        shadeLabel: "Darker",
        name: "Trophy Core",
        description: "Classic medal gold — bright, clean, competitive.",
        swatches: ["#fef3c7", "#fbbf24", "#d97706", "#0a0802"],
      },
      {
        id: "gold-dark",
        shade: "deep",
        shadeLabel: "Deep",
        name: "Vault Gold",
        description: "Antique gold — deeper heat, less flash.",
        swatches: ["#fcd34d", "#b45309", "#78350f", "#050301"],
      },
    ],
  },
  {
    id: "purple",
    name: "Purple",
    description: "Royal neon pulse.",
    preview: "#d8b4fe",
    variants: [
      {
        id: "purple-bright",
        shade: "lighter",
        shadeLabel: "Lighter",
        name: "Lilac Pastel",
        description: "Soft lilac pastel pulse on black glass.",
        swatches: ["#faf5ff", "#e9d5ff", "#d8b4fe", "#10061a"],
      },
      {
        id: "purple",
        shade: "darker",
        shadeLabel: "Darker",
        name: "Royal Pulse",
        description: "Purple-blue neon with polished depth (former lighter).",
        swatches: ["#f3e8ff", "#c084fc", "#9333ea", "#10051a"],
      },
      {
        id: "purple-dark",
        shade: "deep",
        shadeLabel: "Deep",
        name: "Grape Depth",
        description: "Ink-purple glow for long sessions.",
        swatches: ["#e9d5ff", "#9333ea", "#581c87", "#0a0312"],
      },
    ],
  },
  {
    id: "night",
    name: "Night",
    description: "Tokyo ink panels — not pure black, still dark.",
    preview: "#7aa2f7",
    variants: [
      {
        id: "tokyo-bright",
        shade: "lighter",
        shadeLabel: "Lighter",
        name: "Tokyo Pastel",
        description: "Clear pastel Tokyo blue on a deeper ink stage — less washed out.",
        swatches: ["#b4c4f0", "#8fb4fc", "#6d9aef", "#12131c"],
      },
      {
        id: "tokyo-night",
        shade: "darker",
        shadeLabel: "Darker",
        name: "Tokyo Night",
        description: "Classic Tokyo blue + lavender on a stage darker than Pastel.",
        swatches: ["#c0caf5", "#7aa2f7", "#bb9af7", "#08090f"],
      },
      {
        id: "tokyo-deeper",
        shade: "deep",
        shadeLabel: "Deep",
        name: "Tokyo Deeper",
        description: "Same Tokyo ink accents on near-pure black stage.",
        swatches: ["#a9b1d6", "#7aa2f7", "#9d7cd8", "#000000"],
      },
    ],
  },
] as const satisfies readonly CubifyThemeFamily[]

const FAMILY_THEMES: CubifyThemeVariant[] = THEME_FAMILIES.flatMap((family) =>
  family.variants.map((v) => ({ ...v })),
)

/** Kept valid for users who saved Abyss Drive before Blue was simplified to 3 shades. */
const LEGACY_THEMES: CubifyThemeVariant[] = [
  {
    id: "dark-blue",
    shade: "darker",
    shadeLabel: "Darker",
    name: "Abyss Drive",
    description: "Quieter, deeper blue — sharper and less loud.",
    swatches: ["#bfdbfe", "#38bdf8", "#1e40af", "#01040c"],
  },
]

export const CUBIFY_THEMES: CubifyThemeVariant[] = [...FAMILY_THEMES, ...LEGACY_THEMES]

export type CubifyThemeId = (typeof CUBIFY_THEMES)[number]["id"]

export const DEFAULT_THEME: CubifyThemeId = "blue"

export function isCubifyTheme(value: string | null): value is CubifyThemeId {
  return CUBIFY_THEMES.some((theme) => theme.id === value)
}

export function getThemeById(id: CubifyThemeId): CubifyThemeVariant {
  return CUBIFY_THEMES.find((t) => t.id === id) ?? CUBIFY_THEMES[0]
}

export function getFamilyForTheme(id: CubifyThemeId): (typeof THEME_FAMILIES)[number] {
  const family = THEME_FAMILIES.find((f) => f.variants.some((v) => v.id === id))
  // Legacy dark-blue maps into Blue family for open-state highlighting
  if (id === "dark-blue") return THEME_FAMILIES[0]
  return family ?? THEME_FAMILIES[0]
}

/** All valid theme ids — used by the FOUC boot script in layout. */
export const ALL_THEME_IDS: CubifyThemeId[] = CUBIFY_THEMES.map((t) => t.id)
