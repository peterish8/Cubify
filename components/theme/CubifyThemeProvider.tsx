"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import {
  DEFAULT_CUSTOM_CURSOR,
  DEFAULT_SMOOTH_SCROLL,
  readCustomCursorPref,
  readSmoothScrollPref,
  writeCustomCursorPref,
  writeSmoothScrollPref,
} from "@/lib/cubify-prefs"
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
  /** Site custom cursor (dot + ring). Off = normal system cursor. Default on. */
  customCursor: boolean
  setCustomCursor: (enabled: boolean) => void
  /** Lenis smooth wheel scrolling. Default on. */
  smoothScroll: boolean
  setSmoothScroll: (enabled: boolean) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function applyTheme(theme: CubifyThemeId) {
  document.documentElement.dataset.cubifyTheme = theme
}

export function CubifyThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<CubifyThemeId>(DEFAULT_THEME)
  const [customCursor, setCustomCursorState] = useState(DEFAULT_CUSTOM_CURSOR)
  const [smoothScroll, setSmoothScrollState] = useState(DEFAULT_SMOOTH_SCROLL)

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    const next = isCubifyTheme(stored) ? stored : DEFAULT_THEME
    setThemeState(next)
    applyTheme(next)
    setCustomCursorState(readCustomCursorPref())
    setSmoothScrollState(readSmoothScrollPref())
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme: (next) => {
        setThemeState(next)
        applyTheme(next)
        window.localStorage.setItem(THEME_STORAGE_KEY, next)
      },
      customCursor,
      setCustomCursor: (enabled) => {
        setCustomCursorState(enabled)
        writeCustomCursorPref(enabled)
        if (!enabled) {
          document.documentElement.classList.remove("has-custom-cursor")
        }
      },
      smoothScroll,
      setSmoothScroll: (enabled) => {
        setSmoothScrollState(enabled)
        writeSmoothScrollPref(enabled)
      },
    }),
    [theme, customCursor, smoothScroll],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useCubifyTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error("useCubifyTheme must be used inside CubifyThemeProvider")
  return context
}

export { CUBIFY_THEMES }
