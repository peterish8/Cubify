"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowRight, Loader2 } from "lucide-react"
import { SiteFooter, SiteHeader } from "@/components/layout/SiteChrome"
import { FloatingThemeCube } from "@/components/motion/FloatingThemeCube"
import { EditorialButton, EditorialInput } from "@/components/ui/editorial-field"
import { EVENT_NAMES, eventDisplayName } from "@/lib/wca-events"
import { formatResult } from "@/lib/wca-format"
import {
  fetchRankTotals,
  formatTopPercent,
  type RankTotalsDocument,
  type RankType,
} from "@/lib/wca-rank-totals"
import {
  fetchRankList,
  prefetchRankLists,
  resultToAllScopeRanks,
  targetToRequiredBest,
  type AllScopeRanks,
  type RankListIndex,
  type RankScope,
} from "@/lib/wca-rank-list"
import {
  formatResultInputValue,
  parseResultInput,
  resultInputHint,
  resultInputKind,
  resultInputPlaceholder,
} from "@/lib/wca-result-input"
import { fetchWcaPerson } from "@/lib/wca-person"
import { cn } from "@/lib/utils"

interface PlayerInfo {
  name: string
  country: { name: string; iso2: string; continentId: string }
  continent: string
  wca_id: string
  avatar?: { url: string }
  personal_records: Record<
    string,
    {
      single?: { best: number }
      average?: { best: number }
    }
  >
}

const ease = [0.16, 1, 0.3, 1] as const
const FEATURED = ["333", "222", "444", "333oh", "555", "pyram", "skewb", "333bf", "333fm"]

const EVENT_IDS = Object.keys(EVENT_NAMES).filter(
  (id) => id !== "magic" && id !== "mmagic" && id !== "333mbo",
)

function formatExportDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(value))
}

