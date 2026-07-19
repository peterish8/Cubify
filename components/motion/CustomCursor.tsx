"use client"

import { useEffect, useRef, useState } from "react"
import { motion, useMotionValue, useSpring } from "framer-motion"
import { useCubifyTheme } from "@/components/theme/CubifyThemeProvider"

const INTERACTIVE =
  'a, button, [role="button"], input, textarea, select, label, [data-cursor="hover"]'

/**
 * Cubify’s own custom cursor (dot + ring) — not from another project.
 * Respects Settings → Custom cursor toggle + reduced-motion / touch.
 */
export function CustomCursor() {
  const { customCursor: preferCustom } = useCubifyTheme()
  const [enabled, setEnabled] = useState(false)
  const [hovering, setHovering] = useState(false)
  const [visible, setVisible] = useState(false)
  const rafRef = useRef(0)

  const mouseX = useMotionValue(-100)
  const mouseY = useMotionValue(-100)

  const springConfig = { damping: 28, stiffness: 350, mass: 0.4 }
  const ringX = useSpring(mouseX, springConfig)
  const ringY = useSpring(mouseY, { ...springConfig, stiffness: 280 })
  const dotX = useSpring(mouseX, { damping: 40, stiffness: 600, mass: 0.2 })
  const dotY = useSpring(mouseY, { damping: 40, stiffness: 600, mass: 0.2 })

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const canUse = preferCustom && fine && !reduced

    if (!canUse) {
      setEnabled(false)
      document.documentElement.classList.remove("has-custom-cursor")
      return
    }

    setEnabled(true)
    document.documentElement.classList.add("has-custom-cursor")

    const onMove = (e: MouseEvent) => {
      mouseX.set(e.clientX)
      mouseY.set(e.clientY)
      setVisible(true)
    }

    const onLeave = () => setVisible(false)
    const onOver = (e: MouseEvent) => {
      const t = e.target as Element | null
      setHovering(!!t?.closest?.(INTERACTIVE))
    }

    window.addEventListener("mousemove", onMove, { passive: true })
    window.addEventListener("mouseover", onOver, { passive: true })
    document.addEventListener("mouseleave", onLeave)

    return () => {
      document.documentElement.classList.remove("has-custom-cursor")
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseover", onOver)
      document.removeEventListener("mouseleave", onLeave)
      cancelAnimationFrame(rafRef.current)
    }
  }, [preferCustom, mouseX, mouseY])

  if (!enabled) return null

  return (
    <>
      <motion.div
        className="cursor-dot"
        style={{
          x: dotX,
          y: dotY,
          translateX: "-50%",
          translateY: "-50%",
          opacity: visible ? 1 : 0,
          scale: hovering ? 0.5 : 1,
        }}
      />
      <motion.div
        className="cursor-ring"
        style={{
          x: ringX,
          y: ringY,
          translateX: "-50%",
          translateY: "-50%",
          opacity: visible ? 1 : 0,
          scale: hovering ? 1.6 : 1,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 22 }}
      />
    </>
  )
}
