"use client"

import { useMemo, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { fetchWcaPerson } from "@/lib/wca-person"
import { CountUp } from "@/components/motion/CountUp"
import { SiteFooter, SiteHeader } from "@/components/layout/SiteChrome"
import { EditorialButton, EditorialInput } from "@/components/ui/editorial-field"
import { eventDisplayName } from "@/lib/wca-events"
import { formatResult } from "@/lib/wca-format"
import { ArrowRight, Loader2, ExternalLink } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

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

type Side = "player1" | "player2" | "tie" | null
type Kind = "single" | "average"

const ease = [0.16, 1, 0.3, 1] as const

function firstName(name: string) {
  return name.split(" ")[0]
}

function getBetterRank(rank1?: number, rank2?: number): Side {
  const has1 = typeof rank1 === "number" && rank1 > 0
  const has2 = typeof rank2 === "number" && rank2 > 0
  if (!has1 && !has2) return null
  if (!has1) return "player2"
  if (!has2) return "player1"
  if (rank1! < rank2!) return "player1"
  if (rank2! < rank1!) return "player2"
  return "tie"
}

function PlayerAvatar({
  player,
  size = "md",
}: {
  player: PlayerInfo
  size?: "md" | "lg"
}) {
  const dim = size === "lg" ? "h-20 w-20 sm:h-24 sm:w-24" : "h-14 w-14 sm:h-16 sm:w-16"
  if (player.avatar?.url) {
    return (
      <img
        src={player.avatar.url}
        alt={player.name}
        className={cn("cube-frame object-cover", dim)}
      />
    )
  }
  return (
    <div
      className={cn(
        "cube-frame flex items-center justify-center bg-secondary font-display font-bold text-muted-foreground",
        dim,
        size === "lg" ? "text-2xl sm:text-3xl" : "text-lg",
      )}
    >
      {player.name.charAt(0)}
    </div>
  )
}

function ScoreBoard({
  title,
  blurb,
  p1,
  p2,
  name1,
  name2,
  accent,
}: {
  title: string
  blurb: string
  p1: number
  p2: number
  name1: string
  name2: string
  accent: "nr" | "cr"
}) {
  const total = Math.max(p1 + p2, 1)
  const p1Pct = (p1 / total) * 100
  const lead =
    p1 > p2 ? `${name1} leads` : p2 > p1 ? `${name2} leads` : "Tied"

  return (
    <div className="bezel h-full">
      <div className="bezel-inner flex h-full flex-col p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {title}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{blurb}</p>
          </div>
          <span
            className={cn(
              "facelet",
              accent === "nr" ? "facelet-nr" : "facelet-cr",
            )}
          >
            {accent === "nr" ? "FAIR" : "FULL"}
          </span>
        </div>

        <div className="mt-8 flex items-end justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "time-display text-5xl tracking-tight sm:text-6xl",
                p1 >= p2 ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <CountUp value={p1} />
            </p>
            <p className="mt-2 truncate text-sm font-semibold text-muted-foreground">
              {name1}
            </p>
          </div>
          <div className="pb-3 text-center">
            <span className="font-data text-[11px] font-bold tracking-[0.28em] text-muted-foreground">
              VS
            </span>
          </div>
          <div className="min-w-0 flex-1 text-right">
            <p
              className={cn(
                "time-display text-5xl tracking-tight sm:text-6xl",
                p2 >= p1 ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <CountUp value={p2} />
            </p>
            <p className="mt-2 truncate text-sm font-semibold text-muted-foreground">
              {name2}
            </p>
          </div>
        </div>

        <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-secondary">
          <div className="flex h-full w-full">
            <div
              className="h-full bg-[var(--rank-nr)] transition-all duration-700"
              style={{ width: `${p1Pct}%` }}
            />
            <div
              className="h-full bg-[var(--rank-cr)] transition-all duration-700"
              style={{ width: `${100 - p1Pct}%` }}
            />
          </div>
        </div>

        <p className="mt-4 text-sm font-medium text-foreground">{lead}</p>
      </div>
    </div>
  )
}

function DuelSlot({
  kind,
  eventId,
  rec1,
  rec2,
  winner,
  name1,
  name2,
}: {
  kind: Kind
  eventId: string
  rec1?: { best: number; world_ranking: number }
  rec2?: { best: number; world_ranking: number }
  winner: Side
  name1: string
  name2: string
}) {
  if (!rec1 && !rec2) return null

  return (
    <div className="rounded-lg border border-border bg-secondary/50 p-3.5 sm:p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          {kind}
        </span>
        <span
          className={cn(
            "rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
            winner === "player1" && "bg-[var(--rank-nr)] text-[#050506]",
            winner === "player2" && "bg-[var(--rank-cr)] text-[#050506]",
            winner === "tie" && "bg-primary text-primary-foreground",
            !winner && "bg-muted text-muted-foreground",
          )}
        >
          {winner === "player1"
            ? name1
            : winner === "player2"
              ? name2
              : winner === "tie"
                ? "Tie"
                : "—"}
        </span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
        <div
          className={cn(
            "min-w-0",
            winner === "player1" && "opacity-100",
            winner === "player2" && "opacity-45",
          )}
        >
          {rec1 ? (
            <>
              <p className="time-display text-xl text-foreground sm:text-2xl">
                {formatResult(eventId, rec1.best, kind)}
              </p>
              <p className="stat-num mt-1 text-[11px] text-muted-foreground">
                WR #{rec1.world_ranking.toLocaleString()}
              </p>
            </>
          ) : (
            <p className="font-data text-sm text-muted-foreground">—</p>
          )}
        </div>

        <div className="flex flex-col items-center gap-1 px-1">
          <span className="font-data text-[9px] font-bold tracking-[0.2em] text-muted-foreground">
            VS
          </span>
        </div>

        <div
          className={cn(
            "min-w-0 text-right",
            winner === "player2" && "opacity-100",
            winner === "player1" && "opacity-45",
          )}
        >
          {rec2 ? (
            <>
              <p className="time-display text-xl text-foreground sm:text-2xl">
                {formatResult(eventId, rec2.best, kind)}
              </p>
              <p className="stat-num mt-1 text-[11px] text-muted-foreground">
                WR #{rec2.world_ranking.toLocaleString()}
              </p>
            </>
          ) : (
            <p className="font-data text-sm text-muted-foreground">—</p>
          )}
        </div>
      </div>
    </div>
  )
}

function EventDuelCard({
  eventId,
  player1,
  player2,
  index,
}: {
  eventId: string
  player1: PlayerInfo
  player2: PlayerInfo
  index: number
}) {
  const e1 = player1.personal_records[eventId]
  const e2 = player2.personal_records[eventId]
  const singleWinner = getBetterRank(e1?.single?.world_ranking, e2?.single?.world_ranking)
  const averageWinner = getBetterRank(e1?.average?.world_ranking, e2?.average?.world_ranking)
  const n1 = firstName(player1.name)
  const n2 = firstName(player2.name)

  if (!e1 && !e2) return null

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: Math.min(index * 0.035, 0.35), ease }}
      className="surface-card surface-card-hover rounded-xl p-5 sm:p-6"
    >
      <header className="mb-4 flex items-start justify-between gap-3 border-b border-border pb-4">
        <div>
          <h3 className="font-display text-lg font-extrabold tracking-tight text-foreground">
            {eventDisplayName(eventId)}
          </h3>
          <p className="mt-1 font-data text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {eventId}
          </p>
        </div>
        <div className="flex gap-1">
          {e1 && e2 ? (
            <span className="rounded-full border border-border px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
              Shared
            </span>
          ) : (
            <span className="rounded-full border border-border px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
              One side
            </span>
          )}
        </div>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
        <p className="truncate font-semibold text-foreground/80">{n1}</p>
        <p className="truncate text-right font-semibold text-foreground/80">{n2}</p>
      </div>

      <div className="space-y-3">
        {(e1?.single || e2?.single) && (
          <DuelSlot
            kind="single"
            eventId={eventId}
            rec1={e1?.single}
            rec2={e2?.single}
            winner={singleWinner}
            name1={n1}
            name2={n2}
          />
        )}
        {(e1?.average || e2?.average) && (
          <DuelSlot
            kind="average"
            eventId={eventId}
            rec1={e1?.average}
            rec2={e2?.average}
            winner={averageWinner}
            name1={n1}
            name2={n2}
          />
        )}
      </div>
    </motion.article>
  )
}

