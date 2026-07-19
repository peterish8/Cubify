"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { motion } from "framer-motion"
import {
  ArrowRight,
  BarChart3,
  ChevronDown,
  ExternalLink,
  Loader2,
  Rows3,
  Search,
} from "lucide-react"
import { CountUp } from "@/components/motion/CountUp"
import { SiteFooter, SiteHeader } from "@/components/layout/SiteChrome"
import { EditorialInput } from "@/components/ui/editorial-field"
import {
  continentLabel,
  fetchCountryTotals,
  type CountryTotal,
  type CountryTotalsDocument,
} from "@/lib/wca-country-totals"

const ROW_HEIGHT = 86
const LIST_HEIGHT = 680
const BAR_WIDTH = 96
const CHART_HEIGHT = 680
const OVERSCAN = 8
const ease = [0.16, 1, 0.3, 1] as const
type ViewMode = "vertical" | "horizontal"

function formatMonth(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return value
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(date)
}

function flagUrl(iso2: string, width = 80) {
  return `https://flagcdn.com/w${width}/${iso2.toLowerCase()}.png`
}

function percentOf(value: number, max: number) {
  if (!max) return 0
  return Math.max(2, (value / max) * 100)
}

function barGlow(rank: number) {
  if (rank === 1) {
    return "rgba(var(--theme-sky-rgb), 0.44)"
  }
  if (rank === 2) {
    return "rgba(var(--theme-bright-rgb), 0.36)"
  }
  if (rank === 3) {
    return "rgba(var(--theme-deep-rgb), 0.32)"
  }
  return "rgba(var(--theme-rgb), 0.18)"
}

function MatrixBarFill({
  direction,
}: {
  direction: "vertical" | "horizontal"
}) {
  const fill =
    direction === "vertical"
      ? "linear-gradient(90deg, rgba(238,242,251,0.95), var(--blue-bright) 30%, var(--blue-deep) 68%, rgba(3,7,18,0.92) 100%)"
      : "linear-gradient(180deg, rgba(238,242,251,0.95), var(--blue-bright) 30%, var(--blue-deep) 68%, rgba(3,7,18,0.92) 100%)"

  return (
    <>
      <div className="absolute inset-0" style={{ background: fill }} />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.34),transparent_28%,rgba(0,0,0,0.28)_100%)]" />
      <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(to_right,rgba(255,255,255,0.35)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.24)_1px,transparent_1px)] [background-size:14px_14px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_15%,rgba(255,255,255,0.42),transparent_34%)]" />
    </>
  )
}

function PodiumCard({
  country,
  rank,
  max,
  index,
}: {
  country: CountryTotal
  rank: number
  max: number
  index: number
}) {
  const height = Math.max(26, percentOf(country.cubers, max))
  const glow = barGlow(rank)

  return (
    <motion.article
      initial={{ opacity: 0, y: 26, rotateX: 12 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.55, delay: Math.min(index * 0.05, 0.2), ease }}
      className="group flex min-h-[18rem] flex-col justify-end rounded-lg border border-border bg-secondary/35 p-4 [perspective:900px]"
    >
      <div className="relative flex h-56 items-end justify-center rounded-lg bg-black/20 px-3 pb-4">
        <div
          className="relative w-full max-w-[5.5rem] origin-bottom rounded-t-lg border border-white/20 transition-transform duration-500 group-hover:-translate-y-2"
          style={{
            height: `${height}%`,
            transform: "rotateX(8deg) rotateY(-8deg)",
            boxShadow: `0 22px 54px -18px ${glow}, inset 12px 0 18px rgba(255,255,255,0.18), inset -16px 0 22px rgba(0,0,0,0.28)`,
          }}
        >
          <MatrixBarFill direction="vertical" />
          <div className="absolute inset-y-0 right-0 w-1/3 rounded-tr-lg bg-black/22" />
          <div className="absolute inset-x-0 top-0 h-4 rounded-t-lg bg-white/40" />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <img
          src={flagUrl(country.iso2)}
          alt={`${country.name} flag`}
          className="h-8 w-11 rounded-[3px] border border-border object-cover shadow-lg"
        />
        <div className="min-w-0">
          <p className="font-data text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            #{rank}
          </p>
          <h3 className="truncate text-sm font-bold leading-tight text-foreground">
            {country.name}
          </h3>
          <p className="stat-num mt-1 text-xs text-muted-foreground">
            {country.cubers.toLocaleString()} cubers
          </p>
        </div>
      </div>
    </motion.article>
  )
}

