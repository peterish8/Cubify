"use client"

import { useEffect, useRef } from "react"
import { motion, useInView, useSpring, useMotionValue, useTransform } from "framer-motion"
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
  // Derive the stroke offset from the spring as a motion value so the SVG
  // attribute animates without a React re-render per frame.
  const offset = useTransform(spring, (v) => circumference * (1 - v))
  const labelText = formatTopPercent(topPercent)

  useEffect(() => {
    if (inView) progress.set(target)
  }, [inView, target, progress])

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <div
        className="relative rounded-md border border-border bg-secondary/40 p-1"
        style={{ width: size + 8, height: size + 8 }}
      >
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
            <motion.circle
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
          <div className="absolute inset-0 flex flex-col items-center justify-center px-1 text-center">
            <span className="text-[8px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              {label}
            </span>
            <span className="font-data mt-0.5 text-[11px] font-bold tabular-nums leading-tight text-foreground">
              {labelText ?? "-"}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
