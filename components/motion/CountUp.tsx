"use client"

import { useEffect, useRef, useState } from "react"
import { motion, useInView, useMotionValue, useSpring } from "framer-motion"
import { cn } from "@/lib/utils"

interface CountUpProps {
  value: number
  decimals?: number
  prefix?: string
  suffix?: string
  className?: string
  duration?: number
}

export function CountUp({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  className,
  duration = 1.2,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: "-20px" })
  const motionVal = useMotionValue(0)
  const spring = useSpring(motionVal, {
    stiffness: 80,
    damping: 28,
    mass: 0.8,
    duration: duration * 1000,
  })
  const [display, setDisplay] = useState("0")

  useEffect(() => {
    if (!inView) return
    motionVal.set(value)
  }, [inView, value, motionVal])

  useEffect(() => {
    const unsub = spring.on("change", (v) => {
      setDisplay(v.toFixed(decimals))
    })
    return unsub
  }, [spring, decimals])

  return (
    <motion.span ref={ref} className={cn("tabular-nums", className)}>
      {prefix}
      {display}
      {suffix}
    </motion.span>
  )
}
