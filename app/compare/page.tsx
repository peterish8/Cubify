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
import { ArrowLeft, Users, Loader2, Zap, Trophy, ExternalLink } from "lucide-react"
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

  return (
    <div className="editorial-bg relative overflow-hidden">
      <div className="container mx-auto px-4 py-10 md:py-14 relative z-10">
        <Reveal className="mb-8">
          <Link href="/">
            <Button
              variant="outline"
              className="rounded-xl border-border bg-card/40 hover:bg-card hover:border-primary/40 mb-2"
              data-cursor="hover"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to analyzer
            </Button>
          </Link>
        </Reveal>

        <Reveal className="text-center mb-12">
          <p className="text-xs font-medium tracking-[0.25em] uppercase text-primary mb-3">
            Head to head
          </p>
          <h1 className="font-heading text-5xl md:text-6xl font-bold tracking-tight text-foreground mb-4">
            COMPARE
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto text-balance text-base md:text-lg leading-relaxed">
            Compare two speedcubers across every event and see who ranks better worldwide.
          </p>
        </Reveal>

        <Reveal delay={0.08} className="max-w-4xl mx-auto mb-12">
          <div className="surface-card rounded-2xl p-6">
            <div className="flex items-center gap-2.5 mb-5">
              <Users className="text-primary" size={18} />
              <h2 className="text-sm font-semibold tracking-wide text-foreground">Enter WCA IDs</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-5 mb-5">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
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
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
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

            <Magnetic className="w-full" strength={0.25}>
              <Button
                onClick={compareStats}
                disabled={loading}
                className="btn-primary-glow w-full h-12 rounded-xl text-sm tracking-wide"
                data-cursor="hover"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Comparing…
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    Compare stats
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
                  className="text-sm text-center p-3 rounded-xl bg-destructive/10 border border-destructive/25 text-red-300 mt-4"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Reveal>

        {loading && (
          <div className="max-w-4xl mx-auto mb-8 grid md:grid-cols-2 gap-5">
            {[0, 1].map((i) => (
              <div key={i} className="surface-card rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="skeleton-shimmer h-16 w-16 rounded-full" />
                  <div className="flex-1 space-y-3">
                    <div className="skeleton-shimmer h-5 w-40 rounded-md" />
                    <div className="skeleton-shimmer h-4 w-28 rounded-md" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {player1 && player2 && !loading && (
          <>
            <Stagger className="grid md:grid-cols-2 gap-5 max-w-6xl mx-auto mb-8" stagger={0.08}>
              {[player1, player2].map((player) => (
                <StaggerItem key={player.wca_id}>
                  <div className="surface-card surface-card-hover rounded-2xl p-6 h-full">
                    <div className="flex items-center gap-4 mb-4">
                      {player.avatar?.url && (
                        <img
                          src={player.avatar.url}
                          alt={player.name}
                          className="w-16 h-16 rounded-full object-cover ring-2 ring-border"
                        />
                      )}
                      <div className="min-w-0">
                        <h3 className="text-lg font-semibold text-foreground truncate">{player.name}</h3>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <img
                            src={`https://flagcdn.com/24x18/${player.country.iso2}.png`}
                            alt={player.country.name}
                            className="rounded"
                          />
                          <span className="text-sm text-muted-foreground">{player.country.name}</span>
                          <Badge
                            variant="outline"
                            className="font-mono text-xs tabular-nums border-primary/30 text-primary bg-primary/10"
                          >
                            {player.wca_id}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="rounded-lg border-border hover:border-primary/40"
                    >
                      <a
                        href={`https://www.worldcubeassociation.org/persons/${player.wca_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2"
                        data-cursor="hover"
                      >
                        View WCA profile <ExternalLink size={14} />
                      </a>
                    </Button>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>

            <Reveal className="max-w-6xl mx-auto mb-8">
              <div className="surface-card rounded-2xl p-6">
                <div className="flex items-center gap-2.5 mb-6">
                  <Trophy className="text-primary" size={18} />
                  <h2 className="text-sm font-semibold tracking-wide text-foreground">Points scoring</h2>
                </div>

                {(() => {
                  const points = calculatePoints()
                  return (
                    <div className="grid md:grid-cols-2 gap-5">
                      <div className="rounded-xl border border-border/80 bg-secondary/30 p-5">
                        <h3 className="text-sm font-semibold text-emerald-400 mb-1 text-center tracking-wide">
                          Fair comparison
                        </h3>
                        <p className="text-xs text-muted-foreground text-center mb-5">
                          Shared events only ({points.fair.events.length})
                        </p>

                        <div className="flex items-center justify-between mb-4">
                          <div className="text-center">
                            <div
                              className={`text-3xl font-bold tabular-nums ${
                                points.fair.player1 > points.fair.player2
                                  ? "text-emerald-400"
                                  : points.fair.player1 === points.fair.player2
                                    ? "text-primary"
                                    : "text-muted-foreground"
                              }`}
                            >
                              <CountUp value={points.fair.player1} />
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {player1.name.split(" ")[0]}
                            </div>
                          </div>
                          <div className="text-xs font-semibold text-muted-foreground tracking-widest">VS</div>
                          <div className="text-center">
                            <div
                              className={`text-3xl font-bold tabular-nums ${
                                points.fair.player2 > points.fair.player1
                                  ? "text-emerald-400"
                                  : points.fair.player1 === points.fair.player2
                                    ? "text-primary"
                                    : "text-muted-foreground"
                              }`}
                            >
                              <CountUp value={points.fair.player2} />
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {player2.name.split(" ")[0]}
                            </div>
                          </div>
                        </div>

                        <div className="text-center text-sm font-medium">
                          {points.fair.player1 > points.fair.player2 ? (
                            <span className="text-emerald-400">🏆 {player1.name.split(" ")[0]} wins</span>
                          ) : points.fair.player2 > points.fair.player1 ? (
                            <span className="text-emerald-400">🏆 {player2.name.split(" ")[0]} wins</span>
                          ) : (
                            <span className="text-primary">🤝 Tie</span>
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl border border-border/80 bg-secondary/30 p-5">
                        <h3 className="text-sm font-semibold text-orange-400 mb-1 text-center tracking-wide">
                          Unfair comparison
                        </h3>
                        <p className="text-xs text-muted-foreground text-center mb-5">
                          All events ({points.unfair.events.length})
                        </p>

                        <div className="flex items-center justify-between mb-4">
                          <div className="text-center">
                            <div
                              className={`text-3xl font-bold tabular-nums ${
                                points.unfair.player1 > points.unfair.player2
                                  ? "text-orange-400"
                                  : points.unfair.player1 === points.unfair.player2
                                    ? "text-primary"
                                    : "text-muted-foreground"
                              }`}
                            >
                              <CountUp value={points.unfair.player1} />
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {player1.name.split(" ")[0]}
                            </div>
                          </div>
                          <div className="text-xs font-semibold text-muted-foreground tracking-widest">VS</div>
                          <div className="text-center">
                            <div
                              className={`text-3xl font-bold tabular-nums ${
                                points.unfair.player2 > points.unfair.player1
                                  ? "text-orange-400"
                                  : points.unfair.player1 === points.unfair.player2
                                    ? "text-primary"
                                    : "text-muted-foreground"
                              }`}
                            >
                              <CountUp value={points.unfair.player2} />
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {player2.name.split(" ")[0]}
                            </div>
                          </div>
                        </div>

                        <div className="text-center text-sm font-medium">
                          {points.unfair.player1 > points.unfair.player2 ? (
                            <span className="text-orange-400">🏆 {player1.name.split(" ")[0]} wins</span>
                          ) : points.unfair.player2 > points.unfair.player1 ? (
                            <span className="text-orange-400">🏆 {player2.name.split(" ")[0]} wins</span>
                          ) : (
                            <span className="text-primary">🤝 Tie</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            </Reveal>

            <Reveal delay={0.1} className="max-w-7xl mx-auto">
              <div className="surface-card rounded-2xl p-6">
                <div className="flex items-center gap-2.5 mb-6">
                  <Trophy className="text-primary" size={18} />
                  <h2 className="text-sm font-semibold tracking-wide text-foreground">
                    Head-to-head comparison
                  </h2>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Event
                        </th>
                        <th className="text-center py-3 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Type
                        </th>
                        <th className="text-center py-3 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          <div className="flex flex-col items-center gap-1.5">
                            {player1.avatar?.url && (
                              <img
                                src={player1.avatar.url}
                                alt={player1.name}
                                className="w-7 h-7 rounded-full object-cover"
                              />
                            )}
                            <span>{player1.name.split(" ")[0]}</span>
                          </div>
                        </th>
                        <th className="text-center py-3 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          <div className="flex flex-col items-center gap-1.5">
                            {player2.avatar?.url && (
                              <img
                                src={player2.avatar.url}
                                alt={player2.name}
                                className="w-7 h-7 rounded-full object-cover"
                              />
                            )}
                            <span>{player2.name.split(" ")[0]}</span>
                          </div>
                        </th>
                        <th className="text-center py-3 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
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
                              className="border-b border-border/40 hover:bg-secondary/30 transition-colors"
                            >
                              <td className="py-3 px-3 text-foreground font-medium">
                                {rows.length === 0 ? eventName : ""}
                              </td>
                              <td className="py-3 px-3 text-center text-muted-foreground text-xs">Single</td>
                              <td
                                className={`py-3 px-3 text-center tabular-nums font-medium ${
                                  singleWinner === "player1"
                                    ? "text-emerald-400"
                                    : singleWinner === "tie"
                                      ? "text-primary"
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
                                className={`py-3 px-3 text-center tabular-nums font-medium ${
                                  singleWinner === "player2"
                                    ? "text-emerald-400"
                                    : singleWinner === "tie"
                                      ? "text-primary"
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
                              <td className="py-3 px-3 text-center text-xs font-medium">
                                {singleWinner === "player1" ? (
                                  <span className="text-emerald-400">{player1.name.split(" ")[0]}</span>
                                ) : singleWinner === "player2" ? (
                                  <span className="text-emerald-400">{player2.name.split(" ")[0]}</span>
                                ) : singleWinner === "tie" ? (
                                  <span className="text-primary">Tie</span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
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
                              className="border-b border-border/40 hover:bg-secondary/30 transition-colors"
                            >
                              <td className="py-3 px-3 text-foreground font-medium">
                                {rows.length === 0 ? eventName : ""}
                              </td>
                              <td className="py-3 px-3 text-center text-muted-foreground text-xs">Average</td>
                              <td
                                className={`py-3 px-3 text-center tabular-nums font-medium ${
                                  averageWinner === "player1"
                                    ? "text-emerald-400"
                                    : averageWinner === "tie"
                                      ? "text-primary"
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
                                className={`py-3 px-3 text-center tabular-nums font-medium ${
                                  averageWinner === "player2"
                                    ? "text-emerald-400"
                                    : averageWinner === "tie"
                                      ? "text-primary"
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
                              <td className="py-3 px-3 text-center text-xs font-medium">
                                {averageWinner === "player1" ? (
                                  <span className="text-emerald-400">{player1.name.split(" ")[0]}</span>
                                ) : averageWinner === "player2" ? (
                                  <span className="text-emerald-400">{player2.name.split(" ")[0]}</span>
                                ) : averageWinner === "tie" ? (
                                  <span className="text-primary">Tie</span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                            </tr>,
                          )
                        }

                        return rows
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </Reveal>
          </>
        )}

        <footer className="text-center mt-16 space-y-1.5 pb-6">
          <p className="text-xs text-muted-foreground">Data sourced from the official WCA API</p>
          <p className="text-[11px] tracking-widest uppercase text-muted-foreground/60">
            Built for the speedcubing community
          </p>
        </footer>
      </div>
    </div>
  )
}
