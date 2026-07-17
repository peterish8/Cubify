"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { Magnetic } from "@/components/motion/Magnetic"
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal"
import { TiltCard } from "@/components/motion/TiltCard"
import { CountUp } from "@/components/motion/CountUp"
import { ExternalLink, Search, Trophy, Loader2, Zap, Users } from "lucide-react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"

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
    rank: {
      nr: number
      cr: number
      wr: number
    }
  }
  average: {
    nr: RegionStats
    cr: RegionStats
    wr: RegionStats
    rank: {
      nr: number
      cr: number
      wr: number
    }
  }
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
  const chip = scope === "NR" ? "chip-nr" : scope === "CR" ? "chip-cr" : "chip-wr"
  const pct = formatTopPercent(topPercent)

  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <div className="flex items-center gap-2">
        <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${chip}`}>
          {scope}
        </span>
        <span className="tabular-nums text-foreground/90 font-medium">#{rank.toLocaleString()}</span>
      </div>
      {pct && <span className="tabular-nums text-xs text-muted-foreground font-medium">{pct}</span>}
    </div>
  )
}

function EventCard({
  eventId,
  eventStats,
  playerInfo,
}: {
  eventId: string
  eventStats: EventStats
  playerInfo: PlayerInfo
}) {
  const record = playerInfo.personal_records[eventId]
  const bestWrPercent =
    eventStats.single.wr.topPercent ?? eventStats.average.wr.topPercent ?? null

  return (
    <TiltCard className="h-full">
      <div className="surface-card surface-card-hover rounded-2xl p-5 h-full flex flex-col">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Trophy size={16} />
            </div>
            <h3 className="text-base font-semibold text-foreground truncate">
              {eventDisplayName(eventId)}
            </h3>
          </div>
          {bestWrPercent !== null && (
            <PercentileRing
              topPercent={bestWrPercent}
              size={72}
              stroke={5}
              label="WR"
              className="shrink-0 -mt-1"
            />
          )}
        </div>

        <div className="space-y-4 flex-1">
          {record.single && (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                  Single
                </span>
                <span className="tabular-nums text-lg font-semibold text-foreground">
                  {formatResult(eventId, record.single.best, "single")}
                </span>
              </div>
              <div className="space-y-1.5 pl-0.5">
                <RankRow scope="NR" rank={eventStats.single.rank.nr} topPercent={eventStats.single.nr.topPercent} />
                <RankRow scope="CR" rank={eventStats.single.rank.cr} topPercent={eventStats.single.cr.topPercent} />
                <RankRow scope="WR" rank={eventStats.single.rank.wr} topPercent={eventStats.single.wr.topPercent} />
              </div>
            </div>
          )}

          {record.average && (
            <div className="space-y-2 border-t border-border/50 pt-3">
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                  Average
                </span>
                <span className="tabular-nums text-lg font-semibold text-foreground">
                  {formatResult(eventId, record.average.best, "average")}
                </span>
              </div>
              <div className="space-y-1.5 pl-0.5">
                <RankRow scope="NR" rank={eventStats.average.rank.nr} topPercent={eventStats.average.nr.topPercent} />
                <RankRow scope="CR" rank={eventStats.average.rank.cr} topPercent={eventStats.average.cr.topPercent} />
                <RankRow scope="WR" rank={eventStats.average.rank.wr} topPercent={eventStats.average.wr.topPercent} />
              </div>
            </div>
          )}
        </div>
      </div>
    </TiltCard>
  )
}

function LoadingSkeleton() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="surface-card rounded-2xl p-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-4">
          <div className="skeleton-shimmer h-16 w-16 rounded-full" />
          <div className="flex-1 space-y-3">
            <div className="skeleton-shimmer h-5 w-48 rounded-md" />
            <div className="skeleton-shimmer h-4 w-32 rounded-md" />
          </div>
        </div>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="surface-card rounded-2xl p-5 space-y-4">
            <div className="flex justify-between">
              <div className="skeleton-shimmer h-5 w-28 rounded-md" />
              <div className="skeleton-shimmer h-16 w-16 rounded-full" />
            </div>
            <div className="skeleton-shimmer h-4 w-full rounded-md" />
            <div className="skeleton-shimmer h-4 w-3/4 rounded-md" />
            <div className="skeleton-shimmer h-4 w-2/3 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function CubifyAnalyzer() {
  const [wcaId, setWcaId] = useState("")
  const [loading, setLoading] = useState(false)
  const [playerInfo, setPlayerInfo] = useState<PlayerInfo | null>(null)
  const [eventsData, setEventsData] = useState<Record<string, EventStats> | null>(null)
  const [rankTotalsSource, setRankTotalsSource] = useState<RankTotalsDocument["source"] | null>(null)
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
      const rankTotalsPromise: Promise<RankTotalsDocument | null> = fetchRankTotals().catch((totalsError) => {
        console.error("Rank percentages are temporarily unavailable", totalsError)
        return null
      })
      const playerResponse = await fetch(`https://www.worldcubeassociation.org/api/v0/persons/${normalizedWcaId}`)

      if (!playerResponse.ok) {
        throw new Error("Player not found. Please check the WCA ID.")
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

      for (const [eventId, records] of Object.entries(playerData.personal_records || {}) as [string, any][]) {
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
      if (rankTotals) {
        setRankTotalsSource(rankTotals.source)
      }

      const eventIds = Object.keys(transformedPlayer.personal_records)
      const allEventsData: Record<string, EventStats> = {}

      for (const eventId of eventIds) {
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

  return (
    <div className="editorial-bg relative overflow-hidden">
      <div className="container mx-auto px-4 py-10 md:py-14 relative z-10">
        {/* Header */}
        <Reveal className="text-center mb-12 md:mb-16">
          <p className="text-xs font-medium tracking-[0.25em] uppercase text-primary mb-3">
            WCA Stats Analyzer
          </p>
          <h1 className="font-heading text-5xl md:text-6xl font-bold tracking-tight text-foreground mb-4">
            CUBIFY
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto text-balance text-base md:text-lg leading-relaxed">
            See where you stand — national, continental, and world percentiles across every event.
          </p>
          <div className="mt-7">
            <Magnetic>
              <Link href="/compare">
                <Button
                  variant="outline"
                  className="rounded-xl border-border bg-card/40 hover:bg-card hover:border-primary/40 gap-2"
                  data-cursor="hover"
                >
                  <Users className="h-4 w-4" />
                  Compare players
                </Button>
              </Link>
            </Magnetic>
          </div>
        </Reveal>

        {/* Search */}
        <Reveal delay={0.08} className="max-w-md mx-auto mb-12">
          <div className="surface-card rounded-2xl p-6">
            <div className="flex items-center gap-2.5 mb-1">
              <Search className="text-primary" size={18} />
              <h2 className="text-sm font-semibold tracking-wide text-foreground">Enter WCA ID</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              Pull live rankings and Top X% percentiles for all events
            </p>
            <div className="space-y-3">
              <Input
                placeholder="e.g. 2022RPRA01"
                value={wcaId}
                onChange={(e) => setWcaId(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && fetchStats()}
                disabled={loading}
                className="input-editorial"
              />
              <Magnetic className="w-full" strength={0.25}>
                <Button
                  onClick={fetchStats}
                  disabled={loading}
                  className="btn-primary-glow w-full h-12 rounded-xl text-sm tracking-wide"
                  data-cursor="hover"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing…
                    </>
                  ) : (
                    <>
                      <Zap className="mr-2 h-4 w-4" />
                      Fetch stats
                    </>
                  )}
                </Button>
              </Magnetic>
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-sm text-center p-3 rounded-xl bg-destructive/10 border border-destructive/25 text-red-300"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </Reveal>

        {/* Loading */}
        <AnimatePresence mode="wait">
          {loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mb-10"
            >
              <LoadingSkeleton />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Player profile */}
        {playerInfo && !loading && (
          <Reveal className="max-w-2xl mx-auto mb-10">
            <div className="surface-card rounded-2xl p-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
                {playerInfo.avatar?.url && (
                  <img
                    src={playerInfo.avatar.url}
                    alt={playerInfo.name}
                    className="w-16 h-16 rounded-full object-cover ring-2 ring-border"
                  />
                )}
                <div className="min-w-0">
                  <h3 className="text-xl md:text-2xl font-semibold text-foreground truncate">
                    {playerInfo.name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2.5 mt-2">
                    <img
                      src={`https://flagcdn.com/24x18/${playerInfo.country.iso2}.png`}
                      alt={playerInfo.country.name}
                      className="rounded"
                    />
                    <span className="text-sm text-muted-foreground">{playerInfo.country.name}</span>
                    <Badge
                      variant="outline"
                      className="font-mono text-xs tabular-nums border-primary/30 text-primary bg-primary/10"
                    >
                      {playerInfo.wca_id}
                    </Badge>
                    {eventCount > 0 && (
                      <span className="text-xs text-muted-foreground">
                        <CountUp value={eventCount} className="font-semibold text-foreground" /> events
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Button variant="outline" size="sm" asChild className="rounded-lg border-border hover:border-primary/40">
                <a
                  href={`https://www.worldcubeassociation.org/persons/${playerInfo.wca_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                  data-cursor="hover"
                >
                  View WCA profile <ExternalLink size={14} />
                </a>
              </Button>
            </div>
            {rankTotalsSource ? (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Rank totals based on official WCA results as of {formatExportDate(rankTotalsSource.exportDate)}.{" "}
                <a
                  href={rankTotalsSource.url}
                  target="_blank"
                  rel="noreferrer"
                  title={rankTotalsSource.attribution}
                  className="underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  {rankTotalsSource.attribution}
                </a>
              </p>
            ) : (
              <p className="mt-3 text-center text-xs text-amber-300/80">
                Official ranks are available; percentage totals are temporarily unavailable.
              </p>
            )}
          </Reveal>
        )}

        {/* Event grid */}
        {eventsData && playerInfo && !loading && (
          <Stagger className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-7xl mx-auto" stagger={0.06}>
            {Object.entries(eventsData).map(([eventId, eventStats]) => (
              <StaggerItem key={eventId}>
                <EventCard eventId={eventId} eventStats={eventStats} playerInfo={playerInfo} />
              </StaggerItem>
            ))}
          </Stagger>
        )}

        {/* Empty state */}
        {!loading && !playerInfo && !error && (
          <Reveal delay={0.15} className="max-w-lg mx-auto text-center mt-4">
            <div className="surface-card rounded-2xl p-8 border-dashed">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Trophy size={22} />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Enter a WCA ID to unlock Top X% percentiles, NR/CR/WR ranks, and personal bests —
                designed for the speedcubing community.
              </p>
            </div>
          </Reveal>
        )}

        <footer className="text-center mt-16 space-y-1.5 pb-6">
          <p className="text-xs text-muted-foreground">
            Player records and rank totals derived from official WCA data
          </p>
          <p className="text-[11px] tracking-widest uppercase text-muted-foreground/60">
            Built for the speedcubing community
          </p>
        </footer>
      </div>
    </div>
  )
}