function VirtualCountryRow({
  country,
  rank,
  max,
  top,
}: {
  country: CountryTotal
  rank: number
  max: number
  top: number
}) {
  const pct = percentOf(country.cubers, max)
  const glow = barGlow(rank)

  return (
    <div
      role="listitem"
      className="absolute inset-x-0 px-3 sm:px-4"
      style={{ top, height: ROW_HEIGHT }}
    >
      <div className="grid h-[76px] grid-cols-[3.25rem_1fr_auto] items-center gap-3 rounded-lg border border-border bg-[rgba(8,12,22,0.54)] px-3 shadow-[inset_0_1px_0_rgba(150,190,255,0.1)] transition-colors hover:border-[rgba(130,170,255,0.28)] hover:bg-[rgba(12,18,32,0.68)] sm:grid-cols-[4.25rem_1.35fr_2fr_auto] sm:px-4">
        <span className="stat-num text-sm text-muted-foreground sm:text-base">#{rank}</span>

        <div className="flex min-w-0 items-center gap-3">
          <img
            src={flagUrl(country.iso2, 40)}
            alt={`${country.name} flag`}
            className="h-7 w-10 rounded-[3px] border border-border object-cover shadow-md"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-foreground sm:text-base">
              {country.name}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {country.iso2} / {continentLabel(country.continentId)}
            </p>
          </div>
        </div>

        <div className="hidden min-w-0 items-center gap-3 sm:flex">
          <div className="relative h-4 flex-1 overflow-hidden rounded-full border border-white/10 bg-black/35 shadow-[inset_0_1px_8px_rgba(0,0,0,0.55)]">
            <div
              className="relative h-full overflow-hidden rounded-full"
              style={{
                width: `${pct}%`,
                boxShadow: `0 0 22px ${glow}, inset 0 1px 0 rgba(255,255,255,0.42)`,
              }}
            >
              <MatrixBarFill direction="horizontal" />
            </div>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/12 to-transparent" />
          </div>
          <span className="stat-num w-12 text-right text-[11px] text-muted-foreground">
            {pct.toFixed(pct < 10 ? 1 : 0)}%
          </span>
        </div>

        <div className="min-w-[5rem] text-right">
          <p className="stat-num text-sm font-bold text-foreground sm:text-base">
            {country.cubers.toLocaleString()}
          </p>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary sm:hidden">
            <div
              className="relative h-full overflow-hidden rounded-full"
              style={{
                width: `${pct}%`,
              }}
            >
              <MatrixBarFill direction="horizontal" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function VirtualCountryList({
  countries,
  max,
}: {
  countries: CountryTotal[]
  max: number
}) {
  const [scrollTop, setScrollTop] = useState(0)
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const totalHeight = countries.length * ROW_HEIGHT
  const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
  const last = Math.min(
    countries.length,
    Math.ceil((scrollTop + LIST_HEIGHT) / ROW_HEIGHT) + OVERSCAN,
  )
  const visible = countries.slice(first, last)

  useEffect(() => {
    const node = scrollerRef.current
    if (!node) return

    const onWheel = (event: WheelEvent) => {
      const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX
      if (!delta) return
      const previous = node.scrollTop
      node.scrollTop += delta
      if (node.scrollTop !== previous) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    node.addEventListener("wheel", onWheel, { passive: false })
    return () => node.removeEventListener("wheel", onWheel)
  }, [])

  return (
    <div className="bezel min-w-0 w-full">
      <div className="bezel-inner overflow-hidden p-0">
        <div className="grid grid-cols-[3.25rem_1fr_auto] border-b border-border px-6 py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground sm:grid-cols-[4.25rem_1.35fr_2fr_auto]">
          <span>Rank</span>
          <span>Country</span>
          <span className="hidden sm:block">Share vs #1</span>
          <span className="text-right">Cubers</span>
        </div>
        <div
          ref={scrollerRef}
          role="list"
          data-testid="country-list-scroller"
          className="relative touch-pan-y overflow-y-auto overscroll-contain py-3 [scrollbar-color:rgba(96,165,250,0.42)_rgba(8,12,22,0.75)] [scrollbar-width:thin]"
          style={{ height: LIST_HEIGHT }}
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        >
          <div className="relative" style={{ height: totalHeight }}>
            {visible.map((country, offset) => (
              <VirtualCountryRow
                key={country.iso2}
                country={country}
                rank={first + offset + 1}
                max={max}
                top={(first + offset) * ROW_HEIGHT}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ContinentDropdown({
  value,
  options,
  onChange,
}: {
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const label = value === "all" ? "All continents" : continentLabel(value)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((next) => !next)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        className="group flex h-12 w-full min-w-56 items-center justify-between gap-4 rounded-lg border border-[rgba(130,170,255,0.22)] bg-[rgba(8,12,22,0.72)] px-4 font-data text-sm font-bold tracking-[0.08em] text-foreground shadow-[inset_0_1px_0_rgba(150,190,255,0.16),0_14px_34px_-22px_rgba(59,130,246,0.8)] backdrop-blur-xl transition hover:border-[rgba(130,170,255,0.42)] hover:bg-[rgba(12,18,32,0.86)]"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{label}</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${open ? "rotate-180 text-foreground" : ""}`} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-full min-w-64 overflow-hidden rounded-lg border border-[rgba(130,170,255,0.28)] bg-[rgba(5,8,16,0.96)] p-1.5 shadow-[0_26px_70px_-28px_rgba(59,130,246,0.8),inset_0_1px_0_rgba(150,190,255,0.16)] backdrop-blur-2xl"
        >
          {["all", ...options].map((option) => {
            const active = option === value
            return (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={active}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(option)
                  setOpen(false)
                }}
                className={`flex h-10 w-full items-center justify-between rounded-md px-3 text-left text-sm font-semibold transition ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-[rgba(var(--theme-rgb),0.1)] hover:text-foreground"
                }`}
              >
                <span>{option === "all" ? "All continents" : continentLabel(option)}</span>
                {active && <span className="h-1.5 w-1.5 rounded-full bg-[var(--rank-nr)]" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ViewToggle({
  value,
  onChange,
}: {
  value: ViewMode
  onChange: (value: ViewMode) => void
}) {
  const items: { value: ViewMode; label: string; icon: typeof Rows3 }[] = [
    { value: "vertical", label: "Vertical", icon: BarChart3 },
    { value: "horizontal", label: "Horizontal", icon: Rows3 },
  ]

  return (
    <div className="inline-grid h-12 grid-cols-2 rounded-lg border border-[rgba(var(--theme-bright-rgb),0.22)] bg-[rgba(8,12,22,0.72)] p-1 shadow-[inset_0_1px_0_rgba(var(--theme-bright-rgb),0.14)]">
      {items.map((item) => {
        const Icon = item.icon
        const active = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={`inline-flex items-center justify-center gap-2 rounded-md px-4 text-sm font-bold transition ${
              active
                ? "bg-primary text-primary-foreground shadow-[0_10px_28px_-16px_rgba(238,242,251,0.65)]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

function VirtualCountryBars({
  countries,
  max,
}: {
  countries: CountryTotal[]
  max: number
}) {
  const [scrollLeft, setScrollLeft] = useState(0)
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ pointerId: number; x: number; left: number } | null>(null)
  const [viewportWidth, setViewportWidth] = useState(940)
  const totalWidth = countries.length * BAR_WIDTH
  const first = Math.max(0, Math.floor(scrollLeft / BAR_WIDTH) - OVERSCAN)
  const last = Math.min(
    countries.length,
    Math.ceil((scrollLeft + viewportWidth) / BAR_WIDTH) + OVERSCAN,
  )
  const visible = countries.slice(first, last)

  useEffect(() => {
    const node = scrollerRef.current
    if (!node) return

    const update = () => setViewportWidth(node.clientWidth || 940)
    update()

    const resizeObserver = new ResizeObserver(update)
    resizeObserver.observe(node)
    return () => resizeObserver.disconnect()
  }, [])

  useEffect(() => {
    const node = scrollerRef.current
    if (!node) return

    const onWheel = (event: WheelEvent) => {
      const delta = Math.abs(event.deltaX) >= Math.abs(event.deltaY) ? event.deltaX : event.deltaY
      if (!delta) return
      const previous = node.scrollLeft
      node.scrollLeft += delta
      if (node.scrollLeft !== previous) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    node.addEventListener("wheel", onWheel, { passive: false })
    return () => node.removeEventListener("wheel", onWheel)
  }, [])

  return (
    <div className="bezel min-w-0 w-full">
      <div className="bezel-inner overflow-hidden p-0">
        <div className="border-b border-border px-5 py-4">
          <div>
            <p className="eyebrow">Vertical bars</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Slide sideways with your trackpad gesture or drag the chart. Bars render only as they enter view.
            </p>
          </div>
        </div>
        <div
          ref={scrollerRef}
          data-testid="country-bar-scroller"
          className="relative cursor-grab touch-pan-x select-none overflow-x-auto overflow-y-hidden overscroll-contain active:cursor-grabbing [scrollbar-color:rgba(var(--theme-bright-rgb),0.42)_rgba(8,12,22,0.75)] [scrollbar-width:thin]"
          style={{ height: CHART_HEIGHT }}
          onScroll={(event) => setScrollLeft(event.currentTarget.scrollLeft)}
          onPointerDown={(event) => {
            dragRef.current = {
              pointerId: event.pointerId,
              x: event.clientX,
              left: event.currentTarget.scrollLeft,
            }
            event.currentTarget.setPointerCapture(event.pointerId)
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current
            if (!drag || drag.pointerId !== event.pointerId) return
            event.currentTarget.scrollLeft = drag.left - (event.clientX - drag.x)
          }}
          onPointerUp={(event) => {
            dragRef.current = null
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId)
            }
          }}
          onPointerCancel={() => {
            dragRef.current = null
          }}
        >
          <div className="relative h-full" style={{ width: totalWidth }}>
            <div className="pointer-events-none absolute inset-x-0 bottom-[112px] h-px bg-border" />
            {visible.map((country, offset) => {
              const rank = first + offset + 1
              const glow = barGlow(rank)
              const pct = percentOf(country.cubers, max)
              return (
                <div
                  key={country.iso2}
                  className="group absolute bottom-0 flex h-full flex-col items-center justify-end px-2"
                  style={{ left: (first + offset) * BAR_WIDTH, width: BAR_WIDTH }}
                >
                  <div className="relative flex h-[500px] w-full items-end justify-center pb-4">
                    <div
                      className="relative w-14 overflow-hidden rounded-t-xl border border-white/15 transition-transform duration-300 group-hover:-translate-y-1"
                      style={{
                        height: `${Math.max(4, pct)}%`,
                        boxShadow: `0 22px 52px -20px ${glow}, inset 0 1px 0 rgba(255,255,255,0.42), inset -12px 0 22px rgba(0,0,0,0.24)`,
                      }}
                    >
                      <MatrixBarFill direction="vertical" />
                      <div className="absolute inset-x-0 top-0 h-4 bg-white/28" />
                      <div className="absolute inset-y-0 right-0 w-4 bg-black/16" />
                    </div>
                    <div className="absolute bottom-7 rounded-md border border-border bg-black/65 px-2 py-1 opacity-0 shadow-xl backdrop-blur transition group-hover:opacity-100">
                      <p className="stat-num whitespace-nowrap text-[11px] text-foreground">
                        {country.cubers.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex h-28 w-full flex-col items-start border-t border-border pt-3 text-left">
                    <img
                      src={flagUrl(country.iso2, 40)}
                      alt={`${country.name} flag`}
                      className="h-5 w-8 rounded-[2px] border border-border object-cover"
                    />
                    <p className="stat-num mt-2 text-[10px] text-muted-foreground">#{rank}</p>
                    <p className="mt-1 line-clamp-2 text-xs font-bold leading-tight text-foreground">
                      {country.name}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CountriesPage() {
  const [totalsDoc, setTotalsDoc] = useState<CountryTotalsDocument | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [continent, setContinent] = useState("all")
  const [view, setView] = useState<ViewMode>("vertical")

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    fetchCountryTotals(controller.signal)
      .then((next) => {
        setTotalsDoc(next)
        setError("")
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return
        setError(err instanceof Error ? err.message : "Unable to load country totals")
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [])

  const continents = useMemo(() => {
    if (!totalsDoc) return []
    return Array.from(new Set(totalsDoc.countries.map((country) => country.continentId))).sort()
  }, [totalsDoc])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return (totalsDoc?.countries ?? []).filter((country) => {
      const matchesQuery =
        !needle ||
        country.name.toLowerCase().includes(needle) ||
        country.iso2.toLowerCase().includes(needle)
      const matchesContinent = continent === "all" || country.continentId === continent
      return matchesQuery && matchesContinent
    })
  }, [continent, totalsDoc, query])

  const overallMax = totalsDoc?.countries[0]?.cubers ?? 1
  const podium = totalsDoc?.countries.slice(0, 3) ?? []

  return (
    <div className="editorial-page flex min-h-[100dvh] flex-col">
      <div className="editorial-shell flex min-h-[100dvh] flex-col">
        <SiteHeader active="countries" />

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6">
          <section className="grid min-h-[calc(100dvh-7.5rem)] items-center gap-10 border-b border-border py-12 lg:grid-cols-12 lg:py-16">
            <motion.div
              className="lg:col-span-5"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, ease }}
            >
              <h1 className="display-title max-w-xl text-[2.85rem] text-foreground sm:text-6xl md:text-7xl">
                Cubers by country.
              </h1>
              <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
                A monthly WCA export view of how many unique current cubers are represented
                in each country.
              </p>
              <div className="mt-8 grid max-w-lg grid-cols-2 gap-3">
                <div className="surface-card rounded-lg p-4">
                  <p className="eyebrow">Total cubers</p>
                  <p className="stat-num mt-3 text-3xl font-bold text-foreground sm:text-4xl">
                    {totalsDoc ? <CountUp value={totalsDoc.totalCubers} /> : "--"}
                  </p>
                </div>
                <div className="surface-card rounded-lg p-4">
                  <p className="eyebrow">Countries</p>
                  <p className="stat-num mt-3 text-3xl font-bold text-foreground sm:text-4xl">
                    {totalsDoc ? <CountUp value={totalsDoc.countries.length} /> : "--"}
                  </p>
                </div>
              </div>
              {totalsDoc && (
                <p className="mt-5 text-xs text-muted-foreground">
                  Updated from the {formatMonth(totalsDoc.source.exportDate)} WCA results export.
                </p>
              )}
            </motion.div>

            <motion.div
              className="lg:col-span-7"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.08, ease }}
            >
              <div className="bezel">
                <div className="bezel-inner p-5 sm:p-6">
                  <div className="mb-5 flex items-center justify-between gap-3 border-b border-border pb-4">
                    <div>
                      <p className="eyebrow">Top countries</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Leading WCA populations from the latest export
                      </p>
                    </div>
                    <span className="facelet facelet-wr">WCA</span>
                  </div>

                  {loading && (
                    <div className="grid h-[24rem] place-items-center">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  )}

                  {!loading && error && (
                    <div className="grid h-[24rem] place-items-center text-center">
                      <div>
                        <p className="font-display text-xl font-bold text-foreground">
                          Country totals are not published yet.
                        </p>
                        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                          The next data workflow run will publish country-totals.json beside
                          rank-totals.json.
                        </p>
                      </div>
                    </div>
                  )}

                  {!loading && !error && podium.length > 0 && (
                    <div className="grid gap-3 sm:grid-cols-3">
                      {podium.map((country, index) => (
                        <PodiumCard
                          key={country.iso2}
                          country={country}
                          rank={index + 1}
                          max={overallMax}
                          index={index}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </section>

          <section className="border-b border-border py-8">
            <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto] lg:items-center">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <EditorialInput
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search country or ISO code"
                  className="pl-11"
                />
              </label>
              <ContinentDropdown
                value={continent}
                options={continents}
                onChange={setContinent}
              />
              <ViewToggle value={view} onChange={setView} />
              <a
                href={totalsDoc?.source.url ?? "https://www.worldcubeassociation.org/export/results"}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost inline-flex h-12 items-center justify-center gap-2 rounded-lg px-4 text-sm"
              >
                Source
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </section>

          <section className="py-10 sm:py-12">
            <div className="mb-6 flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
                  Complete country ladder
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {filtered.length.toLocaleString()} ranked countries. The {view} view virtualizes
                  while you scroll.
                </p>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-[var(--rank-nr)] shadow-[0_0_16px_rgba(61,255,168,0.7)]" />
                <span>Values are scaled against the current #1 country</span>
              </div>
            </div>

            {loading && (
              <div className="bezel">
                <div className="bezel-inner space-y-3 p-4">
                  {Array.from({ length: 8 }).map((_, index) => (
                    <div key={index} className="skeleton-shimmer h-[76px] rounded-lg" />
                  ))}
                </div>
              </div>
            )}

            {!loading && !error && filtered.length === 0 && (
              <div className="surface-card rounded-lg p-8 text-center">
                <p className="font-display text-xl font-bold text-foreground">No countries found</p>
                <p className="mt-2 text-sm text-muted-foreground">Try a shorter search.</p>
              </div>
            )}

            {!loading && !error && filtered.length > 0 && (
              <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
                {view === "vertical" ? (
                  <VirtualCountryBars countries={filtered} max={overallMax} />
                ) : (
                  <VirtualCountryList countries={filtered} max={overallMax} />
                )}
                <aside className="bezel lg:relative lg:before:absolute lg:before:-left-3 lg:before:top-2 lg:before:h-[calc(100%-1rem)] lg:before:w-px lg:before:bg-gradient-to-b lg:before:from-transparent lg:before:via-[rgba(var(--theme-bright-rgb),0.42)] lg:before:to-transparent">
                  <div className="bezel-inner flex h-full flex-col justify-between p-5">
                    <div>
                      <p className="eyebrow">Metric</p>
                      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                        Counts unique current WCA persons by country, using the latest published
                        WCA results export. The GitHub workflow refreshes the JSON on its daily
                        data run and skips publishing when the export has not changed.
                      </p>
                      <div className="mt-6 grid grid-cols-2 gap-3">
                        <div className="rounded-lg border border-border bg-secondary/45 p-3">
                          <p className="eyebrow">Visible rows</p>
                          <p className="stat-num mt-2 text-xl text-foreground">
                            {Math.min(filtered.length, Math.ceil(LIST_HEIGHT / ROW_HEIGHT) + OVERSCAN * 2)}
                          </p>
                        </div>
                        <div className="rounded-lg border border-border bg-secondary/45 p-3">
                          <p className="eyebrow">Total rows</p>
                          <p className="stat-num mt-2 text-xl text-foreground">
                            {filtered.length}
                          </p>
                        </div>
                      </div>
                    </div>
                    <a
                      href="/"
                      className="btn-solid mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-lg text-sm"
                    >
                      Lookup a cuber
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  </div>
                </aside>
              </div>
            )}
          </section>
        </main>

        <SiteFooter />
      </div>
    </div>
  )
}
