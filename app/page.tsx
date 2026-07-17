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
import { CountUp } from "@/components/motion/CountUp"
import { ExternalLink, Loader2, ArrowRight, Users } from "lucide-react"
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
    rank: { nr: number; cr: number; wr: number }
  }
  average: {
    nr: RegionStats
    cr: RegionStats
    wr: RegionStats
    rank: { nr: number; cr: number; wr: number }
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
    <div className="flex items-center justify-between gap-3 py-1">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium tracking-wide ${chip}`}>
          {scope}
        </span>
        <span className="tabular-nums text-sm text-foreground">#{rank.toLocaleString()}</span>
      </div>
      {pct && (
        <span className="tabular-nums text-xs text-muted-foreground shrink-0">{pct}</span>
      )}
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
    <article className="surface-card surface-card-hover rounded-lg p-5 h-full flex flex-col">
      <header className="flex items-start justify-between gap-3 mb-5">
        <div className="min-w-0 pt-0.5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground mb-1">
            Event
          </p>
          <h3 className="text-[15px] font-medium tracking-tight text-foreground leading-snug">
            {eventDisplayName(eventId)}
          </h3>
        </div>
        {bestWrPercent !== null && (
          <PercentileRing
            topPercent={bestWrPercent}
            size={68}
            stroke={2.5}
            label="WR"
            className="shrink-0"
          />
        )}
      </header>

      <div className="space-y-4 flex-1">
        {record.single && (
          <section>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Single
              </span>
              <span className="tabular-nums text-xl font-medium tracking-tight text-foreground">
                {formatResult(eventId, record.single.best, "single")}
              </span>
            </div>
            <div className="border-t border-border pt-1.5">
              <RankRow scope="NR" rank={eventStats.single.rank.nr} topPercent={eventStats.single.nr.topPercent} />
              <RankRow scope="CR" rank={eventStats.single.rank.cr} topPercent={eventStats.single.cr.topPercent} />
              <RankRow scope="WR" rank={eventStats.single.rank.wr} topPercent={eventStats.single.wr.topPercent} />
            </div>
          </section>
        )}

        {record.average && (
          <section className={record.single ? "border-t border-border pt-4" : ""}>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Average
              </span>
              <span className="tabular-nums text-xl font-medium tracking-tight text-foreground">
                {formatResult(eventId, record.average.best, "average")}
              </span>
            </div>
            <div className="border-t border-border pt-1.5">
              <RankRow scope="NR" rank={eventStats.average.rank.nr} topPercent={eventStats.average.nr.topPercent} />
              <RankRow scope="CR" rank={eventStats.average.rank.cr} topPercent={eventStats.average.cr.topPercent} />
              <RankRow scope="WR" rank={eventStats.average.rank.wr} topPercent={eventStats.average.wr.topPercent} />
            </div>
          </section>
        )}
      </div>
    </article>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      <div className="surface-card rounded-lg p-6">
        <div className="flex items-center gap-4">
          <div className="skeleton-shimmer h-14 w-14 rounded-full" />
          <div className="flex-1 space-y-2.5">
            <div className="skeleton-shimmer h-4 w-44 rounded" />
            <div className="skeleton-shimmer h-3 w-28 rounded" />
          </div>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="surface-card rounded-lg p-5 space-y-4">
            <div className="skeleton-shimmer h-3 w-16 rounded" />
            <div className="skeleton-shimmer h-4 w-28 rounded" />
            <div className="skeleton-shimmer h-8 w-20 rounded ml-auto" />
            <div className="skeleton-shimmer h-3 w-full rounded" />
            <div className="skeleton-shimmer h-3 w-4/5 rounded" />
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
      const playerResponse = await fetch(
        `https://www.worldcubeassociation.org/api/v0/persons/${normalizedWcaId}`,
      )

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

  return (
    <div className="editorial-page">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5" data-cursor="hover">
            <span className="flex h-6 w-6 items-center justify-center rounded border border-border text-[10px] font-semibold tracking-tight">
              C
            </span>
            <span className="text-sm font-medium tracking-tight">Cubify</span>
          </Link>
          <nav className="flex items-center gap-1">
            <Link
              href="/compare"
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary"
              data-cursor="hover"
            >
              <Users className="h-3.5 w-3.5" />
              Compare
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Hero — left editorial, not centered carnival */}
        {!hasResults && !loading && (
          <section className="grid gap-10 border-b border-border py-16 md:grid-cols-12 md:gap-8 md:py-24">
            <Reveal className="md:col-span-7">
              <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                WCA stats analyzer
              </p>
              <h1 className="max-w-xl text-4xl font-medium tracking-tight text-foreground sm:text-5xl md:text-[3.25rem] md:leading-[1.1]">
                Know exactly where you rank.
              </h1>
              <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted-foreground">
                Live NR, CR, and WR ranks with Top X% percentiles for every official event —
                built for the speedcubing community.
              </p>
            </Reveal>

            <Reveal delay={0.06} className="md:col-span-5 md:pt-2">
              <div className="surface-card rounded-lg p-5 sm:p-6">
                <label className="mb-3 block text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  WCA ID
                </label>
                <Input
                  placeholder="2022RPRA01"
                  value={wcaId}
                  onChange={(e) => setWcaId(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && fetchStats()}
                  disabled={loading}
                  className="input-editorial mb-3"
                  autoFocus
                />
                <Magnetic className="w-full" strength={0.2}>
                  <Button
                    onClick={fetchStats}
                    disabled={loading}
                    className="btn-solid w-full h-11 rounded-md text-sm"
                    data-cursor="hover"
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
                  </Button>
                </Magnetic>
                <AnimatePresence>
                  {error && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="mt-3 text-sm text-red-400"
                    >
                      {error}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Try any official WCA ID · Data from the World Cube Association
              </p>
            </Reveal>
          </section>
        )}

        {/* Compact search when results shown */}
        {(hasResults || loading) && (
          <section className="border-b border-border py-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Lookup
                </p>
                <p className="text-sm text-foreground mt-0.5">Another competitor</p>
              </div>
              <div className="flex w-full max-w-md gap-2">
                <Input
                  placeholder="WCA ID"
                  value={wcaId}
                  onChange={(e) => setWcaId(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && fetchStats()}
                  disabled={loading}
                  className="input-editorial flex-1"
                />
                <Button
                  onClick={fetchStats}
                  disabled={loading}
                  className="btn-solid h-11 rounded-md px-4 shrink-0"
                  data-cursor="hover"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Go"}
                </Button>
              </div>
            </div>
            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mt-3 text-sm text-red-400"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>
          </section>
        )}

        {loading && (
          <section className="py-10">
            <LoadingSkeleton />
          </section>
        )}

        {playerInfo && !loading && (
          <section className="py-10">
            <Reveal>
              <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex items-start gap-4">
                  {playerInfo.avatar?.url ? (
                    <img
                      src={playerInfo.avatar.url}
                      alt={playerInfo.name}
                      className="h-16 w-16 rounded-full object-cover border border-border"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border text-lg font-medium text-muted-foreground">
                      {playerInfo.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-medium tracking-tight text-foreground">
                      {playerInfo.name}
                    </h2>
                    <div className="mt-2 flex flex-wrap items-center gap-2.5 text-sm text-muted-foreground">
                      <img
                        src={`https://flagcdn.com/20x15/${playerInfo.country.iso2}.png`}
                        alt={playerInfo.country.name}
                        className="rounded-[2px]"
                      />
                      <span>{playerInfo.country.name}</span>
                      <span className="text-border">·</span>
                      <Badge
                        variant="outline"
                        className="font-mono text-[11px] tabular-nums rounded border-border bg-transparent font-normal"
                      >
                        {playerInfo.wca_id}
                      </Badge>
                      {eventCount > 0 && (
                        <>
                          <span className="text-border">·</span>
                          <span>
                            <CountUp value={eventCount} className="text-foreground font-medium" />{" "}
                            events
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
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  data-cursor="hover"
                >
                  WCA profile
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
              {rankTotalsSource ? (
                <p className="mt-4 text-xs text-muted-foreground">
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
                <p className="mt-4 text-xs text-amber-500/90">
                  Official ranks loaded; percentage totals temporarily unavailable.
                </p>
              )}
            </Reveal>
          </section>
        )}

        {eventsData && playerInfo && !loading && (
          <section className="pb-16">
            <div className="mb-5 flex items-baseline justify-between border-b border-border pb-3">
              <h3 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Results
              </h3>
              <span className="text-xs tabular-nums text-muted-foreground">
                {eventCount} events
              </span>
            </div>
            <Stagger
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
              stagger={0.04}
            >
              {Object.entries(eventsData).map(([eventId, eventStats]) => (
                <StaggerItem key={eventId} className="h-full min-h-0">
                  <EventCard eventId={eventId} eventStats={eventStats} playerInfo={playerInfo} />
                </StaggerItem>
              ))}
            </Stagger>
          </section>
        )}
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs text-muted-foreground">
            Records derived from official WCA data
          </p>
          <p className="text-xs text-muted-foreground">Cubify</p>
        </div>
      </footer>
    </div>
  )
}