function ScopeCard({
  scope,
  label,
  face,
  ranks,
  rankDraft,
  percentDraft,
  onRankChange,
  onPercentChange,
  disabled,
}: {
  scope: RankScope
  label: string
  face: string
  ranks: AllScopeRanks | null
  rankDraft: string
  percentDraft: string
  onRankChange: (value: string) => void
  onPercentChange: (value: string) => void
  disabled?: boolean
}) {
  const result = ranks?.[scope]
  const pct = result ? formatTopPercent(result.topPercent) : null

  return (
    <div className="surface-card rounded-xl p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`facelet ${face}`}>{label}</span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {scope === "nr" ? "National" : scope === "cr" ? "Continental" : "World"}
          </span>
        </div>
        {result && result.rank > 0 && (
          <span className="stat-num text-lg text-foreground">#{result.rank.toLocaleString()}</span>
        )}
      </div>

      {pct && (
        <p className="mb-3 font-data text-sm text-muted-foreground">{pct}</p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Rank
          </span>
          <EditorialInput
            inputMode="numeric"
            placeholder="#"
            value={rankDraft}
            disabled={disabled}
            onChange={(e) => onRankChange(e.target.value)}
            className="h-10 text-sm"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Top %
          </span>
          <EditorialInput
            inputMode="decimal"
            placeholder="1.5"
            value={percentDraft}
            disabled={disabled}
            onChange={(e) => onPercentChange(e.target.value)}
            className="h-10 text-sm"
          />
        </label>
      </div>
      {result && result.tiesWith > 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Tied with {result.tiesWith.toLocaleString()} other
          {result.tiesWith === 1 ? "" : "s"} at this result
        </p>
      )}
    </div>
  )
}

export default function GoalPage() {
  const bootstrappedRef = useRef(false)
  /** Optional best from URL to apply after list load (centiseconds / WCA units). */
  const pendingBestRef = useRef<number | null>(null)

  const [wcaId, setWcaId] = useState("")
  const [playerLoading, setPlayerLoading] = useState(false)
  const [player, setPlayer] = useState<PlayerInfo | null>(null)
  const [playerError, setPlayerError] = useState("")

  const [eventId, setEventId] = useState("333")
  const [rankType, setRankType] = useState<RankType>("single")

  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState("")
  const [index, setIndex] = useState<RankListIndex | null>(null)
  const [totals, setTotals] = useState<RankTotalsDocument | null>(null)

  const [resultDraft, setResultDraft] = useState("")
  const [hypotheticalBest, setHypotheticalBest] = useState<number | null>(null)
  const [ranks, setRanks] = useState<AllScopeRanks | null>(null)

  const [rankDrafts, setRankDrafts] = useState<Record<RankScope, string>>({
    nr: "",
    cr: "",
    wr: "",
  })
  const [percentDrafts, setPercentDrafts] = useState<Record<RankScope, string>>({
    nr: "",
    cr: "",
    wr: "",
  })

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const driverRef = useRef<"result" | RankScope | null>(null)

  const inputKind = resultInputKind(eventId, rankType)
  const previousBest =
    player?.personal_records[eventId]?.[rankType]?.best &&
    player.personal_records[eventId]![rankType]!.best > 0
      ? player.personal_records[eventId]![rankType]!.best
      : null

  const cleanPercentDraft = (value: string) => {
    const cleaned = value.replace(/[^\d.]/g, "")
    const [head, ...rest] = cleaned.split(".")
    return rest.length ? `${head}.${rest.join("")}` : head
  }

  const formatPctDraft = (value: number | null) =>
    value !== null ? value.toFixed(value < 1 ? 2 : 1) : ""

  const applyBest = useCallback(
    (
      best: number | null,
      list: RankListIndex | null,
      totalsDoc: RankTotalsDocument | null,
      p: PlayerInfo | null,
      /** When set, leave that scope's rank/% drafts alone (user is typing them). */
      preserveScope: RankScope | null = null,
    ) => {
      setHypotheticalBest(best)
      if (best === null || !list || !p) {
        setRanks(null)
        if (driverRef.current === "result") {
          setRankDrafts({ nr: "", cr: "", wr: "" })
          setPercentDrafts({ nr: "", cr: "", wr: "" })
        }
        return
      }
      const next = resultToAllScopeRanks(
        list,
        best,
        previousBest,
        p.country.iso2,
        p.country.continentId,
        totalsDoc,
      )
      setRanks(next)
      setRankDrafts((prev) => ({
        nr:
          preserveScope === "nr"
            ? prev.nr
            : next.nr.rank > 0
              ? String(next.nr.rank)
              : "",
        cr:
          preserveScope === "cr"
            ? prev.cr
            : next.cr.rank > 0
              ? String(next.cr.rank)
              : "",
        wr:
          preserveScope === "wr"
            ? prev.wr
            : next.wr.rank > 0
              ? String(next.wr.rank)
              : "",
      }))
      setPercentDrafts((prev) => ({
        nr: preserveScope === "nr" ? prev.nr : formatPctDraft(next.nr.topPercent),
        cr: preserveScope === "cr" ? prev.cr : formatPctDraft(next.cr.topPercent),
        wr: preserveScope === "wr" ? prev.wr : formatPctDraft(next.wr.topPercent),
      }))
    },
    [previousBest],
  )

  const lookupPlayer = useCallback(async (overrideId?: string) => {
    const normalized = (overrideId ?? wcaId).trim().toUpperCase()
    if (!normalized) {
      setPlayerError("Please enter a WCA ID")
      return
    }
    setWcaId(normalized)
    setPlayerLoading(true)
    setPlayerError("")
    setPlayer(null)
    setIndex(null)
    setRanks(null)
    setHypotheticalBest(null)
    setResultDraft("")

    try {
      const transformed = await fetchWcaPerson(normalized)
      setPlayer(transformed)
      // Prefetch totals once
      fetchRankTotals()
        .then(setTotals)
        .catch(() => setTotals(null))
    } catch (err) {
      setPlayerError(err instanceof Error ? err.message : "Lookup failed")
    } finally {
      setPlayerLoading(false)
    }
  }, [wcaId])

  // Bootstrap from shareable query via window (avoids useSearchParams Suspense crash)
  useEffect(() => {
    if (bootstrappedRef.current) return
    bootstrappedRef.current = true
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const qWca = params.get("wca")?.trim().toUpperCase()
    const qEvent = params.get("event")?.trim()
    const qKind = params.get("kind")?.trim()
    const qBest = params.get("best")?.trim()

    if (qEvent && EVENT_IDS.includes(qEvent)) setEventId(qEvent)
    if (qKind === "single" || qKind === "average") setRankType(qKind)
    if (qBest && /^\d+$/.test(qBest)) {
      const n = Number(qBest)
      if (n > 0) pendingBestRef.current = n
    }
    if (qWca) {
      setWcaId(qWca)
      void lookupPlayer(qWca)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot URL bootstrap
  }, [])

  // Keep URL in sync for shareable state (after player is known)
  useEffect(() => {
    if (!player || typeof window === "undefined") return
    const params = new URLSearchParams()
    params.set("wca", player.wca_id)
    params.set("event", eventId)
    params.set("kind", rankType)
    if (hypotheticalBest !== null) params.set("best", String(hypotheticalBest))
    const next = `${window.location.pathname}?${params.toString()}`
    window.history.replaceState(null, "", next)
  }, [player, eventId, rankType, hypotheticalBest])

  // Load rank list when event/kind/player ready
  useEffect(() => {
    if (!player) return
    if (inputKind === "unsupported") {
      setIndex(null)
      setListError("Multi-blind is not supported in Goal yet.")
      return
    }

    let cancelled = false
    const controller = new AbortController()
    setListLoading(true)
    setListError("")
    setIndex(null)
    setRanks(null)

    ;(async () => {
      try {
        const [list, totalsDoc] = await Promise.all([
          fetchRankList(eventId, rankType, controller.signal),
          totals
            ? Promise.resolve(totals)
            : fetchRankTotals(controller.signal).catch(() => null),
        ])
        if (cancelled) return
        if (totalsDoc) setTotals(totalsDoc)
        setIndex(list)
        // Prefer URL ?best= once, else seed from current PB
        const fromUrl = pendingBestRef.current
        pendingBestRef.current = null
        const pb = player.personal_records[eventId]?.[rankType]?.best
        const seed = fromUrl && fromUrl > 0 ? fromUrl : pb && pb > 0 ? pb : null
        if (seed !== null) {
          const draft = formatResultInputValue(eventId, rankType, seed)
          setResultDraft(draft)
          driverRef.current = "result"
          applyBest(seed, list, totalsDoc, player, null)
        } else {
          setResultDraft("")
          setHypotheticalBest(null)
          setRanks(null)
        }
        // Warm nearby popular lists while the user is reading ranks
        prefetchRankLists(
          FEATURED.filter((id) => id !== eventId && resultInputKind(id, rankType) !== "unsupported")
            .slice(0, 4)
            .map((id) => ({ eventId: id, rankType })),
        )
      } catch (err) {
        if (cancelled) return
        // Abort from event switch / unmount is not a user-facing error
        if (err instanceof DOMException && err.name === "AbortError") return
        if (err instanceof Error && err.name === "AbortError") return
        setListError(
          err instanceof Error
            ? err.message
            : "Rank list unavailable. It may still be generating on the rank-data branch.",
        )
      } finally {
        if (!cancelled) setListLoading(false)
      }
    })()

    return () => {
      cancelled = true
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload on event/kind/player only
  }, [player, eventId, rankType, inputKind])

  const onResultDraftChange = (value: string) => {
    setResultDraft(value)
    driverRef.current = "result"
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const parsed = parseResultInput(eventId, rankType, value)
      applyBest(parsed, index, totals, player)
    }, 80)
  }

  const onTargetChange = (scope: RankScope, mode: "rank" | "percent", raw: string) => {
    const draft = mode === "percent" ? cleanPercentDraft(raw) : raw.replace(/[^\d]/g, "")
    if (mode === "rank") {
      setRankDrafts((prev) => ({ ...prev, [scope]: draft }))
    } else {
      setPercentDrafts((prev) => ({ ...prev, [scope]: draft }))
    }
    if (!index || !player) return
    driverRef.current = scope
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const trimmed = draft.trim()
      if (!trimmed || trimmed === ".") return
      const num = Number(trimmed)
      if (!Number.isFinite(num) || num <= 0) return
      const { requiredBest } = targetToRequiredBest(
        index,
        scope,
        mode,
        num,
        previousBest,
        player.country.iso2,
        player.country.continentId,
        totals,
      )
      if (requiredBest === null) return
      setResultDraft(formatResultInputValue(eventId, rankType, requiredBest))
      // Recompute all scopes; keep the field the user is typing intact.
      driverRef.current = scope
      applyBest(requiredBest, index, totals, player, scope)
    }, 80)
  }

  const availableEvents = useMemo(() => {
    const featured = FEATURED.filter((id) => EVENT_IDS.includes(id))
    const rest = EVENT_IDS.filter((id) => !FEATURED.includes(id))
    return [...featured, ...rest]
  }, [])

  const hasAverageForEvent = useMemo(() => {
    // Most events have average; FMC has average; MBLD typically single-only in ranks
    if (eventId === "333mbf" || eventId === "333mbo") return false
    return true
  }, [eventId])

  useEffect(() => {
    if (!hasAverageForEvent && rankType === "average") setRankType("single")
  }, [hasAverageForEvent, rankType])

  // Cancel any pending debounced compute on unmount (avoid setState-after-unmount).
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return (
    <div className="editorial-page flex min-h-[100dvh] flex-col">
      <div className="editorial-shell flex min-h-[100dvh] flex-col">
        <SiteHeader active="goal" />
        <main className="relative mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-8 sm:px-6 sm:pt-10 xl:max-w-[90rem] xl:px-8">
        {/* Theme cube — top right of Goal */}
        <FloatingThemeCube
          className={cn(
            "right-2 top-4 md:right-4 md:top-6",
            player ? "opacity-70 scale-90 origin-top-right" : "opacity-100",
          )}
        />
        {/* Opening: what Goal is + why cubers use it */}
        {!player && (
          <section className="relative mb-10 overflow-visible border-b border-border pb-10">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, ease }}
              className="relative z-[2] max-w-3xl pr-0 sm:pr-40 md:pr-52"
            >
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/70 px-3.5 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--blue-bright)]" />
                <span className="goal-chip text-[12px] uppercase tracking-[0.12em] text-[var(--blue-bright)]">
                  Goal · rank planner
                </span>
              </div>
              <h1 className="goal-display max-w-2xl text-[2.65rem] sm:text-5xl md:text-[3.5rem]">
                Know the result
                <br />
                before you chase it.
              </h1>
              <p className="goal-lead mt-6 max-w-xl text-[1.05rem] sm:text-lg">
                Goal turns a hypothetical official single or average into real{" "}
                <span className="font-bold text-white">NR, CR, and WR</span>
                {" "}and{" "}
                <span className="font-bold text-white">Top X%</span>
                {" "}so you can set training targets that mean something on the WCA ranking lists.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.06, ease }}
              className="mt-9 grid gap-3 sm:grid-cols-3"
            >
              <article className="surface-card rounded-xl p-5 sm:p-6">
                <p className="goal-step-label text-[var(--rank-nr)]">01 · Result → rank</p>
                <h2 className="goal-card-title mt-2.5 text-xl">
                  If I had this PB
                </h2>
                <p className="goal-card-body mt-2.5 text-[0.95rem]">
                  Type a solve time (or average). See what national, continental, and world rank
                  that result would sit at — not a guess, based on official export rankings.
                </p>
              </article>
              <article className="surface-card rounded-xl p-5 sm:p-6">
                <p className="goal-step-label text-[var(--rank-cr)]">02 · Rank → result</p>
                <h2 className="goal-card-title mt-2.5 text-xl">
                  What time for Top 1%?
                </h2>
                <p className="goal-card-body mt-2.5 text-[0.95rem]">
                  Set a target rank or Top % on NR, CR, or WR. Goal solves for the official result
                  you need to hit that band on the current export snapshot.
                </p>
              </article>
              <article className="surface-card rounded-xl p-5 sm:p-6">
                <p className="goal-step-label text-[var(--blue-bright)]">03 · Why WCA ID first</p>
                <h2 className="goal-card-title mt-2.5 text-xl">
                  Correct NR &amp; CR
                </h2>
                <p className="goal-card-body mt-2.5 text-[0.95rem]">
                  Your country and continent come from your official profile, so national and
                  continental ranks match where you actually compete — not a random region.
                </p>
              </article>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.12 }}
              className="mt-7 flex flex-wrap gap-2"
            >
              <span className="goal-chip rounded-full border border-border bg-secondary/50 px-3.5 py-1.5">
                Official WCA export
              </span>
              <span className="goal-chip rounded-full border border-border bg-secondary/50 px-3.5 py-1.5">
                Single &amp; average
              </span>
              <span className="goal-chip rounded-full border border-border bg-secondary/50 px-3.5 py-1.5">
                All ranked events
              </span>
              <span className="goal-chip rounded-full border border-border bg-secondary/50 px-3.5 py-1.5">
                No database · honest snapshot
              </span>
            </motion.div>
          </section>
        )}

        {player && (
          <div className="mb-8 max-w-2xl">
            <p className="goal-step-label text-[var(--blue-bright)]">Goal</p>
            <h1 className="goal-display mt-2 text-3xl sm:text-4xl">
              Plan your next official PB
            </h1>
            <p className="goal-lead mt-3 text-base">
              Hypothetical single or average → NR / CR / WR and Top %. Or set a target rank / % and
              see the result you need. Snapshot from the official WCA export — not a live page.
            </p>
          </div>
        )}

        {/* Step 1: WCA ID */}
        <section className="bezel mb-8">
          <div className="bezel-inner p-6 sm:p-8">
            <label className="eyebrow mb-4 block">
              {player ? "Competitor" : "Start with your WCA ID"}
            </label>
            {!player && (
              <p className="mb-4 max-w-lg text-sm leading-relaxed text-muted-foreground">
                We only use it to load your name, country, and continent so national and continental
                ranks are correct for you.
              </p>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <EditorialInput
                placeholder="2022RPRA01"
                value={wcaId}
                onChange={(e) => setWcaId(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && void lookupPlayer()}
                disabled={playerLoading}
                className="flex-1"
                autoFocus={!player}
              />
              <EditorialButton
                onClick={() => void lookupPlayer()}
                disabled={playerLoading}
                className="inline-flex h-12 items-center justify-center rounded-lg px-6"
              >
                {playerLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    {player ? "Reload" : "Continue"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </EditorialButton>
            </div>
            <AnimatePresence>
              {playerError && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mt-3 text-sm font-medium text-rose-400"
                >
                  {playerError}
                </motion.p>
              )}
            </AnimatePresence>

            {player && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ease, duration: 0.35 }}
                className="mt-6 flex items-center gap-4 border-t border-border pt-5"
              >
                {player.avatar?.url ? (
                  <img
                    src={player.avatar.url}
                    alt=""
                    className="cube-frame h-14 w-14 object-cover"
                  />
                ) : (
                  <div className="cube-frame flex h-14 w-14 items-center justify-center bg-secondary font-display text-xl font-bold">
                    {player.name.charAt(0)}
                  </div>
                )}
                <div>
                  <p className="font-display text-lg font-extrabold tracking-tight">{player.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {player.wca_id} · {player.country.name}
                    {player.continent ? ` · ${player.continent}` : ""}
                  </p>
                </div>
              </motion.div>
            )}
          </div>
        </section>

        {player && (
          <>
            {/* Event + kind */}
            <section className="mb-8">
              <p className="eyebrow mb-1">Step 2 · Event &amp; kind</p>
              <p className="mb-3 text-xs text-muted-foreground">
                Pick the event and whether you are planning a single or an official average PB.
              </p>
              <div className="mb-4 flex flex-wrap gap-2">
                {availableEvents.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setEventId(id)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors",
                      eventId === id
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {eventDisplayName(id)}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                {(["single", "average"] as RankType[]).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    disabled={kind === "average" && !hasAverageForEvent}
                    onClick={() => setRankType(kind)}
                    className={cn(
                      "rounded-lg px-4 py-2 text-sm font-semibold capitalize transition-colors",
                      rankType === kind
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground hover:text-foreground",
                      kind === "average" && !hasAverageForEvent && "cursor-not-allowed opacity-40",
                    )}
                  >
                    {kind}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {resultInputHint(eventId, rankType)}
              </p>
            </section>

            {listLoading && (
              <div className="mb-8 flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading official ranking snapshot for {eventDisplayName(eventId)} {rankType}…
              </div>
            )}

            {listError && (
              <p className="mb-8 text-sm font-medium text-rose-400">{listError}</p>
            )}

            {index && !listLoading && inputKind !== "unsupported" && (
              <section className="space-y-6">
                <div className="bezel">
                  <div className="bezel-inner p-6 sm:p-8">
                    <label className="eyebrow mb-2 block">
                      Step 3 · If my official {rankType} were
                    </label>
                    <p className="mb-3 max-w-xl text-xs leading-relaxed text-muted-foreground">
                      Enter a result as WCA stores it (e.g.{" "}
                      <span className="font-data text-foreground/80">8.50</span> or{" "}
                      <span className="font-data text-foreground/80">1:05.32</span>
                      ). Ranks update live. Or edit rank / Top % on a card below to solve for the
                      time you need.
                    </p>
                    <EditorialInput
                      placeholder={resultInputPlaceholder(eventId, rankType)}
                      value={resultDraft}
                      onChange={(e) => onResultDraftChange(e.target.value)}
                      className="mb-3 max-w-md text-lg"
                    />
                    <p className="text-xs text-muted-foreground">{resultInputHint(eventId, rankType)}</p>
                    {hypotheticalBest !== null && (
                      <p className="mt-3 text-sm text-muted-foreground">
                        Using{" "}
                        <span className="font-data text-foreground">
                          {formatResult(eventId, hypotheticalBest, rankType)}
                        </span>
                        {previousBest !== null && previousBest !== hypotheticalBest && (
                          <>
                            {" "}
                            · your current {rankType}:{" "}
                            <span className="font-data">
                              {formatResult(eventId, previousBest, rankType)}
                            </span>
                            {" "}
                            (we replace that PB so you are not double-counted)
                          </>
                        )}
                      </p>
                    )}
                    {resultDraft && hypotheticalBest === null && (
                      <p className="mt-2 text-sm text-rose-400">Could not parse that result</p>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <ScopeCard
                    scope="nr"
                    label="NR"
                    face="facelet-nr"
                    ranks={ranks}
                    rankDraft={rankDrafts.nr}
                    percentDraft={percentDrafts.nr}
                    onRankChange={(v) => onTargetChange("nr", "rank", v)}
                    onPercentChange={(v) => onTargetChange("nr", "percent", v)}
                  />
                  <ScopeCard
                    scope="cr"
                    label="CR"
                    face="facelet-cr"
                    ranks={ranks}
                    rankDraft={rankDrafts.cr}
                    percentDraft={percentDrafts.cr}
                    onRankChange={(v) => onTargetChange("cr", "rank", v)}
                    onPercentChange={(v) => onTargetChange("cr", "percent", v)}
                  />
                  <ScopeCard
                    scope="wr"
                    label="WR"
                    face="facelet-wr"
                    ranks={ranks}
                    rankDraft={rankDrafts.wr}
                    percentDraft={percentDrafts.wr}
                    onRankChange={(v) => onTargetChange("wr", "rank", v)}
                    onPercentChange={(v) => onTargetChange("wr", "percent", v)}
                  />
                </div>

                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Snapshot from WCA Results Export{" "}
                  {formatExportDate(index.source.exportDate)} · {index.count.toLocaleString()}{" "}
                  ranked {rankType} world
                  {totals ? "" : " · percentages unavailable if totals failed to load"} · not a live
                  WCA ranking page. Rank = 1 + people strictly faster; ties share a rank.
                </p>
              </section>
            )}
          </>
        )}
        </main>
        <SiteFooter />
      </div>
    </div>
  )
}
