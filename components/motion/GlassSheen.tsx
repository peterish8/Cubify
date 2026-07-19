"use client"

import { useEffect } from "react"

/*
  Pointer-reactive specular sheen for glass surfaces.
  A single global listener sets --mx/--my/--lit on the glass element under
  the cursor (throttled via rAF). CSS renders a radial highlight that follows
  the pointer — the closest web approximation of Apple's reactive liquid glass.
  Transform/opacity only; backdrop-filter is never animated.
*/

const GLASS_SELECTOR = ".surface-card, .bezel-inner, .glass-sheen"

export function GlassSheen() {
  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.matchMedia("(pointer: fine)").matches === false) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    let current: HTMLElement | null = null
    let raf = 0
    let lastEvent: PointerEvent | null = null

    const paint = () => {
      raf = 0
      const e = lastEvent
      if (!e) return
      const target = (e.target as Element | null)?.closest(GLASS_SELECTOR) as HTMLElement | null

      if (target !== current) {
        if (current) {
          current.style.setProperty("--lit", "0")
        }
        current = target
        if (current) current.style.setProperty("--lit", "1")
      }
      if (current) {
        const rect = current.getBoundingClientRect()
        const x = ((e.clientX - rect.left) / rect.width) * 100
        const y = ((e.clientY - rect.top) / rect.height) * 100
        current.style.setProperty("--mx", `${x}%`)
        current.style.setProperty("--my", `${y}%`)
      }
    }

    const onMove = (e: PointerEvent) => {
      lastEvent = e
      if (!raf) raf = requestAnimationFrame(paint)
    }

    const onLeaveWindow = () => {
      if (current) current.style.setProperty("--lit", "0")
      current = null
    }

    window.addEventListener("pointermove", onMove, { passive: true })
    document.addEventListener("pointerleave", onLeaveWindow)

    return () => {
      window.removeEventListener("pointermove", onMove)
      document.removeEventListener("pointerleave", onLeaveWindow)
      if (raf) cancelAnimationFrame(raf)
      if (current) current.style.setProperty("--lit", "0")
    }
  }, [])

  return null
}