export default function ComparePage() {
  const [wcaId1, setWcaId1] = useState("")
  const [wcaId2, setWcaId2] = useState("")
  const [loading, setLoading] = useState(false)
  const [player1, setPlayer1] = useState<PlayerInfo | null>(null)
  const [player2, setPlayer2] = useState<PlayerInfo | null>(null)
  const [error, setError] = useState("")
  const abortRef = useRef<AbortController | null>(null)

  const compareStats = async () => {
    if (!wcaId1.trim() || !wcaId2.trim()) {
      setError("Enter both WCA IDs")
      return
    }

    // Cancel any in-flight comparison so a slower earlier pair can't overwrite this one.
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError("")
    setPlayer1(null)
    setPlayer2(null)

    try {
      const [playerData1, playerData2] = await Promise.all([
        fetchWcaPerson(wcaId1.trim(), controller.signal),
        fetchWcaPerson(wcaId2.trim(), controller.signal),
      ])

      setPlayer1(playerData1)
      setPlayer2(playerData2)
    } catch (err) {
      if (controller.signal.aborted) return
      setError(err instanceof Error ? err.message : "An error occurred while fetching data")
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  const allEvents = useMemo(() => {
    const events = new Set<string>()
    if (player1) Object.keys(player1.personal_records).forEach((e) => events.add(e))
    if (player2) Object.keys(player2.personal_records).forEach((e) => events.add(e))
    return Array.from(events).sort()
  }, [player1, player2])

  const points = useMemo(() => {
    if (!player1 || !player2) {
      return {
        fair: { player1: 0, player2: 0, events: [] as string[] },
        unfair: { player1: 0, player2: 0, events: [] as string[] },
      }
    }

    const fairPoints1 = { n: 0 }
    const fairPoints2 = { n: 0 }
    const unfairPoints1 = { n: 0 }
    const unfairPoints2 = { n: 0 }
    const fairEvents: string[] = []
    const unfairEvents: string[] = []

    const scoreSlot = (
      rank1: number | undefined,
      rank2: number | undefined,
      mode: "fair" | "unfair",
    ): Side => {
      const has1 = typeof rank1 === "number" && rank1 > 0
      const has2 = typeof rank2 === "number" && rank2 > 0
      if (has1 && has2) return getBetterRank(rank1, rank2)
      if (mode === "fair") return null
      if (has1 && !has2) return "player1"
      if (!has1 && has2) return "player2"
      return null
    }

    const apply = (winner: Side, a: { n: number }, b: { n: number }) => {
      if (winner === "player1") a.n++
      else if (winner === "player2") b.n++
    }

    allEvents.forEach((eventId) => {
      const event1 = player1.personal_records[eventId]
      const event2 = player2.personal_records[eventId]

      if (event1 && event2) {
        fairEvents.push(eventId)
        apply(
          scoreSlot(event1.single?.world_ranking, event2.single?.world_ranking, "fair"),
          fairPoints1,
          fairPoints2,
        )
        apply(
          scoreSlot(event1.average?.world_ranking, event2.average?.world_ranking, "fair"),
          fairPoints1,
          fairPoints2,
        )
      }

      unfairEvents.push(eventId)
      apply(
        scoreSlot(event1?.single?.world_ranking, event2?.single?.world_ranking, "unfair"),
        unfairPoints1,
        unfairPoints2,
      )
      apply(
        scoreSlot(event1?.average?.world_ranking, event2?.average?.world_ranking, "unfair"),
        unfairPoints1,
        unfairPoints2,
      )
    })

    return {
      fair: { player1: fairPoints1.n, player2: fairPoints2.n, events: fairEvents },
      unfair: { player1: unfairPoints1.n, player2: unfairPoints2.n, events: unfairEvents },
    }
  }, [player1, player2, allEvents])

  const hasResults = Boolean(player1 && player2 && !loading)
  const showHero = !hasResults && !loading

  return (
    <div className="editorial-page flex min-h-[100dvh] flex-col">
      <div className="editorial-shell flex min-h-[100dvh] flex-col">
        <SiteHeader active="compare" />

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 xl:max-w-[90rem] xl:px-8">
          {/* Hero + form */}
          {showHero && (
            <section className="grid min-h-[calc(100dvh-8rem)] items-center gap-12 border-b border-border py-14 md:grid-cols-12 md:gap-10 md:py-20">
              <motion.div
                className="md:col-span-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease }}
              >
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--rank-cr)]" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Head to head
                  </span>
                </div>
                <h1 className="display-title max-w-lg text-[2.75rem] text-foreground sm:text-6xl md:text-7xl">
                  Face to face.
                  <br />
                  Rank to rank.
                </h1>
                <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
                  Put two cubers on the board. Fair points on shared events, full points on
                  everything.
                </p>
                <div className="mt-8 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                    <span className="facelet facelet-nr">P1</span>
                    Fair edge
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                    <span className="facelet facelet-cr">P2</span>
                    Full board
                  </span>
                </div>
              </motion.div>

              <motion.div
                className="md:col-span-6"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.08, ease }}
              >
                <div className="bezel">
                  <div className="bezel-inner p-6 sm:p-8">
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div>
                        <label className="eyebrow mb-3 block">Player 1</label>
                        <EditorialInput
                          placeholder="2015PARK01"
                          value={wcaId1}
                          onChange={(e) => setWcaId1(e.target.value.toUpperCase())}
                          onKeyDown={(e) => e.key === "Enter" && compareStats()}
                          disabled={loading}
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="eyebrow mb-3 block">Player 2</label>
                        <EditorialInput
                          placeholder="2009ZEMD01"
                          value={wcaId2}
                          onChange={(e) => setWcaId2(e.target.value.toUpperCase())}
                          onKeyDown={(e) => e.key === "Enter" && compareStats()}
                          disabled={loading}
                        />
                      </div>
                    </div>

                    <div className="my-5 flex items-center gap-3">
                      <div className="h-px flex-1 bg-border" />
                      <span className="font-data text-[10px] font-bold tracking-[0.28em] text-muted-foreground">
                        VS
                      </span>
                      <div className="h-px flex-1 bg-border" />
                    </div>

                    <EditorialButton
                      onClick={compareStats}
                      disabled={loading}
                      className="inline-flex h-12 w-full items-center justify-center rounded-lg text-sm"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Comparing
                        </>
                      ) : (
                        <>
                          Start duel
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

                    <p className="mt-5 border-t border-border pt-4 text-[11px] text-muted-foreground">
                      Enter two official WCA IDs to open the scoreboard
                    </p>
                  </div>
                </div>
              </motion.div>
            </section>
          )}

          {/* Compact form when results showing */}
          {(hasResults || loading) && (
            <section className="border-b border-border py-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="eyebrow">Duel</p>
                  <p className="font-display mt-1 text-xl font-bold tracking-tight">
                    New matchup
                  </p>
                </div>
                <div className="grid w-full max-w-2xl gap-2 sm:grid-cols-[1fr_auto_1fr_auto]">
                  <EditorialInput
                    placeholder="Player 1"
                    value={wcaId1}
                    onChange={(e) => setWcaId1(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === "Enter" && compareStats()}
                    disabled={loading}
                  />
                  <span className="hidden items-center justify-center font-data text-[10px] font-bold tracking-[0.2em] text-muted-foreground sm:flex">
                    VS
                  </span>
                  <EditorialInput
                    placeholder="Player 2"
                    value={wcaId2}
                    onChange={(e) => setWcaId2(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === "Enter" && compareStats()}
                    disabled={loading}
                  />
                  <EditorialButton
                    onClick={compareStats}
                    disabled={loading}
                    className="inline-flex h-12 items-center justify-center rounded-lg px-5"
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
            </section>
          )}

          {loading && (
            <section className="space-y-6 py-12">
              <div className="grid gap-3 sm:grid-cols-2">
                {[0, 1].map((i) => (
                  <div key={i} className="bezel">
                    <div className="bezel-inner flex items-center gap-4 p-6">
                      <div className="skeleton-shimmer cube-frame h-20 w-20" />
                      <div className="flex-1 space-y-3">
                        <div className="skeleton-shimmer h-6 w-40 rounded" />
                        <div className="skeleton-shimmer h-3 w-28 rounded" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[0, 1].map((i) => (
                  <div key={i} className="surface-card space-y-4 rounded-xl p-6">
                    <div className="skeleton-shimmer h-3 w-16 rounded" />
                    <div className="skeleton-shimmer h-12 w-24 rounded" />
                    <div className="skeleton-shimmer h-1.5 w-full rounded-full" />
                  </div>
                ))}
              </div>
            </section>
          )}

          {hasResults && player1 && player2 && (
            <>
              {/* Dual masthead */}
              <section className="py-10 sm:py-12">
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, ease }}
                  className="bezel"
                >
                  <div className="bezel-inner overflow-hidden p-0">
                    <div className="grid md:grid-cols-[1fr_auto_1fr]">
                      {/* P1 */}
                      <div className="relative p-6 sm:p-8">
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[var(--rank-nr)]/8 to-transparent" />
                        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
                          <PlayerAvatar player={player1} size="lg" />
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--rank-nr)]">
                              Player 1
                            </p>
                            <h2 className="font-display mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
                              {player1.name}
                            </h2>
                            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                              <img
                                src={`https://flagcdn.com/20x15/${player1.country.iso2.toLowerCase()}.png`}
                                alt={player1.country.name}
                                loading="lazy"
                                decoding="async"
                                className="rounded-[2px]"
                              />
                              <span className="font-medium">{player1.country.name}</span>
                              <Badge
                                variant="outline"
                                className="rounded border-border bg-secondary font-data text-[11px] font-semibold"
                              >
                                {player1.wca_id}
                              </Badge>
                            </div>
                            <a
                              href={`https://www.worldcubeassociation.org/persons/${player1.wca_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-ghost mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs"
                            >
                              WCA profile
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        </div>
                      </div>

                      {/* VS pill */}
                      <div className="flex items-center justify-center border-y border-border bg-secondary/40 px-4 py-3 md:border-x md:border-y-0">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card font-data text-[11px] font-extrabold tracking-[0.12em] text-foreground">
                          VS
                        </div>
                      </div>

                      {/* P2 */}
                      <div className="relative p-6 sm:p-8">
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-bl from-[var(--rank-cr)]/8 to-transparent" />
                        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center md:flex-row-reverse md:text-right">
                          <PlayerAvatar player={player2} size="lg" />
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--rank-cr)]">
                              Player 2
                            </p>
                            <h2 className="font-display mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
                              {player2.name}
                            </h2>
                            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground md:justify-end">
                              <img
                                src={`https://flagcdn.com/20x15/${player2.country.iso2.toLowerCase()}.png`}
                                alt={player2.country.name}
                                loading="lazy"
                                decoding="async"
                                className="rounded-[2px]"
                              />
                              <span className="font-medium">{player2.country.name}</span>
                              <Badge
                                variant="outline"
                                className="rounded border-border bg-secondary font-data text-[11px] font-semibold"
                              >
                                {player2.wca_id}
                              </Badge>
                            </div>
                            <a
                              href={`https://www.worldcubeassociation.org/persons/${player2.wca_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-ghost mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs md:float-right"
                            >
                              WCA profile
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </section>

              {/* Scoreboards */}
              <section className="pb-10">
                <div className="mb-5 flex items-end justify-between border-b border-border pb-4">
                  <div>
                    <h3 className="font-display text-2xl font-extrabold tracking-tight">
                      Scoreboard
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Points from better world ranks
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ScoreBoard
                    title="Fair"
                    blurb={`Shared events only · ${points.fair.events.length}`}
                    p1={points.fair.player1}
                    p2={points.fair.player2}
                    name1={firstName(player1.name)}
                    name2={firstName(player2.name)}
                    accent="nr"
                  />
                  <ScoreBoard
                    title="Full"
                    blurb={`All events · ${points.unfair.events.length}`}
                    p1={points.unfair.player1}
                    p2={points.unfair.player2}
                    name1={firstName(player1.name)}
                    name2={firstName(player2.name)}
                    accent="cr"
                  />
                </div>
              </section>

              {/* Event duels — no HTML table */}
              <section className="pb-20">
                <div className="mb-5 flex items-end justify-between border-b border-border pb-4">
                  <div>
                    <h3 className="font-display text-2xl font-extrabold tracking-tight">
                      Event duels
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Times and WR · winner marked facelet-style
                    </p>
                  </div>
                  <span className="stat-num text-sm text-muted-foreground">
                    {allEvents.length} events
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {allEvents.map((eventId, index) => (
                    <EventDuelCard
                      key={eventId}
                      eventId={eventId}
                      player1={player1}
                      player2={player2}
                      index={index}
                    />
                  ))}
                </div>
              </section>
            </>
          )}
        </main>

        <SiteFooter />
      </div>
    </div>
  )
}
