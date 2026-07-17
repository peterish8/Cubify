"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Magnetic } from "@/components/motion/Magnetic"
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal"
import { CountUp } from "@/components/motion/CountUp"
import { eventDisplayName } from "@/lib/wca-events"
import { formatResult } from "@/lib/wca-format"
import { ArrowRight, Loader2, ExternalLink, Users } from "lucide-react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"

interface PlayerInfo {
  name: string
  country: {
    name: string
    iso2: string
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

export default function ComparePage() {
  const [wcaId1, setWcaId1] = useState("")
  const [wcaId2, setWcaId2] = useState("")
  const [loading, setLoading] = useState(false)
  const [player1, setPlayer1] = useState<PlayerInfo | null>(null)
  const [player2, setPlayer2] = useState<PlayerInfo | null>(null)
  const [error, setError] = useState("")

  const fetchPlayerData = async (wcaId: string): Promise<PlayerInfo> => {
    const normalizedWcaId = wcaId.trim().toUpperCase()
    const playerResponse = await fetch(`https://www.worldcubeassociation.org/api/v0/persons/${normalizedWcaId}`)

    if (!playerResponse.ok) {
      throw new Error(`Player ${normalizedWcaId} not found. Please check the WCA ID.`)
    }

    const playerData = await playerResponse.json()
    const player = playerData.person

    if (!player || !player.name) {
      throw new Error(`Invalid player data received for ${normalizedWcaId}`)
    }

    const countryIso = player.country?.iso2 || player.country_iso2 || "XX"
    const continent = player.country?.continent_id?.replace(/^_/, "") || ""

    const transformedPlayer: PlayerInfo = {
      name: player.name,
      country: {
        name: player.country?.name || countryIso,
        iso2: countryIso.toLowerCase(),
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

    return transformedPlayer
  }

  const compareStats = async () => {
    if (!wcaId1.trim() || !wcaId2.trim()) {
      setError("Please enter both WCA IDs")
      return
    }

    setLoading(true)
    setError("")
    setPlayer1(null)
    setPlayer2(null)

    try {
      const [playerData1, playerData2] = await Promise.all([
        fetchPlayerData(wcaId1.trim()),
        fetchPlayerData(wcaId2.trim()),
      ])

      setPlayer1(playerData1)
      setPlayer2(playerData2)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred while fetching data")
    } finally {
      setLoading(false)
    }
  }

  const getAllEvents = () => {
    const events = new Set<string>()
    if (player1) Object.keys(player1.personal_records).forEach((event) => events.add(event))
    if (player2) Object.keys(player2.personal_records).forEach((event) => events.add(event))
    return Array.from(events).sort()
  }

  const getBetterRank = (rank1?: number, rank2?: number) => {
    if (!rank1 && !rank2) return "tie"
    if (!rank1) return "player2"
    if (!rank2) return "player1"
    return rank1 < rank2 ? "player1" : rank1 > rank2 ? "player2" : "tie"
  }

  /** Score a single/average slot: better rank wins; missing side loses (unfair mode). */
  const scoreSlot = (
    rank1: number | undefined,
    rank2: number | undefined,
    mode: "fair" | "unfair",
  ): "player1" | "player2" | "tie" | null => {
    const has1 = typeof rank1 === "number" && rank1 > 0
    const has2 = typeof rank2 === "number" && rank2 > 0
    if (has1 && has2) return getBetterRank(rank1, rank2)
    if (mode === "fair") return null
    if (has1 && !has2) return "player1"
    if (!has1 && has2) return "player2"
    return null
  }

  const applyWinner = (
    winner: "player1" | "player2" | "tie" | null,
    points1: { n: number },
    points2: { n: number },
  ) => {
    if (winner === "player1") points1.n++
    else if (winner === "player2") points2.n++
  }

  const calculatePoints = () => {
    if (!player1 || !player2)
      return { fair: { player1: 0, player2: 0, events: [] }, unfair: { player1: 0, player2: 0, events: [] } }

    const allEvents = getAllEvents()
    const fairPoints1 = { n: 0 }
    const fairPoints2 = { n: 0 }
    const unfairPoints1 = { n: 0 }
    const unfairPoints2 = { n: 0 }
    const fairEvents: string[] = []
    const unfairEvents: string[] = []

    allEvents.forEach((eventId) => {
      const event1 = player1.personal_records[eventId]
      const event2 = player2.personal_records[eventId]

      if (event1 && event2) {
        fairEvents.push(eventId)
        applyWinner(
          scoreSlot(event1.single?.world_ranking, event2.single?.world_ranking, "fair"),
          fairPoints1,
          fairPoints2,
        )
        applyWinner(
          scoreSlot(event1.average?.world_ranking, event2.average?.world_ranking, "fair"),
          fairPoints1,
          fairPoints2,
        )
      }

      unfairEvents.push(eventId)
      applyWinner(
        scoreSlot(event1?.single?.world_ranking, event2?.single?.world_ranking, "unfair"),
        unfairPoints1,
        unfairPoints2,
      )
      applyWinner(
        scoreSlot(event1?.average?.world_ranking, event2?.average?.world_ranking, "unfair"),
        unfairPoints1,
        unfairPoints2,
      )
    })

    return {
      fair: { player1: fairPoints1.n, player2: fairPoints2.n, events: fairEvents },
      unfair: { player1: unfairPoints1.n, player2: unfairPoints2.n, events: unfairEvents },
    }
  }

  const hasResults = Boolean(player1 && player2 && !loading)

  return (
    <div className="editorial-page">
      <header className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5" data-cursor="hover">
            <span className="flex h-6 w-6 items-center justify-center rounded border border-border text-[10px] font-semibold tracking-tight">
              C
            </span>
            <span className="text-sm font-medium tracking-tight">Cubify</span>
          </Link>
          <nav className="flex items-center gap-1">
            <span className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-foreground bg-secondary">
              <Users className="h-3.5 w-3.5" />
              Compare
            </span>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        <section className="grid gap-10 border-b border-border py-14 md:grid-cols-12 md:gap-8 md:py-20">
          <Reveal className="md:col-span-5">
            <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Head to head
            </p>
            <h1 className="text-3xl font-medium tracking-tight text-foreground sm:text-4xl md:text-[2.75rem] md:leading-[1.12]">
              Compare two competitors.
            </h1>
            <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-muted-foreground">
              Side-by-side world ranks across every shared event — fair and full scoring.
            </p>
          </Reveal>

          <Reveal delay={0.05} className="md:col-span-7">
            <div className="surface-card rounded-lg p-5 sm:p-6">
              <div className="grid gap-4 sm:grid-cols-2 mb-4">
                <div>
                  <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Player 1
                  </label>
                  <Input
                    placeholder="WCA ID"
                    value={wcaId1}
                    onChange={(e) => setWcaId1(e.target.value.toUpperCase())}
                    disabled={loading}
                    className="input-editorial"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Player 2
                  </label>
                  <Input
                    placeholder="WCA ID"
                    value={wcaId2}
                    onChange={(e) => setWcaId2(e.target.value.toUpperCase())}
                    disabled={loading}
                    className="input-editorial"
                  />
                </div>
              </div>
              <Magnetic className="w-full" strength={0.2}>
                <Button
                  onClick={compareStats}
                  disabled={loading}
                  className="btn-solid w-full h-11 rounded-md text-sm"
                  data-cursor="hover"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Comparing
                    </>
                  ) : (
                    <>
                      Compare
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
          </Reveal>
        </section>

        {loading && (
          <section className="grid gap-3 sm:grid-cols-2 my-10">
            {[0, 1].map((i) => (
              <div key={i} className="surface-card rounded-lg p-6 space-y-3">
                <div className="flex items-center gap-4">
                  <div className="skeleton-shimmer h-14 w-14 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton-shimmer h-4 w-36 rounded" />
                    <div className="skeleton-shimmer h-3 w-24 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </section>
        )}

        {hasResults && player1 && player2 && (
          <>
            <section className="py-10">
              <Stagger className="grid gap-3 sm:grid-cols-2" stagger={0.05}>
                {[player1, player2].map((player) => (
                  <StaggerItem key={player.wca_id} className="surface-card rounded-lg p-6">
                    <div className="flex items-start gap-4">
                      {player.avatar?.url ? (
                        <img
                          src={player.avatar.url}
                          alt={player.name}
                          className="h-14 w-14 rounded-full object-cover border border-border"
                        />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border text-muted-foreground font-medium">
                          {player.name.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-medium tracking-tight truncate">{player.name}</h3>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <img
                            src={`https://flagcdn.com/20x15/${player.country.iso2}.png`}
                            alt={player.country.name}
                            className="rounded-[2px]"
                          />
                          <span>{player.country.name}</span>
                          <Badge
                            variant="outline"
                            className="font-mono text-[11px] tabular-nums rounded border-border bg-transparent font-normal"
                          >
                            {player.wca_id}
                          </Badge>
                        </div>
                        <a
                          href={`https://www.worldcubeassociation.org/persons/${player.wca_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                          data-cursor="hover"
                        >
                          WCA profile <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  </StaggerItem>
                ))}
              </Stagger>
            </section>

            <section className="pb-10">
              <Reveal>
                <div className="mb-4 flex items-baseline justify-between border-b border-border pb-3">
                  <h3 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Scoring
                  </h3>
                </div>
                {(() => {
                  const points = calculatePoints()
                  return (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="surface-card rounded-lg p-6">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground mb-1">
                          Fair
                        </p>
                        <p className="text-xs text-muted-foreground mb-6">
                          Shared events only · {points.fair.events.length}
                        </p>
                        <div className="flex items-end justify-between">
                          <div>
                            <p
                              className={`text-4xl font-medium tabular-nums tracking-tight ${
                                points.fair.player1 >= points.fair.player2
                                  ? "text-foreground"
                                  : "text-muted-foreground"
                              }`}
                            >
                              <CountUp value={points.fair.player1} />
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {player1.name.split(" ")[0]}
                            </p>
                          </div>
                          <span className="pb-2 text-[11px] tracking-widest text-muted-foreground">
                            VS
                          </span>
                          <div className="text-right">
                            <p
                              className={`text-4xl font-medium tabular-nums tracking-tight ${
                                points.fair.player2 >= points.fair.player1
                                  ? "text-foreground"
                                  : "text-muted-foreground"
                              }`}
                            >
                              <CountUp value={points.fair.player2} />
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {player2.name.split(" ")[0]}
                            </p>
                          </div>
                        </div>
                        <p className="mt-5 text-sm text-muted-foreground border-t border-border pt-4">
                          {points.fair.player1 > points.fair.player2
                            ? `${player1.name.split(" ")[0]} leads`
                            : points.fair.player2 > points.fair.player1
                              ? `${player2.name.split(" ")[0]} leads`
                              : "Tied"}
                        </p>
                      </div>

                      <div className="surface-card rounded-lg p-6">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground mb-1">
                          Full
                        </p>
                        <p className="text-xs text-muted-foreground mb-6">
                          All events · {points.unfair.events.length}
                        </p>
                        <div className="flex items-end justify-between">
                          <div>
                            <p
                              className={`text-4xl font-medium tabular-nums tracking-tight ${
                                points.unfair.player1 >= points.unfair.player2
                                  ? "text-foreground"
                                  : "text-muted-foreground"
                              }`}
                            >
                              <CountUp value={points.unfair.player1} />
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {player1.name.split(" ")[0]}
                            </p>
                          </div>
                          <span className="pb-2 text-[11px] tracking-widest text-muted-foreground">
                            VS
                          </span>
                          <div className="text-right">
                            <p
                              className={`text-4xl font-medium tabular-nums tracking-tight ${
                                points.unfair.player2 >= points.unfair.player1
                                  ? "text-foreground"
                                  : "text-muted-foreground"
                              }`}
                            >
                              <CountUp value={points.unfair.player2} />
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {player2.name.split(" ")[0]}
                            </p>
                          </div>
                        </div>
                        <p className="mt-5 text-sm text-muted-foreground border-t border-border pt-4">
                          {points.unfair.player1 > points.unfair.player2
                            ? `${player1.name.split(" ")[0]} leads`
                            : points.unfair.player2 > points.unfair.player1
                              ? `${player2.name.split(" ")[0]} leads`
                              : "Tied"}
                        </p>
                      </div>
                    </div>
                  )
                })()}
              </Reveal>
            </section>

            <section className="pb-16">
              <Reveal delay={0.06}>
                <div className="mb-4 flex items-baseline justify-between border-b border-border pb-3">
                  <h3 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Head to head
                  </h3>
                </div>
                <div className="overflow-x-auto border border-border rounded-lg">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-card">
                        <th className="text-left py-3 px-4 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                          Event
                        </th>
                        <th className="text-center py-3 px-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                          Type
                        </th>
                        <th className="text-center py-3 px-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                          {player1.name.split(" ")[0]}
                        </th>
                        <th className="text-center py-3 px-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                          {player2.name.split(" ")[0]}
                        </th>
                        <th className="text-center py-3 px-4 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                          Winner
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {getAllEvents().map((eventId) => {
                        const event1 = player1.personal_records[eventId]
                        const event2 = player2.personal_records[eventId]
                        const eventName = eventDisplayName(eventId)
                        const rows: React.ReactNode[] = []

                        if (event1?.single || event2?.single) {
                          const singleWinner = getBetterRank(
                            event1?.single?.world_ranking,
                            event2?.single?.world_ranking,
                          )
                          rows.push(
                            <tr
                              key={`${eventId}-single`}
                              className="border-b border-border/60 hover:bg-secondary/40 transition-colors"
                            >
                              <td className="py-3 px-4 text-foreground font-medium">
                                {rows.length === 0 ? eventName : ""}
                              </td>
                              <td className="py-3 px-3 text-center text-muted-foreground text-xs">
                                Single
                              </td>
                              <td
                                className={`py-3 px-3 text-center tabular-nums ${
                                  singleWinner === "player1"
                                    ? "text-foreground font-medium"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {event1?.single ? (
                                  <div>
                                    <div>{formatResult(eventId, event1.single.best, "single")}</div>
                                    <div className="text-xs text-muted-foreground">
                                      WR #{event1.single.world_ranking}
                                    </div>
                                  </div>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td
                                className={`py-3 px-3 text-center tabular-nums ${
                                  singleWinner === "player2"
                                    ? "text-foreground font-medium"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {event2?.single ? (
                                  <div>
                                    <div>{formatResult(eventId, event2.single.best, "single")}</div>
                                    <div className="text-xs text-muted-foreground">
                                      WR #{event2.single.world_ranking}
                                    </div>
                                  </div>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="py-3 px-4 text-center text-xs text-muted-foreground">
                                {singleWinner === "player1"
                                  ? player1.name.split(" ")[0]
                                  : singleWinner === "player2"
                                    ? player2.name.split(" ")[0]
                                    : singleWinner === "tie"
                                      ? "Tie"
                                      : "—"}
                              </td>
                            </tr>,
                          )
                        }

                        if (event1?.average || event2?.average) {
                          const averageWinner = getBetterRank(
                            event1?.average?.world_ranking,
                            event2?.average?.world_ranking,
                          )
                          rows.push(
                            <tr
                              key={`${eventId}-average`}
                              className="border-b border-border/60 hover:bg-secondary/40 transition-colors"
                            >
                              <td className="py-3 px-4 text-foreground font-medium">
                                {rows.length === 0 ? eventName : ""}
                              </td>
                              <td className="py-3 px-3 text-center text-muted-foreground text-xs">
                                Average
                              </td>
                              <td
                                className={`py-3 px-3 text-center tabular-nums ${
                                  averageWinner === "player1"
                                    ? "text-foreground font-medium"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {event1?.average ? (
                                  <div>
                                    <div>{formatResult(eventId, event1.average.best, "average")}</div>
                                    <div className="text-xs text-muted-foreground">
                                      WR #{event1.average.world_ranking}
                                    </div>
                                  </div>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td
                                className={`py-3 px-3 text-center tabular-nums ${
                                  averageWinner === "player2"
                                    ? "text-foreground font-medium"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {event2?.average ? (
                                  <div>
                                    <div>{formatResult(eventId, event2.average.best, "average")}</div>
                                    <div className="text-xs text-muted-foreground">
                                      WR #{event2.average.world_ranking}
                                    </div>
                                  </div>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="py-3 px-4 text-center text-xs text-muted-foreground">
                                {averageWinner === "player1"
                                  ? player1.name.split(" ")[0]
                                  : averageWinner === "player2"
                                    ? player2.name.split(" ")[0]
                                    : averageWinner === "tie"
                                      ? "Tie"
                                      : "—"}
                              </td>
                            </tr>,
                          )
                        }

                        return rows
                      })}
                    </tbody>
                  </table>
                </div>
              </Reveal>
            </section>
          </>
        )}
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs text-muted-foreground">Data from the official WCA API</p>
          <p className="text-xs text-muted-foreground">Cubify</p>
        </div>
      </footer>
    </div>
  )
}
