"use client"

import { useEffect, useId, useRef, useState } from "react"
import { motion, useInView, useSpring, useMotionValue } from "framer-motion"
import { cn } from "@/lib/utils"
import { formatTopPercent } from "@/lib/wca-rank-totals"

interface PercentileRingProps {
  /** Top X% value (e.g. 2.5 means Top 2.5%). Lower = better. */
  topPercent: number | null
  size?: number
  stroke?: number
  className?: string
  label?: string
  color?: string
}

/** Map top-percent into a 0–1 progress for the ring (better percentile = fuller ring). */
function toProgress(topPercent: number | null): number {
  if (topPercent === null || topPercent <= 0) return 0
  // Logarithmic feel so elite ranks still fill most of the ring
  const clamped = Math.min(100, Math.max(0.01, topPercent))
  const progress = 1 - Math.log10(clamped + 1) / Math.log10(101)
  return Math.max(0.04, Math.min(1, progress))
}

export function PercentileRing({
  topPercent,
  size = 120,
  stroke = 8,
  className,
  label = "World",
  color = "var(--rank-wr)",
}: PercentileRingProps) {
  const id = useId()
  const ref = useRef<SVGSVGElement>(null)
  const inView = useInView(ref, { once: true, margin: "-20px" })
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const target = toProgress(topPercent)

  const progress = useMotionValue(0)
  const spring = useSpring(progress, { stiffness: 70, damping: 22, mass: 0.8 })
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
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg ref={ref} width={size} height={size} className="rotate-[-90deg]">
          <defs>
            <linearGradient id={`ring-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity="1" />
              <stop offset="100%" stopColor={color} stopOpacity="0.55" />
            </linearGradient>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-border/60"
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={`url(#ring-${id})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ filter: `drop-shadow(0 0 6px ${color})` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
            {label}
          </span>
          <span className="text-sm font-semibold tabular-nums text-foreground leading-tight">
            {labelText ?? "—"}
          </span>
        </div>
      </div>
    </div>
  )
}
