"use client"

import { useEffect } from "react"
import Lenis from "lenis"

/** Optional smooth wheel — never mutates layout in a way that hides content. */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    let lenis: Lenis | null = null
    let frame = 0

    try {
      lenis = new Lenis({
        duration: 1.05,
        smoothWheel: true,
        // Keep native document scroll so sticky + layout stay correct
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
  }, [])

  return <>{children}</>
}
