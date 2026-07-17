"use client"

import { useEffect, useRef, useState } from "react"
import { useInView, useSpring, useMotionValue } from "framer-motion"
import { cn } from "@/lib/utils"
import { formatTopPercent } from "@/lib/wca-rank-totals"

interface PercentileRingProps {
  topPercent: number | null
  size?: number
  stroke?: number
  className?: string
  label?: string
  color?: string
}

function toProgress(topPercent: number | null): number {
  if (topPercent === null || topPercent <= 0) return 0
  const clamped = Math.min(100, Math.max(0.01, topPercent))
  const progress = 1 - Math.log10(clamped + 1) / Math.log10(101)
  return Math.max(0.04, Math.min(1, progress))
}

export function PercentileRing({
  topPercent,
  size = 88,
  stroke = 3,
  className,
  label = "WR",
  color = "var(--foreground)",
}: PercentileRingProps) {
  const ref = useRef<SVGSVGElement>(null)
  const inView = useInView(ref, { once: true, margin: "-20px" })
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const target = toProgress(topPercent)

  const progress = useMotionValue(0)
  const spring = useSpring(progress, { stiffness: 90, damping: 24, mass: 0.7 })
  const [offset, setOffset] = useState(circumference)
  const labelText = formatTopPercent(topPercent)

  useEffect(() => {
    if (inView) progress.set(target)
  }, [inView, target, progress])

  useEffect(() => {
    const unsub = spring.on("change", (v) => {
      setOffset(circumference * (1 - v))
    })
    return unsub
  }, [spring, circumference])

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg ref={ref} width={size} height={size} className="rotate-[-90deg]">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--border)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-1">
          <span className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground font-medium">
            {label}
          </span>
          <span className="text-xs font-medium tabular-nums text-foreground leading-tight mt-0.5">
            {labelText ?? "—"}
          </span>
        </div>
      </div>
    </div>
  )
}
