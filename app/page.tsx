"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

import { ExternalLink, Search, Trophy, Loader2, Zap, Users } from "lucide-react"
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

interface RegionStats {
  totalCompetitors: number
  percentile: number
  percentDownList: number
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

const CONTINENT_CODES: Record<string, string> = {
  Africa: "africa",
  Asia: "asia",
  Europe: "europe",
  "North America": "north-america",
  Oceania: "oceania",
  "South America": "south-america",
}

export default function CubifyAnalyzer() {
  const [wcaId, setWcaId] = useState("")
  const [loading, setLoading] = useState(false)
  const [playerInfo, setPlayerInfo] = useState<PlayerInfo | null>(null)
  const [eventsData, setEventsData] = useState<Record<string, EventStats> | null>(null)
  const [error, setError] = useState("")

  const calculateStats = (rank: number, totalCompetitors: number): RegionStats => {
    const percentDownList = (rank / totalCompetitors) * 100
    const percentile = (1 - (rank - 1) / totalCompetitors) * 100
    return {
      totalCompetitors,
      percentile: Math.max(0, Math.min(100, percentile)),
      percentDownList,
    }
  }

  const fetchStats = async () => {
    if (!wcaId.trim()) {
      setError("Please enter a WCA ID")
      return
    }

    setLoading(true)
    setError("")
    setPlayerInfo(null)
    setEventsData(null)

    const startTime = Date.now()

    try {
      const playerResponse = await fetch(
        `https://raw.githubusercontent.com/robiningelbrecht/wca-rest-api/master/api/persons/${wcaId}.json`,
      )

      if (!playerResponse.ok) {
        throw new Error("Player not found. Please check the WCA ID.")
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
        throw new Error("Invalid player data received from API")
      }

      console.log("[v0] Player country data:", player.country)
      console.log("[v0] Player countryIso2:", player.countryIso2)
      console.log("[v0] Player avatar data:", player.avatar)
      console.log("[v0] Player full data keys:", Object.keys(player))

      const countryIso = player.country || player.countryIso2 || "XX"
      console.log("[v0] Extracted countryIso:", countryIso)

      const continentCode = CONTINENT_CODES[player.continent] || "world"

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
        // Process singles for all events
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

        // Process averages for all events
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

      if (Object.keys(transformedPlayer.personal_records).length === 0) {
        throw new Error("No competition records found for this player.")
      }

      setPlayerInfo(transformedPlayer)

      const eventIds = Object.keys(transformedPlayer.personal_records)
      const allEventsData: Record<string, EventStats> = {}

      for (const eventId of eventIds) {
        const eventRecord = transformedPlayer.personal_records[eventId]

        // Fetch totals for this event
        const [
          worldSingleResponse,
          worldAverageResponse,
          continentalSingleResponse,
          continentalAverageResponse,
          nationalSingleResponse,
          nationalAverageResponse,
        ] = await Promise.all([
          fetch(
            `https://raw.githubusercontent.com/robiningelbrecht/wca-rest-api/master/api/rank/world/single/${eventId}.json`,
          ),
          fetch(
            `https://raw.githubusercontent.com/robiningelbrecht/wca-rest-api/master/api/rank/world/average/${eventId}.json`,
          ),
          fetch(
            `https://raw.githubusercontent.com/robiningelbrecht/wca-rest-api/master/api/rank/${continentCode}/single/${eventId}.json`,
          ),
          fetch(
            `https://raw.githubusercontent.com/robiningelbrecht/wca-rest-api/master/api/rank/${continentCode}/average/${eventId}.json`,
          ),
          fetch(
            `https://raw.githubusercontent.com/robiningelbrecht/wca-rest-api/master/api/rank/${countryIso.toUpperCase()}/single/${eventId}.json`,
          ),
          fetch(
            `https://raw.githubusercontent.com/robiningelbrecht/wca-rest-api/master/api/rank/${countryIso.toUpperCase()}/average/${eventId}.json`,
          ),
        ])

        console.log(`[v0] National API URLs for ${eventId}:`)
        console.log(
          `[v0] Single: https://raw.githubusercontent.com/robiningelbrecht/wca-rest-api/master/api/rank/${countryIso.toUpperCase()}/single/${eventId}.json`,
        )
        console.log(
          `[v0] Average: https://raw.githubusercontent.com/robiningelbrecht/wca-rest-api/master/api/rank/${countryIso.toUpperCase()}/average/${eventId}.json`,
        )
        console.log(`[v0] National Single Response OK: ${nationalSingleResponse.ok}`)
        console.log(`[v0] National Average Response OK: ${nationalAverageResponse.ok}`)

        let worldSingleTotal = 0,
          worldAverageTotal = 0
        let continentalSingleTotal = 0,
          continentalAverageTotal = 0
        let nationalSingleTotal = 0,
          nationalAverageTotal = 0

        if (worldSingleResponse.ok) {
          const data = await worldSingleResponse.json()
          worldSingleTotal = data.total || 0
        }
        if (worldAverageResponse.ok) {
          const data = await worldAverageResponse.json()
          worldAverageTotal = data.total || 0
        }
        if (continentalSingleResponse.ok) {
          const data = await continentalSingleResponse.json()
          continentalSingleTotal = data.total || 0
        }
        if (continentalAverageResponse.ok) {
          const data = await continentalAverageResponse.json()
          continentalAverageTotal = data.total || 0
        }
        if (nationalSingleResponse.ok) {
          const data = await nationalSingleResponse.json()
          nationalSingleTotal = data.total || 0
          console.log(`[v0] National Single Total for ${eventId}: ${nationalSingleTotal}`)
        } else {
          console.log(`[v0] National Single API failed for ${eventId}: ${nationalSingleResponse.status}`)
        }
        if (nationalAverageResponse.ok) {
          const data = await nationalAverageResponse.json()
          nationalAverageTotal = data.total || 0
          console.log(`[v0] National Average Total for ${eventId}: ${nationalAverageTotal}`)
        } else {
          console.log(`[v0] National Average API failed for ${eventId}: ${nationalAverageResponse.status}`)
        }

        const eventStats: EventStats = {
          single: {
            nr: { totalCompetitors: 0, percentile: 0, percentDownList: 0 },
            cr: { totalCompetitors: 0, percentile: 0, percentDownList: 0 },
            wr: { totalCompetitors: 0, percentile: 0, percentDownList: 0 },
            rank: {
              nr: eventRecord.single?.national_ranking || 0,
              cr: eventRecord.single?.continental_ranking || 0,
              wr: eventRecord.single?.world_ranking || 0,
            },
          },
          average: {
            nr: { totalCompetitors: 0, percentile: 0, percentDownList: 0 },
            cr: { totalCompetitors: 0, percentile: 0, percentDownList: 0 },
            wr: { totalCompetitors: 0, percentile: 0, percentDownList: 0 },
            rank: {
              nr: eventRecord.average?.national_ranking || 0,
              cr: eventRecord.average?.continental_ranking || 0,
              wr: eventRecord.average?.world_ranking || 0,
            },
          },
        }

        // Calculate percentiles for single
        if (worldSingleTotal > 0 && eventStats.single.rank.wr > 0) {
          eventStats.single.wr = calculateStats(eventStats.single.rank.wr, worldSingleTotal)
        }
        if (continentalSingleTotal > 0 && eventStats.single.rank.cr > 0) {
          eventStats.single.cr = calculateStats(eventStats.single.rank.cr, continentalSingleTotal)
        }
        if (nationalSingleTotal > 0 && eventStats.single.rank.nr > 0) {
          eventStats.single.nr = calculateStats(eventStats.single.rank.nr, nationalSingleTotal)
          console.log(
            `[v0] NR Single for ${eventId}: rank=${eventStats.single.rank.nr}, total=${nationalSingleTotal}, percentile=${eventStats.single.nr.percentile}`,
          )
        }

        // Calculate percentiles for average
        if (worldAverageTotal > 0 && eventStats.average.rank.wr > 0) {
          eventStats.average.wr = calculateStats(eventStats.average.rank.wr, worldAverageTotal)
        }
        if (continentalAverageTotal > 0 && eventStats.average.rank.cr > 0) {
          eventStats.average.cr = calculateStats(eventStats.average.rank.cr, continentalAverageTotal)
        }
        if (nationalAverageTotal > 0 && eventStats.average.rank.nr > 0) {
          eventStats.average.nr = calculateStats(eventStats.average.rank.nr, nationalAverageTotal)
          console.log(
            `[v0] NR Average for ${eventId}: rank=${eventStats.average.rank.nr}, total=${nationalAverageTotal}, percentile=${eventStats.average.nr.percentile}`,
          )
        }

        allEventsData[eventId] = eventStats
      }

      setEventsData(allEventsData)

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

  const getCountryEmoji = (iso2: string) => {
    const countryFlags: Record<string, string> = {
      in: "🇮🇳",
      us: "🇺🇸",
      cn: "🇨🇳",
      au: "🇦🇺",
      gb: "🇬🇧",
      de: "🇩🇪",
      fr: "🇫🇷",
      jp: "🇯🇵",
      kr: "🇰🇷",
      ca: "🇨🇦",
    }
    return countryFlags[iso2.toLowerCase()] || "🏳️"
  }

  const getContinentEmoji = (continent: string) => {
    const continentEmojis: Record<string, string> = {
      Asia: "🌏",
      Europe: "🌍",
      "North America": "🌎",
      "South America": "🌎",
      Africa: "🌍",
      Oceania: "🌏",
    }
    return continentEmojis[continent] || "🌍"
  }

  return (
    <div className="min-h-screen glass-bg relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Left spotlight */}
        <div className="spotlight-left"></div>

        {/* Right spotlight */}
        <div className="spotlight-right"></div>

        {/* Enhanced star field */}
        <div className="star-field top-1/5 left-1/5" style={{ animationDelay: "0s" }}></div>
        <div className="star-field top-1/3 right-1/4" style={{ animationDelay: "1s" }}></div>
        <div className="star-field bottom-1/3 left-1/6" style={{ animationDelay: "2s" }}></div>
        <div className="star-field top-2/3 right-1/6" style={{ animationDelay: "1.5s" }}></div>
        <div className="star-field bottom-1/5 right-1/3" style={{ animationDelay: "0.5s" }}></div>
        <div className="star-field top-1/6 left-2/3" style={{ animationDelay: "2.5s" }}></div>
        <div className="star-field bottom-2/3 left-1/3" style={{ animationDelay: "3s" }}></div>
        <div className="star-field top-3/4 left-1/8" style={{ animationDelay: "1.8s" }}></div>
        <div className="star-field bottom-1/6 right-1/8" style={{ animationDelay: "2.2s" }}></div>
        <div className="star-field top-1/8 right-2/3" style={{ animationDelay: "0.8s" }}></div>
      </div>

      <div className="container mx-auto px-4 py-8 relative z-10">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-heading font-black text-glass-primary mb-4 tracking-wider">CUBIFY8</h1>
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-1 h-6 bg-glass-accent"></div>
            <p className="text-xl text-glass-accent font-bold tracking-wide">WCA STATS ANALYZER</p>
            <div className="w-1 h-6 bg-glass-accent"></div>
          </div>
          <p className="text-glass-muted max-w-2xl mx-auto text-balance font-medium">
            Discover your position in the speedcubing universe. Real-time rankings for all events across all regions.
          </p>
          <div className="mt-6">
            <Link href="/compare">
              <Button className="neuro-button text-glass-primary font-heading font-black tracking-wider rounded-xl">
                <Users className="mr-2 h-5 w-5" />
                COMPARE PLAYERS
              </Button>
            </Link>
          </div>
        </div>

        <div className="max-w-md mx-auto mb-12">
          <div className="glass-card rounded-2xl p-6 animate-pulse-glow">
            <div className="flex items-center gap-3 mb-4">
              <Search className="text-glass-accent" size={24} />
              <h2 className="text-xl font-heading font-black text-glass-accent tracking-wide">ENTER WCA ID</h2>
            </div>
            <p className="text-sm text-glass-muted mb-6 font-medium">
              Input your WCA ID to analyze your performance across all events
            </p>
            <div className="space-y-4">
              <Input
                placeholder="e.g., 2022RPRA01"
                value={wcaId}
                onChange={(e) => setWcaId(e.target.value.toUpperCase())}
                onKeyPress={(e) => e.key === "Enter" && fetchStats()}
                disabled={loading}
                className="bg-glass-secondary border-glass-border text-glass-primary placeholder:text-glass-muted focus:border-glass-accent focus:ring-glass-accent/30 rounded-xl h-12 text-center font-mono tracking-wider font-bold backdrop-blur-sm"
              />
              <Button
                onClick={fetchStats}
                disabled={loading}
                className="neuro-button w-full h-12 text-glass-primary font-heading font-black tracking-wider rounded-xl"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    ANALYZING...
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-5 w-5" />
                    FETCH STATS
                  </>
                )}
              </Button>
              {error && (
                <div className="text-red-300 text-sm text-center p-3 bg-red-500/10 rounded-lg border border-red-500/20 font-medium backdrop-blur-sm">
                  {error}
                </div>
              )}
            </div>
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
                <p className="text-center text-glass-secondary font-bold">Fetching your WCA statistics...</p>
              </div>
            </div>
          </div>
        )}

