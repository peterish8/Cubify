"use client"

import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import {
  calculateTopPercent,
  fetchRankTotals,
  formatTopPercent,
  getScopedTotals,
  type RankTotalsDocument,
} from "@/lib/wca-rank-totals"
import { eventDisplayName } from "@/lib/wca-events"
import { formatResult } from "@/lib/wca-format"
import { PercentileRing } from "@/components/PercentileRing"
import { CountUp } from "@/components/motion/CountUp"
import { SiteFooter, SiteHeader } from "@/components/layout/SiteChrome"
import { EditorialButton, EditorialInput } from "@/components/ui/editorial-field"
import { ExternalLink, Loader2, ArrowRight } from "lucide-react"
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

const FEATURED_EVENTS = new Set(["333", "222", "444", "333oh", "555", "333bf"])
const ease = [0.16, 1, 0.3, 1] as const

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
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className={`facelet ${face}`}>{scope}</span>
        <span className="stat-num text-[13px] text-foreground">
          #{rank.toLocaleString()}
        </span>
      </div>
      {pct && (
        <span className="stat-num shrink-0 text-[11px] text-muted-foreground">{pct}</span>
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
    <div className="rounded-lg border border-border bg-secondary/60 p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </span>
        <span className="time-display text-2xl text-foreground sm:text-3xl">{time}</span>
      </div>
      <div className="border-t border-border/80 pt-1.5">
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
  featured,
  index,
}: {
  eventId: string
  eventStats: EventStats
  playerInfo: PlayerInfo
  featured?: boolean
  index: number
}) {
  const record = playerInfo.personal_records[eventId]
  const bestWrPercent =
    eventStats.single.wr.topPercent ?? eventStats.average.wr.topPercent ?? null

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: Math.min(index * 0.035, 0.35), ease }}
      className={cn(
        "surface-card surface-card-hover flex h-full flex-col rounded-xl p-5 sm:p-6",
        featured && "ring-1 ring-[var(--rank-nr)]/20",
      )}
    >
      <header className="mb-5 flex items-start justify-between gap-3 border-b border-border pb-4">
        <div>
          {featured && (
            <span className="mb-2 inline-block rounded-full border border-border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Featured
            </span>
          )}
          <h3 className="font-display text-lg font-extrabold leading-tight tracking-tight text-foreground">
            {eventDisplayName(eventId)}
          </h3>
          <p className="mt-1 font-data text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {eventId}
          </p>
        </div>
        {bestWrPercent !== null && (
          <PercentileRing
            topPercent={bestWrPercent}
            size={featured ? 84 : 72}
            stroke={3}
            label="WR"
            className="shrink-0"
          />
        )}
      </header>

      <div className="flex flex-1 flex-col gap-3">
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
              className="inline-flex h-12 shrink-0 items-center justify-center rounded-lg px-5"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Go"}
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
      <div className="bezel-inner p-6 sm:p-8">
        <label className="eyebrow mb-4 block">Enter WCA ID</label>
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
          className="inline-flex h-12 w-full items-center justify-center rounded-lg text-sm"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading
            </>
          ) : (
            <>
              Look up
              <ArrowRight className="ml-2 h-4 w-4" />
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
        <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
          <p className="text-[11px] text-muted-foreground">Any official WCA ID</p>
          <div className="flex gap-1">
            <span className="facelet facelet-nr">NR</span>
            <span className="facelet facelet-cr">CR</span>
            <span className="facelet facelet-wr">WR</span>
          </div>
        </div>
      </div>
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
  const [error, setError] = useState("")

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

    setLoading(true)
    setError("")
    setPlayerInfo(null)
    setEventsData(null)
    setRankTotalsSource(null)

    try {
      const rankTotalsPromise: Promise<RankTotalsDocument | null> = fetchRankTotals().catch(
        (totalsError) => {
          console.error("Rank percentages are temporarily unavailable", totalsError)
          return null
        },
      )
      const playerResponse = await fetch(
        `https://www.worldcubeassociation.org/api/v0/persons/${normalizedWcaId}`,
      )

      if (!playerResponse.ok) {
        throw new Error("Player not found. Check the WCA ID and try again.")
      }

      const playerData = await playerResponse.json()
      const player = playerData.person

      if (!player || !player.name) {
        throw new Error("Invalid player data received from API")
      }

      const countryIso = (player.country?.iso2 || player.country_iso2 || "XX").toUpperCase()
      const continentId = player.country?.continent_id || ""
      const continent = continentId.replace(/^_/, "")

      const transformedPlayer: PlayerInfo = {
        name: player.name,
        country: {
          name: player.country?.name || countryIso,
          iso2: countryIso.toLowerCase(),
          continentId,
        },
        continent,
        wca_id: player.wca_id || player.id || normalizedWcaId,
        avatar: player.avatar?.url ? { url: player.avatar.url } : undefined,
        personal_records: {},
      }

      for (const [eventId, records] of Object.entries(playerData.personal_records || {}) as [
        string,
        any,
      ][]) {
        transformedPlayer.personal_records[eventId] = {}

        if (records.single) {
          transformedPlayer.personal_records[eventId].single = {
            best: records.single.best,
            world_ranking: records.single.world_rank,
            continental_ranking: records.single.continent_rank,
            national_ranking: records.single.country_rank,
          }
        }

        if (records.average) {
          transformedPlayer.personal_records[eventId].average = {
            best: records.average.best,
            world_ranking: records.average.world_rank,
            continental_ranking: records.average.continent_rank,
            national_ranking: records.average.country_rank,
          }
        }
      }

      if (Object.keys(transformedPlayer.personal_records).length === 0) {
        throw new Error("No competition records found for this player.")
      }

      setPlayerInfo(transformedPlayer)

      const rankTotals = await rankTotalsPromise
      if (rankTotals) setRankTotalsSource(rankTotals.source)

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

      setEventsData(allEventsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred while fetching data")
    } finally {
      setLoading(false)
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

  const sortedEvents = useMemo(() => {
    if (!eventsData) return []
    return Object.entries(eventsData).sort(([a], [b]) => {
      const af = FEATURED_EVENTS.has(a) ? 0 : 1
      const bf = FEATURED_EVENTS.has(b) ? 0 : 1
      if (af !== bf) return af - bf
      return a.localeCompare(b)
    })
  }, [eventsData])

  return (
    <div className="editorial-page flex min-h-[100dvh] flex-col">
      <div className="editorial-shell flex min-h-[100dvh] flex-col">
        <SiteHeader active="home" />

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6">
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
                    WCA stats
                  </span>
                </div>
                <h1 className="display-title max-w-xl text-[2.75rem] text-foreground sm:text-6xl md:text-7xl">
                  Know exactly
                  <br />
                  where you rank.
                </h1>
                <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
                  Live NR, CR, and WR with real Top X% across every official event.
                </p>
                <div className="mt-8 flex flex-wrap gap-2">
                  <span className="rounded-full border border-border px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                    Official WCA data
                  </span>
                  <span className="rounded-full border border-border px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                    All events
                  </span>
                  <span className="rounded-full border border-border px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                    True percentiles
                  </span>
                </div>
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
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[var(--rank-nr)]/6 via-transparent to-[var(--rank-cr)]/5" />
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
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--rank-nr)]">
                          Competitor
                        </p>
                        <h2 className="font-display mt-1 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                          {playerInfo.name}
                        </h2>
                        <div className="mt-2.5 flex flex-wrap items-center gap-2.5 text-sm text-muted-foreground">
                          <img
                            src={`https://flagcdn.com/20x15/${playerInfo.country.iso2}.png`}
                            alt={playerInfo.country.name}
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
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="bezel">
                    <div className="bezel-inner p-5 sm:p-6">
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
                    <div className="bezel-inner p-5 sm:p-6">
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
                    <div className="bezel-inner p-5 sm:p-6">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                        Events ranked
                      </p>
                      <p className="time-display mt-3 text-4xl text-foreground sm:text-5xl">
                        <CountUp value={eventCount} />
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">With official PRs</p>
                      <div className="mt-3 flex gap-1">
                        <span className="facelet facelet-nr">NR</span>
                        <span className="facelet facelet-cr">CR</span>
                        <span className="facelet facelet-wr">WR</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {eventsData && playerInfo && !loading && (
            <section className="pb-20">
              <div className="mb-6 flex items-end justify-between border-b border-border pb-4">
                <div>
                  <h3 className="font-display text-2xl font-extrabold tracking-tight">
                    Event board
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Face by face · times, ranks, percentiles
                  </p>
                </div>
                <span className="stat-num text-sm text-muted-foreground">
                  {eventCount} events
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {sortedEvents.map(([eventId, eventStats], index) => (
                  <EventCard
                    key={eventId}
                    eventId={eventId}
                    eventStats={eventStats}
                    playerInfo={playerInfo}
                    featured={FEATURED_EVENTS.has(eventId)}
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
