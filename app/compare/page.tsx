"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

import { ArrowLeft, Users, Loader2, Zap, Trophy, ExternalLink } from "lucide-react"
import Link from "next/link"

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

const EVENT_NAMES: Record<string, string> = {
  "333": "3×3 Cube",
  "222": "2×2 Cube",
  "444": "4×4 Cube",
  "555": "5×5 Cube",
  "666": "6×6 Cube",
  "777": "7×7 Cube",
  "333bf": "3×3 Blindfolded",
  "333fm": "3×3 Fewest Moves",
  "333oh": "3×3 One-Handed",
  clock: "Clock",
  minx: "Megaminx",
  pyram: "Pyraminx",
  skewb: "Skewb",
  sq1: "Square-1",
  "444bf": "4×4 Blindfolded",
  "555bf": "5×5 Blindfolded",
  "333mbf": "3×3 Multi-Blind",
}

export default function ComparePage() {
  const [wcaId1, setWcaId1] = useState("")
  const [wcaId2, setWcaId2] = useState("")
  const [loading, setLoading] = useState(false)
  const [player1, setPlayer1] = useState<PlayerInfo | null>(null)
  const [player2, setPlayer2] = useState<PlayerInfo | null>(null)
  const [error, setError] = useState("")

  const fetchPlayerData = async (wcaId: string): Promise<PlayerInfo> => {
    const playerResponse = await fetch(
      `https://raw.githubusercontent.com/robiningelbrecht/wca-rest-api/master/api/persons/${wcaId}.json`,
    )

    if (!playerResponse.ok) {
      throw new Error(`Player ${wcaId} not found. Please check the WCA ID.`)
    }

    const player = await playerResponse.json()
    
    // Fetch avatar from WCA API
    let avatarUrl = null
    try {
      const wcaResponse = await fetch(`https://www.worldcubeassociation.org/api/v0/persons/${wcaId}`)
      if (wcaResponse.ok) {
        const wcaData = await wcaResponse.json()
        avatarUrl = wcaData.person?.avatar?.url
      }
    } catch (e) {
      console.log("Avatar fetch failed:", e)
    }

    if (!player || !player.name) {
      throw new Error(`Invalid player data received for ${wcaId}`)
    }

    const countryIso = player.country || player.countryIso2 || "XX"

    const transformedPlayer: PlayerInfo = {
      name: player.name,
      country: {
        name: player.country,
        iso2: countryIso.toLowerCase(),
      },
      continent: player.continent,
      wca_id: player.id,
      avatar: avatarUrl ? { url: avatarUrl } : undefined,
      personal_records: {},
    }

    if (player.rank && (player.rank.singles || player.rank.averages)) {
      // Process singles
      if (player.rank.singles) {
        player.rank.singles.forEach((record: any) => {
          if (!transformedPlayer.personal_records[record.eventId]) {
            transformedPlayer.personal_records[record.eventId] = {}
          }
          transformedPlayer.personal_records[record.eventId].single = {
            best: record.best,
            world_ranking: record.rank.world,
            continental_ranking: record.rank.continent,
            national_ranking: record.rank.country,
          }
        })
      }

      // Process averages
      if (player.rank.averages) {
        player.rank.averages.forEach((record: any) => {
          if (!transformedPlayer.personal_records[record.eventId]) {
            transformedPlayer.personal_records[record.eventId] = {}
          }
          transformedPlayer.personal_records[record.eventId].average = {
            best: record.best,
            world_ranking: record.rank.world,
            continental_ranking: record.rank.continent,
            national_ranking: record.rank.country,
          }
        })
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

    const startTime = Date.now()

    try {
      const [playerData1, playerData2] = await Promise.all([
        fetchPlayerData(wcaId1.trim()),
        fetchPlayerData(wcaId2.trim()),
      ])

      setPlayer1(playerData1)
      setPlayer2(playerData2)

      const elapsedTime = Date.now() - startTime
      const remainingTime = Math.max(0, 3000 - elapsedTime)

      if (remainingTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, remainingTime))
      }
    } catch (err) {
      const elapsedTime = Date.now() - startTime
      const remainingTime = Math.max(0, 3000 - elapsedTime)

      if (remainingTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, remainingTime))
      }

      setError(err instanceof Error ? err.message : "An error occurred while fetching data")
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (centiseconds: number) => {
    const seconds = centiseconds / 100
    return seconds < 60
      ? `${seconds.toFixed(2)}s`
      : `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(2).padStart(5, "0")}`
  }

  const getAllEvents = () => {
    const events = new Set<string>()
    if (player1) {
      Object.keys(player1.personal_records).forEach((event) => events.add(event))
    }
    if (player2) {
      Object.keys(player2.personal_records).forEach((event) => events.add(event))
    }
    return Array.from(events).sort()
  }

  const getBetterRank = (rank1?: number, rank2?: number) => {
    if (!rank1 && !rank2) return "tie"
    if (!rank1) return "player2"
    if (!rank2) return "player1"
    return rank1 < rank2 ? "player1" : rank1 > rank2 ? "player2" : "tie"
  }

  const calculatePoints = () => {
    if (!player1 || !player2)
      return { fair: { player1: 0, player2: 0, events: [] }, unfair: { player1: 0, player2: 0, events: [] } }

    const allEvents = getAllEvents()
    let fairPoints1 = 0,
      fairPoints2 = 0
    let unfairPoints1 = 0,
      unfairPoints2 = 0
    const fairEvents: string[] = []
    const unfairEvents: string[] = []

    allEvents.forEach((eventId) => {
      const event1 = player1.personal_records[eventId]
      const event2 = player2.personal_records[eventId]

      // Fair comparison - only events where both have results
      if (event1 && event2) {
        fairEvents.push(eventId)

        // Single comparison
        if (event1.single && event2.single) {
          const singleWinner = getBetterRank(event1.single.world_ranking, event2.single.world_ranking)
          if (singleWinner === "player1") fairPoints1++
          else if (singleWinner === "player2") fairPoints2++
        }

        // Average comparison
        if (event1.average && event2.average) {
          const averageWinner = getBetterRank(event1.average.world_ranking, event2.average.world_ranking)
          if (averageWinner === "player1") fairPoints1++
          else if (averageWinner === "player2") fairPoints2++
        }
      }

      // Unfair comparison - all events from both players
      unfairEvents.push(eventId)

      // Give points for having results when opponent doesn't
      if (event1 && !event2) {
        if (event1.single) unfairPoints1++
        if (event1.average) unfairPoints1++
      } else if (!event1 && event2) {
        if (event2.single) unfairPoints2++
        if (event2.average) unfairPoints2++
      } else if (event1 && event2) {
        // Both have results, compare like fair mode
        if (event1.single && event2.single) {
          const singleWinner = getBetterRank(event1.single.world_ranking, event2.single.world_ranking)
          if (singleWinner === "player1") unfairPoints1++
          else if (singleWinner === "player2") unfairPoints2++
        }

        if (event1.average && event2.average) {
          const averageWinner = getBetterRank(event1.average.world_ranking, event2.average.world_ranking)
          if (averageWinner === "player1") unfairPoints1++
          else if (averageWinner === "player2") unfairPoints2++
        }
      }
    })

    return {
      fair: { player1: fairPoints1, player2: fairPoints2, events: fairEvents },
      unfair: { player1: unfairPoints1, player2: unfairPoints2, events: unfairEvents },
    }
  }

  return (
    <div className="min-h-screen glass-bg relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="spotlight-left"></div>
        <div className="spotlight-right"></div>
        <div className="star-field top-1/5 left-1/5" style={{ animationDelay: "0s" }}></div>
        <div className="star-field top-1/3 right-1/4" style={{ animationDelay: "1s" }}></div>
        <div className="star-field bottom-1/3 left-1/6" style={{ animationDelay: "2s" }}></div>
        <div className="star-field top-2/3 right-1/6" style={{ animationDelay: "1.5s" }}></div>
        <div className="star-field bottom-1/5 right-1/3" style={{ animationDelay: "0.5s" }}></div>
      </div>

      <div className="container mx-auto px-4 py-8 relative z-10">
        <div className="mb-8">
          <Link href="/">
            <Button variant="outline" className="glass-border bg-transparent hover:bg-glass-secondary mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Analyzer
            </Button>
          </Link>
        </div>

        <div className="text-center mb-12">
          <h1 className="text-5xl font-heading font-black text-glass-primary mb-4 tracking-wider">COMPARE</h1>
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-1 h-6 bg-glass-accent"></div>
            <p className="text-xl text-glass-accent font-bold tracking-wide">PLAYER VS PLAYER</p>
            <div className="w-1 h-6 bg-glass-accent"></div>
          </div>
          <p className="text-glass-muted max-w-2xl mx-auto text-balance font-medium">
            Compare two speedcubers head-to-head across all events and see who ranks better.
          </p>
        </div>

        <div className="max-w-4xl mx-auto mb-12">
          <div className="glass-card rounded-2xl p-6 animate-pulse-glow">
            <div className="flex items-center gap-3 mb-6">
              <Users className="text-glass-accent" size={24} />
              <h2 className="text-xl font-heading font-black text-glass-accent tracking-wide">ENTER WCA IDs</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-glass-secondary">Player 1</label>
                <Input
                  placeholder="Enter WCA ID"
                  value={wcaId1}
                  onChange={(e) => setWcaId1(e.target.value.toUpperCase())}
                  disabled={loading}
                  className="bg-glass-secondary border-glass-border text-glass-primary placeholder:text-glass-muted focus:border-glass-accent focus:ring-glass-accent/30 rounded-xl h-12 text-center font-mono tracking-wider font-bold backdrop-blur-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-glass-secondary">Player 2</label>
                <Input
                  placeholder="Enter WCA ID"
                  value={wcaId2}
                  onChange={(e) => setWcaId2(e.target.value.toUpperCase())}
                  disabled={loading}
                  className="bg-glass-secondary border-glass-border text-glass-primary placeholder:text-glass-muted focus:border-glass-accent focus:ring-glass-accent/30 rounded-xl h-12 text-center font-mono tracking-wider font-bold backdrop-blur-sm"
                />
              </div>
            </div>

            <Button
              onClick={compareStats}
              disabled={loading}
              className="neuro-button w-full h-12 text-glass-primary font-heading font-black tracking-wider rounded-xl"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  COMPARING...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-5 w-5" />
                  COMPARE STATS
                </>
              )}
            </Button>

            {error && (
              <div className="text-red-300 text-sm text-center p-3 bg-red-500/10 rounded-lg border border-red-500/20 font-medium backdrop-blur-sm mt-4">
                {error}
              </div>
            )}
          </div>
        </div>

        {loading && (
          <div className="max-w-md mx-auto mb-8">
            <div className="glass-card rounded-2xl p-8">
              <div className="flex flex-col items-center space-y-6">
                <div className="relative">
                  <Loader2 className="h-16 w-16 animate-spin text-glass-accent" />
                  <div className="absolute inset-0 h-16 w-16 rounded-full border-4 border-glass-accent/20 animate-pulse"></div>
                  <div
                    className="absolute inset-2 h-12 w-12 rounded-full border-2 border-glass-accent/40 animate-spin"
                    style={{ animationDirection: "reverse", animationDuration: "3s" }}
                  ></div>
                </div>
                <p className="text-center text-glass-secondary font-bold">Comparing players...</p>
              </div>
            </div>
          </div>
        )}

        {player1 && player2 && !loading && (
          <>
            {/* Player Info Cards */}
            <div className="grid md:grid-cols-2 gap-6 max-w-6xl mx-auto mb-8">
              {[player1, player2].map((player, index) => (
                <div key={player.wca_id} className="glass-card rounded-2xl p-6">
                  <div className="flex items-center gap-4 mb-4">
                    {player.avatar?.url && (
                      <img
                        src={player.avatar.url || "/placeholder.svg"}
                        alt={player.name}
                        className="w-16 h-16 rounded-full object-cover"
                      />
                    )}
                    <div>
                      <h3 className="text-xl font-heading font-black text-glass-accent tracking-wide">
                        {player.name.toUpperCase()}
                      </h3>
                      <div className="flex items-center gap-3 mt-2">
                        <img
                          src={`https://flagcdn.com/24x18/${player.country.iso2}.png`}
                          alt={player.country.name}
                          className="rounded border border-glass-border"
                        />
                        <span className="text-glass-secondary font-bold">{player.country.name}</span>
                        <Badge className="bg-glass-accent/20 text-glass-accent border-glass-accent/30 font-mono font-bold">
                          {player.wca_id}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="glass-border bg-transparent hover:bg-glass-secondary"
                  >
                    <a
                      href={`https://www.worldcubeassociation.org/persons/${player.wca_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-glass-accent font-bold"
                    >
                      View WCA Profile <ExternalLink size={14} />
                    </a>
                  </Button>
                </div>
              ))}
            </div>

            {/* Points Scoring Section */}
            <div className="max-w-6xl mx-auto mb-8">
              <div className="glass-card rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <Trophy className="text-glass-accent" size={24} />
                  <h2 className="text-xl font-heading font-black text-glass-accent tracking-wide">POINTS SCORING</h2>
                </div>

                {(() => {
                  const points = calculatePoints()
                  return (
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Fair Comparison */}
                      <div className="border border-glass-border/30 rounded-xl p-4 bg-glass-secondary/20">
                        <h3 className="text-lg font-heading font-black text-green-400 mb-3 text-center">
                          FAIR COMPARISON
                        </h3>
                        <p className="text-xs text-glass-muted text-center mb-4">
                          Only events where both players have results ({points.fair.events.length} events)
                        </p>

                        <div className="flex items-center justify-between mb-4">
                          <div className="text-center">
                            <div
                              className={`text-2xl font-black ${points.fair.player1 > points.fair.player2 ? "text-green-400" : points.fair.player1 === points.fair.player2 ? "text-glass-accent" : "text-glass-muted"}`}
                            >
                              {points.fair.player1}
                            </div>
                            <div className="text-xs text-glass-muted font-bold">{player1.name.split(" ")[0]}</div>
                          </div>

                          <div className="text-center">
                            <div className="text-glass-accent font-bold text-sm">VS</div>
                          </div>

                          <div className="text-center">
                            <div
                              className={`text-2xl font-black ${points.fair.player2 > points.fair.player1 ? "text-green-400" : points.fair.player1 === points.fair.player2 ? "text-glass-accent" : "text-glass-muted"}`}
                            >
                              {points.fair.player2}
                            </div>
                            <div className="text-xs text-glass-muted font-bold">{player2.name.split(" ")[0]}</div>
                          </div>
                        </div>

                        <div className="text-center">
                          {points.fair.player1 > points.fair.player2 ? (
                            <div className="text-green-400 font-bold text-sm">
                              🏆 {player1.name.split(" ")[0]} WINS!
                            </div>
                          ) : points.fair.player2 > points.fair.player1 ? (
                            <div className="text-green-400 font-bold text-sm">
                              🏆 {player2.name.split(" ")[0]} WINS!
                            </div>
                          ) : (
                            <div className="text-glass-accent font-bold text-sm">🤝 TIE GAME!</div>
                          )}
                        </div>
                      </div>

                      {/* Unfair Comparison */}
                      <div className="border border-glass-border/30 rounded-xl p-4 bg-glass-secondary/20">
                        <h3 className="text-lg font-heading font-black text-orange-400 mb-3 text-center">
                          UNFAIR COMPARISON
                        </h3>
                        <p className="text-xs text-glass-muted text-center mb-4">
                          All events from both players ({points.unfair.events.length} events)
                        </p>

                        <div className="flex items-center justify-between mb-4">
                          <div className="text-center">
                            <div
                              className={`text-2xl font-black ${points.unfair.player1 > points.unfair.player2 ? "text-orange-400" : points.unfair.player1 === points.unfair.player2 ? "text-glass-accent" : "text-glass-muted"}`}
                            >
                              {points.unfair.player1}
                            </div>
                            <div className="text-xs text-glass-muted font-bold">{player1.name.split(" ")[0]}</div>
                          </div>

                          <div className="text-center">
                            <div className="text-glass-accent font-bold text-sm">VS</div>
                          </div>

                          <div className="text-center">
                            <div
                              className={`text-2xl font-black ${points.unfair.player2 > points.unfair.player1 ? "text-orange-400" : points.unfair.player1 === points.unfair.player2 ? "text-glass-accent" : "text-glass-muted"}`}
                            >
                              {points.unfair.player2}
                            </div>
                            <div className="text-xs text-glass-muted font-bold">{player2.name.split(" ")[0]}</div>
                          </div>
                        </div>

                        <div className="text-center">
                          {points.unfair.player1 > points.unfair.player2 ? (
                            <div className="text-orange-400 font-bold text-sm">
                              🏆 {player1.name.split(" ")[0]} WINS!
                            </div>
                          ) : points.unfair.player2 > points.unfair.player1 ? (
                            <div className="text-orange-400 font-bold text-sm">
                              🏆 {player2.name.split(" ")[0]} WINS!
                            </div>
                          ) : (
                            <div className="text-glass-accent font-bold text-sm">🤝 TIE GAME!</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>

            {/* Comparison Table */}
            <div className="max-w-7xl mx-auto">
              <div className="glass-card rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <Trophy className="text-glass-accent" size={24} />
                  <h2 className="text-xl font-heading font-black text-glass-accent tracking-wide">
                    HEAD-TO-HEAD COMPARISON
                  </h2>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    {/* Table Header */}
                    <thead>
                      <tr className="border-b border-glass-border/30">
                        <th className="text-left py-4 px-3 text-glass-accent font-heading font-black tracking-wide">
                          EVENT
                        </th>
                        <th className="text-center py-4 px-3 text-glass-accent font-heading font-black tracking-wide">
                          TYPE
                        </th>
                        <th className="text-center py-4 px-3 text-glass-accent font-heading font-black tracking-wide">
                          <div className="flex flex-col items-center gap-2">
                            {player1.avatar?.url && (
                              <img
                                src={player1.avatar.url || "/placeholder.svg"}
                                alt={player1.name}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            )}
                            <span>{player1.name.split(" ")[0].toUpperCase()}</span>
                          </div>
                        </th>
                        <th className="text-center py-4 px-3 text-glass-accent font-heading font-black tracking-wide">
                          <div className="flex flex-col items-center gap-2">
                            {player2.avatar?.url && (
                              <img
                                src={player2.avatar.url || "/placeholder.svg"}
                                alt={player2.name}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            )}
                            <span>{player2.name.split(" ")[0].toUpperCase()}</span>
                          </div>
                        </th>
                        <th className="text-center py-4 px-3 text-glass-accent font-heading font-black tracking-wide">
                          WINNER
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {getAllEvents().map((eventId) => {
                        const event1 = player1.personal_records[eventId]
                        const event2 = player2.personal_records[eventId]
                        const eventName = EVENT_NAMES[eventId] || eventId.toUpperCase()

                        const rows = []

                        // Single row
                        if (event1?.single || event2?.single) {
                          const singleWinner = getBetterRank(
                            event1?.single?.world_ranking,
                            event2?.single?.world_ranking,
                          )
                          rows.push(
                            <tr
                              key={`${eventId}-single`}
                              className="border-b border-glass-border/10 hover:bg-glass-secondary/10"
                            >
                              <td className="py-3 px-3 text-glass-secondary font-bold">
                                {rows.length === 0 ? eventName : ""}
                              </td>
                              <td className="py-3 px-3 text-center text-glass-muted font-bold text-sm">SINGLE</td>
                              <td
                                className={`py-3 px-3 text-center font-mono font-bold ${singleWinner === "player1" ? "text-green-400" : singleWinner === "tie" ? "text-glass-accent" : "text-glass-muted"}`}
                              >
                                {event1?.single ? (
                                  <div>
                                    <div>{formatTime(event1.single.best)}</div>
                                    <div className="text-xs text-glass-muted">WR #{event1.single.world_ranking}</div>
                                  </div>
                                ) : (
                                  "N/A"
                                )}
                              </td>
                              <td
                                className={`py-3 px-3 text-center font-mono font-bold ${singleWinner === "player2" ? "text-green-400" : singleWinner === "tie" ? "text-glass-accent" : "text-glass-muted"}`}
                              >
                                {event2?.single ? (
                                  <div>
                                    <div>{formatTime(event2.single.best)}</div>
                                    <div className="text-xs text-glass-muted">WR #{event2.single.world_ranking}</div>
                                  </div>
                                ) : (
                                  "N/A"
                                )}
                              </td>
                              <td className="py-3 px-3 text-center">
                                {singleWinner === "player1" ? (
                                  <div className="text-green-400 font-bold text-sm">{player1.name.split(" ")[0]}</div>
                                ) : singleWinner === "player2" ? (
                                  <div className="text-green-400 font-bold text-sm">{player2.name.split(" ")[0]}</div>
                                ) : singleWinner === "tie" ? (
                                  <div className="text-glass-accent font-bold text-sm">TIE</div>
                                ) : (
                                  <div className="text-glass-muted font-bold text-sm">-</div>
                                )}
                              </td>
                            </tr>,
                          )
                        }

                        // Average row
                        if (event1?.average || event2?.average) {
                          const averageWinner = getBetterRank(
                            event1?.average?.world_ranking,
                            event2?.average?.world_ranking,
                          )
                          rows.push(
                            <tr
                              key={`${eventId}-average`}
                              className="border-b border-glass-border/10 hover:bg-glass-secondary/10"
                            >
                              <td className="py-3 px-3 text-glass-secondary font-bold">
                                {rows.length === 0 ? eventName : ""}
                              </td>
                              <td className="py-3 px-3 text-center text-glass-muted font-bold text-sm">AVERAGE</td>
                              <td
                                className={`py-3 px-3 text-center font-mono font-bold ${averageWinner === "player1" ? "text-green-400" : averageWinner === "tie" ? "text-glass-accent" : "text-glass-muted"}`}
                              >
                                {event1?.average ? (
                                  <div>
                                    <div>{formatTime(event1.average.best)}</div>
                                    <div className="text-xs text-glass-muted">WR #{event1.average.world_ranking}</div>
                                  </div>
                                ) : (
                                  "N/A"
                                )}
                              </td>
                              <td
                                className={`py-3 px-3 text-center font-mono font-bold ${averageWinner === "player2" ? "text-green-400" : averageWinner === "tie" ? "text-glass-accent" : "text-glass-muted"}`}
                              >
                                {event2?.average ? (
                                  <div>
                                    <div>{formatTime(event2.average.best)}</div>
                                    <div className="text-xs text-glass-muted">WR #{event2.average.world_ranking}</div>
                                  </div>
                                ) : (
                                  "N/A"
                                )}
                              </td>
                              <td className="py-3 px-3 text-center">
                                {averageWinner === "player1" ? (
                                  <div className="text-green-400 font-bold text-sm">{player1.name.split(" ")[0]}</div>
                                ) : averageWinner === "player2" ? (
                                  <div className="text-green-400 font-bold text-sm">{player2.name.split(" ")[0]}</div>
                                ) : averageWinner === "tie" ? (
                                  <div className="text-glass-accent font-bold text-sm">TIE</div>
                                ) : (
                                  <div className="text-glass-muted font-bold text-sm">-</div>
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
            </div>
          </>
        )}

        <div className="text-center mt-16 space-y-2">
          <div className="flex items-center justify-center gap-2 text-glass-muted">
            <div className="w-1 h-4 bg-glass-accent"></div>
            <p className="text-sm font-mono font-bold">
              Data sourced from WCA Official API and Unofficial WCA REST API
            </p>
            <div className="w-1 h-4 bg-glass-accent"></div>
          </div>
          <p className="text-xs text-glass-muted/60 font-mono tracking-wider font-bold">
            BUILT FOR THE SPEEDCUBING COMMUNITY
          </p>
        </div>
      </div>
    </div>
  )
}