        {playerInfo && !loading && (
          <div className="max-w-2xl mx-auto mb-8">
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center gap-4 mb-4">
                {playerInfo.avatar?.url && (
                  <img
                    src={playerInfo.avatar.url || "/placeholder.svg"}
                    alt={playerInfo.name}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                )}
                <div>
                  <h3 className="text-2xl font-heading font-black text-glass-accent tracking-wide">
                    {playerInfo.name.toUpperCase()}
                  </h3>
                  <div className="flex items-center gap-3 mt-2">
                    <img
                      src={`https://flagcdn.com/24x18/${playerInfo.country.iso2}.png`}
                      alt={playerInfo.country.name}
                      className="rounded border border-glass-border"
                    />
                    <span className="text-glass-secondary font-bold">{playerInfo.country.name}</span>
                    <Badge className="bg-glass-accent/20 text-glass-accent border-glass-accent/30 font-mono font-bold">
                      {playerInfo.wca_id}
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
                  href={`https://www.worldcubeassociation.org/persons/${playerInfo.wca_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-glass-accent font-bold"
                >
                  View WCA Profile <ExternalLink size={14} />
                </a>
              </Button>
            </div>
          </div>
        )}

        {eventsData && playerInfo && !loading && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
            {Object.entries(eventsData).map(([eventId, eventStats]) => (
              <div key={eventId} className="glass-card rounded-2xl p-6 animate-float">
                <div className="flex items-center gap-3 mb-4">
                  <Trophy className="text-glass-accent" size={20} />
                  <h3 className="text-lg font-heading font-black text-glass-accent tracking-wide">
                    {EVENT_NAMES[eventId] || eventId.toUpperCase()}
                  </h3>
                </div>

                {/* Single and Average Results */}
                <div className="space-y-4">
                  {playerInfo.personal_records[eventId].single && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-black text-glass-secondary">SINGLE</h4>
                      <p className="text-xs text-glass-muted font-mono font-bold">
                        Best: {formatTime(playerInfo.personal_records[eventId].single!.best)}
                      </p>

                      {/* Rankings */}
                      <div className="space-y-1 text-xs">
                        {eventStats.single.rank.nr > 0 && (
                          <div className="flex justify-between">
                            <span className="font-bold">
                              <span className="text-glass-accent font-black">NR:</span> #{eventStats.single.rank.nr}
                            </span>
                            {(() => {
                              if (eventStats.single.rank.nr > 0) {
                                const percentile = eventStats.single.nr.percentile
                                if (percentile >= 99.9) {
                                  return <span className="text-glass-accent font-bold">Top 0.1%</span>
                                } else if (percentile >= 99) {
                                  return <span className="text-glass-accent font-bold">Top 1%</span>
                                } else {
                                  const displayPercentage = (100 - percentile).toFixed(1)
                                  return <span className="text-glass-accent font-bold">Top {displayPercentage}%</span>
                                }
                              }
                              return null
                            })()}
                          </div>
                        )}
                        {eventStats.single.rank.cr > 0 && (
                          <div className="flex justify-between">
                            <span className="font-bold">
                              <span className="text-glass-secondary font-black">CR:</span> #{eventStats.single.rank.cr}
                            </span>
                            <span className="text-glass-secondary font-bold">
                              {(() => {
                                const percentile = eventStats.single.cr.percentile
                                if (percentile >= 99.9) {
                                  return "Top 0.1%"
                                } else if (percentile >= 99) {
                                  return "Top 1%"
                                } else if (percentile > 0) {
                                  return `Top ${(100 - percentile).toFixed(1)}%`
                                } else {
                                  return "Ranked"
                                }
                              })()}
                            </span>
                          </div>
                        )}
                        {eventStats.single.rank.wr > 0 && (
                          <div className="flex justify-between">
                            <span className="font-bold">
                              <span className="text-glass-primary font-black">WR:</span> #{eventStats.single.rank.wr}
                            </span>
                            <span className="text-glass-primary font-bold">
                              {(() => {
                                const percentile = eventStats.single.wr.percentile
                                if (percentile >= 99.9) {
                                  return "Top 0.1%"
                                } else if (percentile >= 99) {
                                  return "Top 1%"
                                } else if (percentile > 0) {
                                  return `Top ${(100 - percentile).toFixed(1)}%`
                                } else {
                                  return "Ranked"
                                }
                              })()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {playerInfo.personal_records[eventId].average && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-black text-glass-secondary">AVERAGE</h4>
                      <p className="text-xs text-glass-muted font-mono font-bold">
                        Best: {formatTime(playerInfo.personal_records[eventId].average!.best)}
                      </p>

                      {/* Rankings */}
                      <div className="space-y-1 text-xs">
                        {eventStats.average.rank.nr > 0 && (
                          <div className="flex justify-between">
                            <span className="font-bold">
                              <span className="text-glass-accent font-black">NR:</span> #{eventStats.average.rank.nr}
                            </span>
                            {(() => {
                              if (eventStats.average.rank.nr > 0) {
                                const percentile = eventStats.average.nr.percentile
                                if (percentile >= 99.9) {
                                  return <span className="text-glass-accent font-bold">Top 0.1%</span>
                                } else if (percentile >= 99) {
                                  return <span className="text-glass-accent font-bold">Top 1%</span>
                                } else {
                                  const displayPercentage = (100 - percentile).toFixed(1)
                                  return <span className="text-glass-accent font-bold">Top {displayPercentage}%</span>
                                }
                              }
                              return null
                            })()}
                          </div>
                        )}
                        {eventStats.average.rank.cr > 0 && (
                          <div className="flex justify-between">
                            <span className="font-bold">
                              <span className="text-glass-secondary font-black">CR:</span> #{eventStats.average.rank.cr}
                            </span>
                            <span className="text-glass-secondary font-bold">
                              {(() => {
                                const percentile = eventStats.average.cr.percentile
                                if (percentile >= 99.9) {
                                  return "Top 0.1%"
                                } else if (percentile >= 99) {
                                  return "Top 1%"
                                } else if (percentile > 0) {
                                  return `Top ${(100 - percentile).toFixed(1)}%`
                                } else {
                                  return "Ranked"
                                }
                              })()}
                            </span>
                          </div>
                        )}
                        {eventStats.average.rank.wr > 0 && (
                          <div className="flex justify-between">
                            <span className="font-bold">
                              <span className="text-glass-primary font-black">WR:</span> #{eventStats.average.rank.wr}
                            </span>
                            <span className="text-glass-primary font-bold">
                              {(() => {
                                const percentile = eventStats.average.wr.percentile
                                if (percentile >= 99.9) {
                                  return "Top 0.1%"
                                } else if (percentile >= 99) {
                                  return "Top 1%"
                                } else if (percentile > 0) {
                                  return `Top ${(100 - percentile).toFixed(1)}%`
                                } else {
                                  return "Ranked"
                                }
                              })()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
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
