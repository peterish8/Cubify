"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import {
  calculateTopPercent,
  fetchRankTotals,
  formatTopPercent,
  getScopedTotals,
  type RankTotalsDocument,
} from "@/lib/wca-rank-totals"
import {
  fetchWcaPerson,
  fetchWcaPersonSolveActivity,
  type WcaEventSolveActivity,
} from "@/lib/wca-person"
import { eventDisplayName } from "@/lib/wca-events"
import { formatResult } from "@/lib/wca-format"
import { flagWashGradient, getFlagColors } from "@/lib/flag-colors"
import { continentLabel } from "@/lib/wca-country-totals"
import { PercentileRing } from "@/components/PercentileRing"
import { CountUp } from "@/components/motion/CountUp"
import { SiteFooter, SiteHeader } from "@/components/layout/SiteChrome"
import { EditorialButton, EditorialInput } from "@/components/ui/editorial-field"
import { CubeLogo } from "@/components/brand/CubeLogo"
import {
  ArrowRight,
  BarChart3,
  ChevronLeft,
  ExternalLink,
  Info,
  Loader2,
  Target,
  Trophy,
  UsersRound,
  X,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

interface PlayerInfo {
  name: string
  country: {
    name: string
    iso2: string
    continentId: string
  }
  continent: string
  wca_id: string
  avatar?: {
    url: string
  }
  personal_records: Record<
    string,
    {
      single?: {
        best: number
        world_ranking: number
        continental_ranking: number
        national_ranking: number
      }
      average?: {
        best: number
        world_ranking: number
        continental_ranking: number
        national_ranking: number
      }
    }
  >
}

interface RegionStats {
  totalCompetitors: number | null
  topPercent: number | null
}

interface EventStats {
  single: {
    nr: RegionStats
    cr: RegionStats
    wr: RegionStats
    rank: { nr: number; cr: number; wr: number }
  }
  average: {
    nr: RegionStats
    cr: RegionStats
    wr: RegionStats
    rank: { nr: number; cr: number; wr: number }
  }
}

const ease = [0.16, 1, 0.3, 1] as const

/** Best WR top% for an event (single or average — lower is better). */
function eventBestWrPercent(stats: EventStats): number | null {
  const a = stats.single.wr.topPercent
  const b = stats.average.wr.topPercent
  if (a == null && b == null) return null
  if (a == null) return b
  if (b == null) return a
  return Math.min(a, b)
}

/** Best positive world rank for an event (lower is better). */
function eventBestWrRank(stats: EventStats): number | null {
  const ranks = [stats.single.rank.wr, stats.average.rank.wr].filter((r) => r > 0)
  if (ranks.length === 0) return null
  return Math.min(...ranks)
}

/**
 * Rank all events by strength (WR top% then WR rank), order 1…N.
 * Badges only on the first min(3, N) — “Top 1” … “Top 3”.
 * Full order is returned so the board can list every event best→worst.
 */
function rankAllEvents(eventsData: Record<string, EventStats>): {
  orderedIds: string[]
  tagLabels: Map<string, string>
} {
  const scored = Object.entries(eventsData).map(([id, stats]) => ({
    id,
    pct: eventBestWrPercent(stats),
    wr: eventBestWrRank(stats),
  }))

  scored.sort((a, b) => {
    if (a.pct != null && b.pct != null && a.pct !== b.pct) return a.pct - b.pct
    if (a.pct != null && b.pct == null) return -1
    if (a.pct == null && b.pct != null) return 1
    if (a.wr != null && b.wr != null && a.wr !== b.wr) return a.wr - b.wr
    if (a.wr != null && b.wr == null) return -1
    if (a.wr == null && b.wr != null) return 1
    return a.id.localeCompare(b.id)
  })

  const orderedIds = scored.map((e) => e.id)
  const tagLabels = new Map<string, string>()
  const tagCount = Math.min(3, orderedIds.length)
  for (let i = 0; i < tagCount; i++) {
    tagLabels.set(orderedIds[i], `Top ${i + 1}`)
  }
  return { orderedIds, tagLabels }
}

const formatExportDate = (value: string): string =>
  new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(value))

function RankRow({
  scope,
  rank,
  topPercent,
}: {
  scope: "NR" | "CR" | "WR"
  rank: number
  topPercent: number | null
}) {
  if (rank <= 0) return null
  const face =
    scope === "NR" ? "facelet-nr" : scope === "CR" ? "facelet-cr" : "facelet-wr"
  const pct = formatTopPercent(topPercent)

  return (
    <div className="flex items-center justify-between gap-3 py-2 sm:py-2.5">
      <div className="flex min-w-0 items-center gap-3">
        <span className={`facelet facelet-lg ${face}`}>{scope}</span>
        <span className="stat-num text-base text-foreground sm:text-lg">
          #{rank.toLocaleString()}
        </span>
      </div>
      {pct && (
        <span className="stat-num shrink-0 text-sm text-muted-foreground sm:text-base">{pct}</span>
      )}
    </div>
  )
}

