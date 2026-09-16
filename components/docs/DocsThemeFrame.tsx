"use client"

import { useEffect, useState, type ReactNode } from "react"
import { Moon, Sun } from "lucide-react"

export function DocsThemeFrame({ children }: { children: ReactNode }) {
  const [light, setLight] = useState(false)

  useEffect(() => {
    setLight(window.localStorage.getItem("cubify-docs-theme") === "light")
  }, [])

  function toggleTheme() {
    setLight((current) => {
      const next = !current
      window.localStorage.setItem("cubify-docs-theme", next ? "light" : "dark")
      return next
    })
  }

  return (
    <div className={light ? "docs-scope docs-light" : "docs-scope"}>
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={light ? "Switch docs to dark mode" : "Switch docs to light mode"}
        className="docs-theme-toggle pressable fixed right-4 top-20 z-50 inline-flex items-center gap-2 rounded-full border px-3 py-2 font-data text-[10px] font-bold tracking-[0.1em] shadow-lg sm:right-6"
      >
        {light ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
        {light ? "Dark" : "Light"}
      </button>
      {children}
    </div>
  )
}
