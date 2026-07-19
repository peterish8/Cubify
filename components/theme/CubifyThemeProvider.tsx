"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import {
  CUBIFY_THEMES,
  DEFAULT_THEME,
  isCubifyTheme,
  THEME_STORAGE_KEY,
  type CubifyThemeId,
} from "@/lib/cubify-themes"

type ThemeContextValue = {
  theme: CubifyThemeId
  setTheme: (theme: CubifyThemeId) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function applyTheme(theme: CubifyThemeId) {
  document.documentElement.dataset.cubifyTheme = theme
}

export function CubifyThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<CubifyThemeId>(DEFAULT_THEME)

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    const next = isCubifyTheme(stored) ? stored : DEFAULT_THEME
    setThemeState(next)
    applyTheme(next)
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme: (next) => {
        setThemeState(next)
        applyTheme(next)
        window.localStorage.setItem(THEME_STORAGE_KEY, next)
      },
    }),
    [theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useCubifyTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error("useCubifyTheme must be used inside CubifyThemeProvider")
  return context
}

export { CUBIFY_THEMES }