function ResultBlock({
  label,
  time,
  ranks,
}: {
  label: string
  time: string
  ranks: {
    nr: { rank: number; topPercent: number | null }
    cr: { rank: number; topPercent: number | null }
    wr: { rank: number; topPercent: number | null }
  }
}) {
  return (
    <div className="rounded-xl border border-border bg-secondary/60 p-5 sm:p-6">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground sm:text-[13px]">
          {label}
        </span>
        <span className="time-display text-3xl text-foreground sm:text-4xl">{time}</span>
      </div>
      <div className="border-t border-border/80 pt-2">
        <RankRow scope="NR" rank={ranks.nr.rank} topPercent={ranks.nr.topPercent} />
        <RankRow scope="CR" rank={ranks.cr.rank} topPercent={ranks.cr.topPercent} />
        <RankRow scope="WR" rank={ranks.wr.rank} topPercent={ranks.wr.topPercent} />
      </div>
    </div>
  )
}

function EventCard({
  eventId,
  eventStats,
  playerInfo,
  topTag,
  index,
}: {
  eventId: string
  eventStats: EventStats
  playerInfo: PlayerInfo
  /** Badge only for ranks 1–3: "Top 1" | "Top 2" | "Top 3" */
  topTag?: string | null
  index: number
}) {
  const record = playerInfo.personal_records[eventId]
  const bestWrPercent = eventBestWrPercent(eventStats)
  const isTop = Boolean(topTag)

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: Math.min(index * 0.035, 0.35), ease }}
      className={cn(
        "surface-card surface-card-hover flex h-full flex-col rounded-2xl p-6 sm:p-8",
        isTop && "ring-1 ring-[rgba(var(--theme-bright-rgb),0.28)]",
      )}
    >
      <header className="mb-6 flex items-start justify-between gap-4 border-b border-border pb-5">
        <div>
          {topTag && (
            <span className="mb-2 inline-block rounded-full border border-[rgba(var(--theme-bright-rgb),0.35)] bg-[rgba(var(--theme-rgb),0.12)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--blue-bright)]">
              {topTag}
            </span>
          )}
          <h3 className="font-display text-xl font-extrabold leading-tight tracking-tight text-foreground sm:text-2xl">
            {eventDisplayName(eventId)}
          </h3>
          <p className="mt-1.5 font-data text-xs uppercase tracking-[0.16em] text-muted-foreground sm:text-sm">
            {eventId}
          </p>
        </div>
        {bestWrPercent !== null && (
          <PercentileRing
            topPercent={bestWrPercent}
            size={isTop ? 108 : 98}
            stroke={8}
            label="WR"
            className="shrink-0"
          />
        )}
      </header>

      <div className="flex flex-1 flex-col gap-4">
        {record.single && (
          <ResultBlock
            label="Single"
            time={formatResult(eventId, record.single.best, "single")}
            ranks={{
              nr: {
                rank: eventStats.single.rank.nr,
                topPercent: eventStats.single.nr.topPercent,
              },
              cr: {
                rank: eventStats.single.rank.cr,
                topPercent: eventStats.single.cr.topPercent,
              },
              wr: {
                rank: eventStats.single.rank.wr,
                topPercent: eventStats.single.wr.topPercent,
              },
            }}
          />
        )}
        {record.average && (
          <ResultBlock
            label="Average"
            time={formatResult(eventId, record.average.best, "average")}
            ranks={{
              nr: {
                rank: eventStats.average.rank.nr,
                topPercent: eventStats.average.nr.topPercent,
              },
              cr: {
                rank: eventStats.average.rank.cr,
                topPercent: eventStats.average.cr.topPercent,
              },
              wr: {
                rank: eventStats.average.rank.wr,
                topPercent: eventStats.average.wr.topPercent,
              },
            }}
          />
        )}
      </div>
    </motion.article>
  )
}

function buildRankScopeRows(region?: {
  countryName?: string | null
  continentName?: string | null
}) {
  const country = region?.countryName?.trim() || null
  const continent = region?.continentName?.trim() || null

  return [
    {
      code: "NR",
      face: "facelet-nr",
      full: "National Rank",
      meaning: country
        ? `Your place among ranked competitors in your country — for you, that’s ${country}.`
        : "Your place among ranked competitors in your country.",
    },
    {
      code: "CR",
      face: "facelet-cr",
      full: "Continental Rank",
      meaning: continent
        ? `Your place among ranked competitors on your continent — for you, that’s ${continent}.`
        : "Your place among ranked competitors on your continent.",
    },
    {
      code: "WR",
      face: "facelet-wr",
      full: "World Rank",
      meaning: "Your place among all ranked competitors worldwide for that event.",
    },
  ] as const
}

