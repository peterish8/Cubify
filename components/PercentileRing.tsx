"use client"

import { useEffect, useId, useRef } from "react"
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
  return Math.max(0.05, Math.min(1, progress))
}

/** Split "Top 5.3%" / "Top <0.1%" into a compact number line for the ring. */
function formatRingNumber(topPercent: number | null): string {
  const full = formatTopPercent(topPercent)
  if (!full) return "—"
  // "Top <0.1%" → "<0.1%" · "Top 5.3%" → "5.3%"
  return full.replace(/^Top\s+/i, "")
}

export function PercentileRing({
  topPercent,
  size = 100,
  stroke = 8,
  className,
  label = "WR",
  color,
}: PercentileRingProps) {
  const uid = useId().replace(/:/g, "")
  const ref = useRef<SVGSVGElement>(null)
  const inView = useInView(ref, { once: true, margin: "-24px" })
  const pad = stroke / 2 + 2
  const vb = size
  const cx = vb / 2
  const cy = vb / 2
  const radius = size / 2 - pad
  const circumference = 2 * Math.PI * radius
  const target = toProgress(topPercent)
  const innerHole = Math.max(36, radius * 2 - stroke * 2 - 8)

  const progress = useMotionValue(0)
  const spring = useSpring(progress, {
    stiffness: 52,
    damping: 18,
    mass: 0.85,
  })
  const offset = useTransform(spring, (v) => circumference * (1 - v))
  const numberText = formatRingNumber(topPercent)

  const gradId = `pct-grad-${uid}`
  const glowId = `pct-glow-${uid}`
  const strokePaint = color ?? `url(#${gradId})`

  useEffect(() => {
    if (inView) progress.set(target)
  }, [inView, target, progress])

  return (
    <div className={cn("flex flex-col items-center gap-1.5", className)}>
      <div
        className="percentile-ring relative shrink-0"
        style={{ width: size + 10, height: size + 10 }}
      >
        <div
          className="absolute inset-0 rounded-full border border-[rgba(var(--theme-bright-rgb),0.18)] bg-[rgba(var(--theme-rgb),0.06)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_22px_-12px_rgba(0,0,0,0.75)]"
          aria-hidden
        />
        <div className="absolute inset-[5px] grid place-items-center">
          <svg
            ref={ref}
            width={size}
            height={size}
            viewBox={`0 0 ${vb} ${vb}`}
            className="overflow-visible"
            aria-hidden
          >
            <defs>
              <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgb(var(--theme-bright-rgb))" />
                <stop offset="55%" stopColor="rgb(var(--theme-rgb))" />
                <stop offset="100%" stopColor="rgb(var(--theme-sky-rgb))" />
              </linearGradient>
              <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="2.2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <circle
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke="rgba(var(--theme-rgb), 0.16)"
              strokeWidth={stroke}
              strokeLinecap="round"
            />
            <circle
              cx={cx}
              cy={cy}
              r={Math.max(8, radius - stroke * 0.85)}
              fill="none"
              stroke="rgba(255,255,255,0.045)"
              strokeWidth={1}
            />

            <g transform={`rotate(-90 ${cx} ${cy})`}>
              <motion.circle
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke={strokePaint}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                filter={`url(#${glowId})`}
              />
            </g>
          </svg>

          <div
            className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center text-center"
            style={{
              width: innerHole,
              height: innerHole,
              padding: Math.max(4, stroke * 0.25),
            }}
          >
            {/* WR + Top same small label font */}
            <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground sm:text-[10px]">
              {label} Top
            </span>
            {/* Number only, larger */}
            <span
              className={cn(
                "font-data mt-0.5 font-bold tabular-nums leading-none text-foreground",
                size >= 110 ? "text-base sm:text-lg" : "text-sm sm:text-base",
              )}
            >
              {numberText}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
