"use client"

import { useEffect } from "react"
import Lenis from "lenis"
import { useCubifyTheme } from "@/components/theme/CubifyThemeProvider"

/** Optional smooth wheel — respects Settings toggle + reduced-motion. Default off. */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const { smoothScroll } = useCubifyTheme()

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!smoothScroll) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    let lenis: Lenis | null = null
    let frame = 0

    try {
      lenis = new Lenis({
        duration: 1.05,
        smoothWheel: true,
        autoRaf: false,
      })

      const raf = (time: number) => {
        lenis?.raf(time)
        frame = requestAnimationFrame(raf)
      }
      frame = requestAnimationFrame(raf)
    } catch {
      // If Lenis fails, page still works with native scroll
    }

    return () => {
      cancelAnimationFrame(frame)
      lenis?.destroy()
    }
  }, [smoothScroll])

  return <>{children}</>
}