function RankScopePanel({
  compact,
  countryName,
  continentName,
}: {
  compact?: boolean
  countryName?: string | null
  continentName?: string | null
}) {
  const scopes = buildRankScopeRows({ countryName, continentName })
  const personalized = Boolean(countryName || continentName)

  return (
    <div className={cn(!compact && "space-y-3")}>
      {!compact && (
        <p className="text-xs leading-relaxed text-muted-foreground sm:text-[13px]">
          {personalized ? (
            <>
              {countryName && (
                <>
                  For this profile: <span className="font-semibold text-foreground/90">{countryName}</span>
                  {continentName ? (
                    <>
                      {" "}
                      · <span className="font-semibold text-foreground/90">{continentName}</span>
                    </>
                  ) : null}
                  .{" "}
                </>
              )}
              Lower rank number is better. <span className="text-foreground/80">Top %</span> shows
              how exclusive that rank is.
            </>
          ) : (
            <>
              Lower rank number is better. <span className="text-foreground/80">Top %</span> shows
              how exclusive that rank is among people with a valid result.
            </>
          )}
        </p>
      )}
      <div className={cn("grid gap-2.5", compact ? "gap-2" : "sm:grid-cols-1")}>
        {scopes.map((scope) => (
          <div
            key={scope.code}
            className="rounded-xl border border-border/80 bg-background/50 px-3 py-2.5 sm:px-3.5 sm:py-3"
          >
            <div className="flex items-center gap-2.5">
              <span className={`facelet facelet-lg ${scope.face}`}>{scope.code}</span>
              <p className="text-sm font-bold tracking-tight text-foreground">{scope.full}</p>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground sm:text-[13px]">
              {scope.meaning}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Info control for NR / CR / WR.
 * Desktop: hover (or focus) opens a clean popup.
 * Mobile / touch: tap toggles; tap outside closes.
 * When country/continent known from WCA profile, examples are personalized.
 */
function RankScopeInfoButton({
  className,
  compact,
  countryName,
  continentName,
}: {
  className?: string
  /** Icon-only trigger (e.g. next to facelets) */
  compact?: boolean
  countryName?: string | null
  continentName?: string | null
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearCloseTimer = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }

  const openPanel = () => {
    clearCloseTimer()
    setOpen(true)
  }

  const scheduleClose = () => {
    clearCloseTimer()
    closeTimer.current = setTimeout(() => setOpen(false), 140)
  }

  useEffect(() => {
    if (!open) return
    const onDoc = (event: MouseEvent | TouchEvent) => {
      const el = rootRef.current
      if (!el) return
      if (event.target instanceof Node && !el.contains(event.target)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    document.addEventListener("touchstart", onDoc, { passive: true })
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDoc)
      document.removeEventListener("touchstart", onDoc)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  useEffect(() => () => clearCloseTimer(), [])

  return (
    <div
      ref={rootRef}
      className={cn("relative inline-flex", className)}
      onMouseEnter={openPanel}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls="rank-scope-info-panel"
        onClick={() => setOpen((v) => !v)}
        onFocus={openPanel}
        onBlur={(e) => {
          // Keep open if focus moves into the panel
          if (rootRef.current?.contains(e.relatedTarget as Node)) return
          scheduleClose()
        }}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border text-xs font-bold uppercase tracking-[0.12em] transition",
          compact ? "h-9 w-9 justify-center px-0" : "px-3 py-1.5",
          open
            ? "border-[rgba(var(--theme-bright-rgb),0.55)] bg-[rgba(var(--theme-rgb),0.18)] text-[var(--blue-bright)]"
            : "border-border bg-secondary/55 text-muted-foreground hover:border-[rgba(var(--theme-bright-rgb),0.4)] hover:text-foreground",
        )}
      >
        <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {!compact && (
          <>
            <span className="hidden sm:inline">What is NR · CR · WR?</span>
            <span className="sm:hidden">NR · CR · WR</span>
            <span className="inline-flex items-center gap-0.5" aria-hidden>
              <span className="facelet scale-90 facelet-nr">NR</span>
              <span className="facelet scale-90 facelet-cr">CR</span>
              <span className="facelet scale-90 facelet-wr">WR</span>
            </span>
          </>
        )}
        {compact && <span className="sr-only">What is NR, CR, and WR?</span>}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id="rank-scope-info-panel"
            role="dialog"
            aria-label="What NR, CR, and WR mean"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.18, ease }}
            className={cn(
              "absolute top-[calc(100%+0.55rem)] z-50 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-[rgba(var(--theme-bright-rgb),0.28)] bg-[rgba(6,9,16,0.97)] p-4 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9),0_0_0_1px_rgba(var(--theme-rgb),0.12)] backdrop-blur-md sm:w-[24rem] sm:p-5",
              compact ? "left-0 sm:left-auto sm:right-0" : "right-0",
            )}
            onMouseEnter={openPanel}
            onMouseLeave={scheduleClose}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--blue-bright)]">
                  Rank scopes
                </p>
                <p className="mt-1 text-sm font-bold text-foreground">What NR · CR · WR mean</p>
              </div>
              <button
                type="button"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition hover:text-foreground sm:hidden"
                aria-label="Close"
                onClick={() => setOpen(false)}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <RankScopePanel countryName={countryName} continentName={continentName} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="bezel">
        <div className="bezel-inner p-6 sm:p-8">
          <div className="flex items-center gap-5">
            <div className="skeleton-shimmer cube-frame h-24 w-24" />
            <div className="flex-1 space-y-3">
              <div className="skeleton-shimmer h-8 w-52 rounded" />
              <div className="skeleton-shimmer h-3 w-36 rounded" />
            </div>
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="surface-card space-y-3 rounded-xl p-5">
            <div className="skeleton-shimmer h-3 w-20 rounded" />
            <div className="skeleton-shimmer h-10 w-28 rounded" />
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="surface-card space-y-4 rounded-xl p-5">
            <div className="skeleton-shimmer h-4 w-32 rounded" />
            <div className="skeleton-shimmer ml-auto h-9 w-20 rounded" />
            <div className="skeleton-shimmer h-3 w-full rounded" />
            <div className="skeleton-shimmer h-3 w-4/5 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

const aboutLookupCards = [
  {
    title: "Lookup",
    text: "Paste one WCA ID and Cubify translates raw WR, CR, and NR ranks into Top %.",
    detail:
      "Lookup is the main Cubify action. It reads a real WCA profile, keeps the official rank, and adds the missing percentile context so the number feels understandable.",
    proof: "WR rank -> Top % | CR rank -> Top % | NR rank -> Top %",
    visual: "#14,878 -> Top 5.3%",
    icon: Trophy,
  },
  {
    title: "Goal",
    text: "Pick an event and target percentile, then see the result you need to reach it.",
    detail:
      "Goal mode works backwards from the rank-data lists. You choose the event and target Top %, and Cubify estimates the result needed to reach that zone.",
    proof: "Choose event -> Set target -> See required result",
    visual: "Top 10% target",
    icon: Target,
  },
  {
    title: "Compare",
    text: "Put two cubers side by side and compare ranks, results, and percentile strength.",
    detail:
      "Compare makes two WCA profiles readable side by side. It is built for quickly seeing who is stronger in each scope instead of scanning raw rankings.",
    proof: "Cuber A vs Cuber B | Event by event | Rank and Top %",
    visual: "A 7.2% vs B 11.4%",
    icon: BarChart3,
  },
  {
    title: "Countries",
    text: "Explore how many active WCA cubers each country has, with fast scrolling charts.",
    detail:
      "Countries shows where the cubing population is concentrated. The charts are built to scroll naturally while rendering efficiently.",
    proof: "Country totals -> Flags -> Virtualized charts",
    visual: "165 countries",
    icon: UsersRound,
  },
]

function AboutCubifyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null)
  const selected = aboutLookupCards.find((card) => card.title === selectedTitle)
  const handleClose = () => {
    setSelectedTitle(null)
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-black/68 px-4 py-6 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="about-cubify-title"
            className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-[rgba(var(--theme-bright-rgb),0.32)] bg-[rgba(5,9,18,0.96)] p-5 shadow-[0_30px_90px_-35px_rgba(var(--theme-rgb),0.95)] sm:p-7"
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.22, ease }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(var(--theme-bright-rgb),0.75)] to-transparent" />
            <button
              type="button"
              onClick={handleClose}
              className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full border border-border bg-secondary/50 text-muted-foreground transition hover:text-foreground"
              aria-label="Close about Cubify"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
            <AnimatePresence mode="wait">
              {selected ? (
                <motion.div
                  key={selected.title}
                  initial={{ opacity: 0, x: 18 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -18 }}
                  transition={{ duration: 0.18, ease }}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedTitle(null)}
                    className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/45 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground transition hover:text-foreground"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
                    Back
                  </button>
                  <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr] lg:items-stretch">
                    <div>
                      <p className="eyebrow">{selected.title}</p>
                      <h3
                        id="about-cubify-title"
                        className="mt-2 font-display text-3xl font-extrabold tracking-tight text-foreground"
                      >
                        {selected.title === "Lookup"
                          ? "Your rank becomes a clear Top %."
                          : selected.title === "Goal"
                            ? "Know the result you need next."
                            : selected.title === "Compare"
                              ? "Make two profiles instantly readable."
                              : "See the cubing world by country."}
                      </h3>
                      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                        {selected.detail}
                      </p>
                    </div>
                    <div className="relative overflow-hidden rounded-xl border border-[rgba(var(--theme-bright-rgb),0.32)] bg-[radial-gradient(circle_at_35%_20%,rgba(var(--theme-bright-rgb),0.24),transparent_32%),linear-gradient(140deg,rgba(var(--theme-deep-rgb),0.7),rgba(var(--theme-rgb),0.2))] p-6">
                      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
                      <div className="grid h-full min-h-56 place-items-center text-center">
                        <div className="w-full max-w-sm px-1">
                          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-white shadow-[0_16px_40px_-18px_rgba(var(--theme-rgb),1)]">
                            <selected.icon className="h-5 w-5" aria-hidden />
                          </div>
                          <p className="stat-num mx-auto max-w-full whitespace-nowrap text-[clamp(1.15rem,2.8vw,1.85rem)] font-extrabold leading-none tracking-tight text-white">
                            {selected.visual}
                          </p>
                          <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/55">
                            Cubify context
                          </p>
                          {/* Rank → Top % as a single small line inside the themed panel */}
                          <p className="mt-2 whitespace-nowrap text-[10px] font-medium leading-snug tracking-wide text-white/70 sm:text-[11px]">
                            {selected.proof}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="overview"
                  initial={{ opacity: 0, x: -18 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 18 }}
                  transition={{ duration: 0.18, ease }}
                >
                  <p className="eyebrow">What Cubify does</p>
                  <h3
                    id="about-cubify-title"
                    className="mt-2 max-w-lg font-display text-3xl font-extrabold tracking-tight text-foreground"
                  >
                    It turns WCA numbers into meaning.
                  </h3>
                  <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                    WCA gives official ranks. Cubify keeps those ranks, then adds the missing
                    context: how high you stand as a Top % across the world, continent, and country.
                  </p>
                  <div className="mt-5">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--blue-bright)]">
                      Rank scopes
                    </p>
                    <RankScopePanel />
                  </div>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    {aboutLookupCards.map(({ title, text, icon: Icon }) => (
                      <button
                        type="button"
                        key={title}
                        onClick={() => setSelectedTitle(title)}
                        className="group rounded-xl border border-border bg-secondary/28 p-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:-translate-y-0.5 hover:border-[rgba(var(--theme-bright-rgb),0.42)] hover:bg-secondary/40"
                      >
                        <div className="mb-3 grid h-9 w-9 place-items-center rounded-lg bg-[rgba(var(--theme-rgb),0.14)] text-[rgb(var(--theme-bright-rgb))] transition group-hover:bg-[rgba(var(--theme-rgb),0.22)]">
                          <Icon className="h-4 w-4" aria-hidden />
                        </div>
                        <p className="font-display text-base font-bold text-foreground">{title}</p>
                        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                          {text}
                        </p>
                        <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-[rgb(var(--theme-bright-rgb))]">
                          Open guide
                        </p>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function LookupForm({
  wcaId,
  setWcaId,
  loading,
  error,
  onSubmit,
  compact,
}: {
  wcaId: string
  setWcaId: (v: string) => void
  loading: boolean
  error: string
  onSubmit: () => void
  compact?: boolean
}) {
  const [aboutOpen, setAboutOpen] = useState(false)

  if (compact) {
    return (
      <div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Lookup</p>
            <p className="font-display mt-1 text-xl font-extrabold tracking-tight">
              Another competitor
            </p>
          </div>
          <div className="flex w-full max-w-md gap-2">
            <EditorialInput
              placeholder="WCA ID"
              value={wcaId}
              onChange={(e) => setWcaId(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && onSubmit()}
              disabled={loading}
              className="flex-1"
            />
            <EditorialButton
              onClick={onSubmit}
              disabled={loading}
              className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-lg px-5"
            >
              {loading ? (
                <CubeLogo size={18} className="cube-load" />
              ) : (
                <>
                  Go
                  <CubeLogo size={16} className="btn-cube-idle" />
                </>
              )}
            </EditorialButton>
          </div>
        </div>
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-3 text-sm font-medium text-rose-400"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <div className="bezel">
      <div className="bezel-inner relative overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(var(--theme-bright-rgb),0.65)] to-transparent" />
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Rank to percentile</p>
            <h2 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-foreground">
              Reveal your Top %
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Enter a WCA ID to see what your official ranks mean.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAboutOpen(true)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-secondary/50 text-muted-foreground transition hover:border-[rgba(var(--theme-bright-rgb),0.55)] hover:text-foreground"
            aria-label="About Cubify"
          >
            <Info className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <label className="eyebrow mb-3 block">WCA ID</label>
        <EditorialInput
          placeholder="2022RPRA01"
          value={wcaId}
          onChange={(e) => setWcaId(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          disabled={loading}
          className="mb-4"
          autoFocus
        />
        <EditorialButton
          onClick={onSubmit}
          disabled={loading}
          className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-lg text-sm"
        >
          {loading ? (
            <>
              <CubeLogo size={18} className="cube-load" />
              Loading
            </>
          ) : (
            <>
              Reveal Top %
              <CubeLogo size={18} className="btn-cube-idle" />
            </>
          )}
        </EditorialButton>
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 text-sm font-medium text-rose-400"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
        <p className="mt-5 border-t border-border pt-4 text-xs font-medium text-muted-foreground">
          Official WCA data · All events · WR / CR / NR
        </p>
      </div>
      <AboutCubifyModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </div>
  )
}

export default function CubifyAnalyzer() {
  const [wcaId, setWcaId] = useState("")
  const [loading, setLoading] = useState(false)
  const [playerInfo, setPlayerInfo] = useState<PlayerInfo | null>(null)
  const [eventsData, setEventsData] = useState<Record<string, EventStats> | null>(null)
  const [rankTotalsSource, setRankTotalsSource] = useState<RankTotalsDocument["source"] | null>(
    null,
  )
  const [mostSolvedEvent, setMostSolvedEvent] = useState<WcaEventSolveActivity | null>(null)
  const [error, setError] = useState("")
  const abortRef = useRef<AbortController | null>(null)

  const calculateStats = (rank: number, totalCompetitors: number | null): RegionStats => ({
    totalCompetitors,
    topPercent: calculateTopPercent(rank, totalCompetitors),
  })

  const fetchStats = async () => {
    const normalizedWcaId = wcaId.trim().toUpperCase()

    if (!normalizedWcaId) {
      setError("Please enter a WCA ID")
      return
    }

    // Cancel any in-flight lookup so a slower earlier response can't overwrite this one.
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError("")
    setPlayerInfo(null)
    setEventsData(null)
    setRankTotalsSource(null)
    setMostSolvedEvent(null)

    try {
      // Fire all three network calls together — person, rank totals, solve history.
      const personPromise = fetchWcaPerson(normalizedWcaId, controller.signal)
      const rankTotalsPromise: Promise<RankTotalsDocument | null> = fetchRankTotals(
        controller.signal,
      ).catch((totalsError) => {
        if (controller.signal.aborted) return null
        console.error("Rank percentages are temporarily unavailable", totalsError)
        return null
      })
      const solveActivityPromise = fetchWcaPersonSolveActivity(
        normalizedWcaId,
        controller.signal,
      ).catch((activityError) => {
        if (controller.signal.aborted) return null
        console.error("Solve activity unavailable", activityError)
        return null
      })

      const [transformedPlayer, rankTotals, solveActivity] = await Promise.all([
        personPromise,
        rankTotalsPromise,
        solveActivityPromise,
      ])

      if (controller.signal.aborted) return

      if (Object.keys(transformedPlayer.personal_records).length === 0) {
        throw new Error("No competition records found for this player.")
      }

      const countryIso = transformedPlayer.country.iso2
      const continentId = transformedPlayer.country.continentId

      const allEventsData: Record<string, EventStats> = {}

      for (const eventId of Object.keys(transformedPlayer.personal_records)) {
        const eventRecord = transformedPlayer.personal_records[eventId]
        const singleTotals = rankTotals
          ? getScopedTotals(rankTotals, eventId, "single", continentId, countryIso)
          : { world: null, continent: null, country: null }
        const averageTotals = rankTotals
          ? getScopedTotals(rankTotals, eventId, "average", continentId, countryIso)
          : { world: null, continent: null, country: null }

        const eventStats: EventStats = {
          single: {
            nr: { totalCompetitors: null, topPercent: null },
            cr: { totalCompetitors: null, topPercent: null },
            wr: { totalCompetitors: null, topPercent: null },
            rank: {
              nr: eventRecord.single?.national_ranking || 0,
              cr: eventRecord.single?.continental_ranking || 0,
              wr: eventRecord.single?.world_ranking || 0,
            },
          },
          average: {
            nr: { totalCompetitors: null, topPercent: null },
            cr: { totalCompetitors: null, topPercent: null },
            wr: { totalCompetitors: null, topPercent: null },
            rank: {
              nr: eventRecord.average?.national_ranking || 0,
              cr: eventRecord.average?.continental_ranking || 0,
              wr: eventRecord.average?.world_ranking || 0,
            },
          },
        }

        eventStats.single.wr = calculateStats(eventStats.single.rank.wr, singleTotals.world)
        eventStats.single.cr = calculateStats(eventStats.single.rank.cr, singleTotals.continent)
        eventStats.single.nr = calculateStats(eventStats.single.rank.nr, singleTotals.country)
        eventStats.average.wr = calculateStats(eventStats.average.rank.wr, averageTotals.world)
        eventStats.average.cr = calculateStats(eventStats.average.rank.cr, averageTotals.continent)
        eventStats.average.nr = calculateStats(eventStats.average.rank.nr, averageTotals.country)

        allEventsData[eventId] = eventStats
      }

      if (controller.signal.aborted) return

      // Commit UI state only after work is done and request is still current.
      setPlayerInfo(transformedPlayer)
      setEventsData(allEventsData)
      if (rankTotals) setRankTotalsSource(rankTotals.source)
      setMostSolvedEvent(
        solveActivity?.mostSolved && solveActivity.mostSolved.solves > 0
          ? solveActivity.mostSolved
          : null,
      )
    } catch (err) {
      // A superseded lookup was aborted — a newer request owns the UI now.
      if (controller.signal.aborted) return
      setError(err instanceof Error ? err.message : "An error occurred while fetching data")
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  const eventCount = eventsData ? Object.keys(eventsData).length : 0
  const hasResults = Boolean(playerInfo && eventsData && !loading)

  const highlight = useMemo(() => {
    if (!eventsData || !playerInfo) return null

    let best: {
      eventId: string
      topPercent: number
      kind: "single" | "average"
      time: string
      wr: number
    } | null = null

    for (const [eventId, stats] of Object.entries(eventsData)) {
      const rec = playerInfo.personal_records[eventId]
      for (const kind of ["single", "average"] as const) {
        const pct = stats[kind].wr.topPercent
        const rank = stats[kind].rank.wr
        const result = rec?.[kind]
        if (pct == null || !result || rank <= 0) continue
        if (!best || pct < best.topPercent) {
          best = {
            eventId,
            topPercent: pct,
            kind,
            time: formatResult(eventId, result.best, kind),
            wr: rank,
          }
        }
      }
    }

    let bestSingle: { eventId: string; time: string; wr: number } | null = null
    for (const [eventId, rec] of Object.entries(playerInfo.personal_records)) {
      if (!rec.single) continue
      const wr = rec.single.world_ranking
      if (!bestSingle || wr < bestSingle.wr) {
        bestSingle = {
          eventId,
          time: formatResult(eventId, rec.single.best, "single"),
          wr,
        }
      }
    }

    return { best, bestSingle }
  }, [eventsData, playerInfo])

  const eventRanking = useMemo(() => {
    if (!eventsData) return { orderedIds: [] as string[], tagLabels: new Map<string, string>() }
    return rankAllEvents(eventsData)
  }, [eventsData])

  /** All events best → worst; tags only for Top 1–3 */
  const sortedEvents = useMemo(() => {
    if (!eventsData) return [] as [string, EventStats][]
    return eventRanking.orderedIds
      .filter((id) => eventsData[id])
      .map((id) => [id, eventsData[id]] as [string, EventStats])
  }, [eventsData, eventRanking])

  return (
    <div className="editorial-page flex min-h-[100dvh] flex-col">
      <div className="editorial-shell flex min-h-[100dvh] flex-col">
        <SiteHeader active="home" />

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 xl:max-w-[90rem] xl:px-8">
          {!hasResults && !loading && (
            <section className="grid min-h-[calc(100dvh-15rem)] items-center gap-10 border-b border-border py-10 md:grid-cols-12 md:gap-10 md:py-12">
              <motion.div
                className="md:col-span-7"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease }}
              >
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--rank-nr)]" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    WCA rank translator
                  </span>
                </div>
                <h1 className="display-title max-w-2xl pb-1 text-[2.75rem] text-foreground sm:text-6xl md:text-7xl">
                  Your{" "}
                  <span
                    className="wca-logo-gradient"
                    data-text="WCA"
                    onPointerMove={(event) => {
                      const rect = event.currentTarget.getBoundingClientRect()
                      event.currentTarget.style.setProperty("--wca-x", `${event.clientX - rect.left}px`)
                      event.currentTarget.style.setProperty("--wca-y", `${event.clientY - rect.top}px`)
                    }}
                  >
                    WCA
                  </span>{" "}
                  rank
                  <br />
                  finally has
                  <br />
                  <span className="meaning-spark" aria-label="meaning">
                    meaning
                  </span>
                  .
                </h1>
                <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                  WCA shows your rank. Cubify reveals your exact Top % across the world,
                  continent, and country.
                </p>
                <p className="mt-6 text-sm font-semibold text-muted-foreground">
                  Official WCA data · All events · WR / CR / NR
                </p>
              </motion.div>

              <motion.div
                className="md:col-span-5"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.08, ease }}
              >
                <LookupForm
                  wcaId={wcaId}
                  setWcaId={setWcaId}
                  loading={loading}
                  error={error}
                  onSubmit={fetchStats}
                />
              </motion.div>
            </section>
          )}

          {(hasResults || loading) && (
            <section className="border-b border-border py-8">
              <LookupForm
                wcaId={wcaId}
                setWcaId={setWcaId}
                loading={loading}
                error={error}
                onSubmit={fetchStats}
                compact
              />
            </section>
          )}

          {loading && (
            <section className="py-12">
              <LoadingSkeleton />
            </section>
          )}

          {playerInfo && !loading && (
            <section className="py-10 sm:py-12">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, ease }}
                className="bezel"
              >
                <div className="bezel-inner relative overflow-hidden p-6 sm:p-8">
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{ background: flagWashGradient(playerInfo.country.iso2) }}
                    aria-hidden
                  />
                  <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-5">
                      {playerInfo.avatar?.url ? (
                        <img
                          src={playerInfo.avatar.url}
                          alt={playerInfo.name}
                          className="cube-frame h-20 w-20 object-cover sm:h-24 sm:w-24"
                        />
                      ) : (
                        <div className="cube-frame flex h-20 w-20 items-center justify-center bg-secondary font-display text-2xl font-bold text-muted-foreground sm:h-24 sm:w-24 sm:text-3xl">
                          {playerInfo.name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <p
                          className="text-[10px] font-bold uppercase tracking-[0.18em]"
                          style={{ color: getFlagColors(playerInfo.country.iso2)[0] }}
                        >
                          Competitor
                        </p>
                        <h2 className="font-display mt-1 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                          {playerInfo.name}
                        </h2>
                        <div className="mt-2.5 flex flex-wrap items-center gap-2.5 text-sm text-muted-foreground">
                          <img
                            src={`https://flagcdn.com/20x15/${playerInfo.country.iso2.toLowerCase()}.png`}
                            alt={playerInfo.country.name}
                            loading="lazy"
                            decoding="async"
                            className="rounded-[2px]"
                          />
                          <span className="font-medium">{playerInfo.country.name}</span>
                          <span className="text-border">/</span>
                          <Badge
                            variant="outline"
                            className="rounded border-border bg-secondary font-data text-[11px] font-semibold tabular-nums"
                          >
                            {playerInfo.wca_id}
                          </Badge>
                          {eventCount > 0 && (
                            <>
                              <span className="text-border">/</span>
                              <span className="font-semibold text-foreground">
                                <CountUp value={eventCount} /> events
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <a
                      href={`https://www.worldcubeassociation.org/persons/${playerInfo.wca_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-ghost relative inline-flex items-center gap-2 self-start rounded-full px-4 py-2 text-sm"
                    >
                      WCA profile
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                  {rankTotalsSource ? (
                    <p className="relative mt-6 border-t border-border pt-4 text-xs text-muted-foreground">
                      Rank totals as of {formatExportDate(rankTotalsSource.exportDate)}.{" "}
                      <a
                        href={rankTotalsSource.url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline underline-offset-2 hover:text-foreground"
                      >
                        {rankTotalsSource.attribution}
                      </a>
                    </p>
                  ) : (
                    <p className="relative mt-6 border-t border-border pt-4 text-xs text-amber-400">
                      Official ranks loaded; percentage totals temporarily unavailable.
                    </p>
                  )}
                </div>
              </motion.div>

              {highlight && (
                <div className="mt-4 grid gap-3 sm:grid-cols-3 sm:items-stretch">
                  <div className="bezel">
                    <div className="bezel-inner flex h-full min-h-[9.5rem] flex-col p-5 sm:min-h-[10.5rem] sm:p-6">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                        Peak WR percentile
                      </p>
                      {highlight.best ? (
                        <>
                          <p className="time-display mt-3 text-4xl text-foreground sm:text-5xl">
                            {formatTopPercent(highlight.best.topPercent)}
                          </p>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {eventDisplayName(highlight.best.eventId)} · {highlight.best.kind}
                          </p>
                          <p className="stat-num mt-1 text-xs text-muted-foreground">
                            #{highlight.best.wr.toLocaleString()} · {highlight.best.time}
                          </p>
                        </>
                      ) : (
                        <p className="mt-3 text-sm text-muted-foreground">No WR % yet</p>
                      )}
                    </div>
                  </div>
                  <div className="bezel">
                    <div className="bezel-inner flex h-full min-h-[9.5rem] flex-col p-5 sm:min-h-[10.5rem] sm:p-6">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                        Best world rank
                      </p>
                      {highlight.bestSingle ? (
                        <>
                          <p className="time-display mt-3 text-4xl text-foreground sm:text-5xl">
                            #{highlight.bestSingle.wr.toLocaleString()}
                          </p>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {eventDisplayName(highlight.bestSingle.eventId)} single
                          </p>
                          <p className="stat-num mt-1 text-xs text-muted-foreground">
                            {highlight.bestSingle.time}
                          </p>
                        </>
                      ) : (
                        <p className="mt-3 text-sm text-muted-foreground">No singles</p>
                      )}
                    </div>
                  </div>
                  <div className="bezel">
                    <div className="bezel-inner flex h-full min-h-[9.5rem] flex-col p-5 sm:min-h-[10.5rem] sm:p-6">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                        Most competed event
                      </p>
                      {mostSolvedEvent && mostSolvedEvent.solves > 0 ? (
                        <>
                          <p className="time-display mt-3 text-3xl leading-none text-foreground sm:text-4xl">
                            {eventDisplayName(mostSolvedEvent.eventId)}
                          </p>
                          <p className="stat-num mt-3 text-2xl font-bold text-foreground sm:text-3xl">
                            <CountUp value={mostSolvedEvent.solves} />{" "}
                            <span className="text-base font-semibold text-muted-foreground sm:text-lg">
                              solves
                            </span>
                          </p>
                          <p className="mt-2 text-sm text-muted-foreground">
                            across{" "}
                            <span className="font-semibold text-foreground">
                              {mostSolvedEvent.competitions}
                            </span>{" "}
                            {mostSolvedEvent.competitions === 1 ? "competition" : "competitions"}
                          </p>
                        </>
                      ) : (
                        <p className="mt-3 text-sm text-muted-foreground">
                          Solve history unavailable
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {eventsData && playerInfo && !loading && (
            <section className="pb-20">
              <div className="mb-8 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-5">
                <div>
                  <h3 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
                    Event board
                  </h3>
                  <p className="mt-1.5 text-base text-muted-foreground">
                    Face by face · times, ranks, percentiles
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <RankScopeInfoButton
                    countryName={playerInfo.country.name}
                    continentName={continentLabel(playerInfo.country.continentId)}
                  />
                  <span className="stat-num text-base text-muted-foreground">
                    {eventCount} events
                  </span>
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {sortedEvents.map(([eventId, eventStats], index) => (
                  <EventCard
                    key={eventId}
                    eventId={eventId}
                    eventStats={eventStats}
                    playerInfo={playerInfo}
                    topTag={eventRanking.tagLabels.get(eventId) ?? null}
                    index={index}
                  />
                ))}
              </div>
            </section>
          )}
        </main>

        <SiteFooter />
      </div>
    </div>
  )
}
