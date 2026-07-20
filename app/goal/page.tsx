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
  calculateTopPercent,
  fetchRankTotals,
  formatTopPercent,
  getScopedTotals,
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
  current,
  ranks,
  target,
  onRankChange,
  onPercentChange,
  disabled,
}: {
  scope: RankScope
  label: string
  face: string
  current: ScopeCurrent | null
  ranks: AllScopeRanks | null
  target: TargetGoal
  onRankChange: (value: string) => void
  onPercentChange: (value: string) => void
  disabled?: boolean
}) {
  const result = ranks?.[scope]
  const pct = result ? formatTopPercent(result.topPercent) : null
  const currentPct = current ? formatTopPercent(current.topPercent) : null

  return (
    <div className="surface-card rounded-xl p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`facelet ${face}`}>{label}</span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {scope === "nr" ? "National" : scope === "cr" ? "Continental" : "World"}
          </span>
        </div>
        {current && current.rank > 0 && (
          <span className="stat-num text-lg text-foreground">#{current.rank.toLocaleString()}</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-border bg-secondary/45 px-3 py-2.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Rank
          </span>
          <p className="mt-1 font-data text-lg font-bold text-foreground">
            {current && current.rank > 0 ? `#${current.rank.toLocaleString()}` : "-"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-secondary/45 px-3 py-2.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Current Top %
          </span>
          <p className="mt-1 font-data text-lg font-bold text-foreground">{currentPct ?? "-"}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-4">
        <label className="space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Desired Rank
          </span>
          <EditorialInput
            inputMode="numeric"
            placeholder="#"
            value={target.rankDraft}
            disabled={disabled}
            onChange={(e) => onRankChange(e.target.value)}
            className="h-10 text-sm"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Desired Top %
          </span>
          <EditorialInput
            inputMode="decimal"
            placeholder="1.5"
            value={target.percentDraft}
            disabled={disabled}
            onChange={(e) => onPercentChange(e.target.value)}
            className="h-10 text-sm"
          />
        </label>
      </div>

      {target.requiredBest !== null && (
        <div className="mt-3 rounded-lg border border-[rgba(var(--theme-bright-rgb),0.22)] bg-[rgba(var(--theme-rgb),0.08)] px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Needed result
          </p>
          <p className="mt-1 font-data text-base font-bold text-foreground">
            {target.formattedBest}
          </p>
          {target.targetRank !== null && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Around #{target.targetRank.toLocaleString()} {scope.toUpperCase()}
            </p>
          )}
        </div>
      )}
      {result && result.tiesWith > 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Tied with {result.tiesWith.toLocaleString()} other
          {result.tiesWith === 1 ? "" : "s"} at this result
        </p>
      )}
    </div>
  )
}

type ScopeCurrent = {
  rank: number
  topPercent: number | null
}

type TargetGoal = {
  rankDraft: string
  percentDraft: string
  requiredBest: number | null
  targetRank: number | null
  formattedBest: string
}

const emptyTargets: Record<RankScope, TargetGoal> = {
  nr: { rankDraft: "", percentDraft: "", requiredBest: null, targetRank: null, formattedBest: "" },
  cr: { rankDraft: "", percentDraft: "", requiredBest: null, targetRank: null, formattedBest: "" },
  wr: { rankDraft: "", percentDraft: "", requiredBest: null, targetRank: null, formattedBest: "" },
}

function scopeName(scope: RankScope): string {
  if (scope === "nr") return "National"
  if (scope === "cr") return "Continental"
  return "World"
}

function trimNumberDraft(value: string): string {
  return value.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1")
}

function formatTargetPercentDraft(value: number | null): string {
  if (value === null) return ""
  return trimNumberDraft(value.toFixed(value < 1 ? 2 : 1))
}

function getOfficialScopeStats(
  player: PlayerInfo | null,
  eventId: string,
  rankType: RankType,
  totalsDoc: RankTotalsDocument | null,
): Record<RankScope, ScopeCurrent | null> {
  const record = player?.personal_records[eventId]?.[rankType]
  if (!player || !record) return { nr: null, cr: null, wr: null }

  const scoped = totalsDoc
    ? getScopedTotals(
        totalsDoc,
        eventId,
        rankType,
        player.country.continentId,
        player.country.iso2,
      )
    : { world: null, continent: null, country: null }

  return {
    nr: {
      rank: record.national_ranking,
      topPercent: calculateTopPercent(record.national_ranking, scoped.country),
    },
    cr: {
      rank: record.continental_ranking,
      topPercent: calculateTopPercent(record.continental_ranking, scoped.continent),
    },
    wr: {
      rank: record.world_ranking,
      topPercent: calculateTopPercent(record.world_ranking, scoped.world),
    },
  }
}

function goalsFromRanks(
  ranks: AllScopeRanks,
  eventId: string,
  rankType: RankType,
  meta?: { scope: RankScope; requiredBest: number | null; targetRank: number | null },
): Record<RankScope, TargetGoal> {
  const makeGoal = (scope: RankScope): TargetGoal => {
    const result = ranks[scope]
    const isTarget = meta?.scope === scope
    return {
      rankDraft: result.rank > 0 ? String(result.rank) : "",
      percentDraft: formatTargetPercentDraft(result.topPercent),
      requiredBest: isTarget ? meta.requiredBest : null,
      targetRank: isTarget ? meta.targetRank : null,
      formattedBest:
        isTarget && meta.requiredBest !== null
          ? formatResult(eventId, meta.requiredBest, rankType)
          : "",
    }
  }

  return {
    nr: makeGoal("nr"),
    cr: makeGoal("cr"),
    wr: makeGoal("wr"),
  }
}

function formatTargetGap(
  eventId: string,
  rankType: RankType,
  currentBest: number | null,
  requiredBest: number | null,
): { label: string; tone: "need" | "already" | "even" } | null {
  if (currentBest === null || requiredBest === null) return null

  const diff = currentBest - requiredBest
  if (diff === 0) return { label: "This result is exactly on target.", tone: "even" }

  const unit = resultInputKind(eventId, rankType)
  if (unit === "time") {
    const seconds = Math.abs(diff) / 100
    return diff > 0
      ? { label: `${seconds.toFixed(2)}s faster needed`, tone: "need" }
      : { label: `${seconds.toFixed(2)}s inside target already`, tone: "already" }
  }

  if (unit === "fmc-single") {
    const moves = Math.abs(diff)
    return diff > 0
      ? { label: `${moves} move${moves === 1 ? "" : "s"} fewer needed`, tone: "need" }
      : { label: `${moves} move${moves === 1 ? "" : "s"} inside target already`, tone: "already" }
  }

  if (unit === "fmc-average") {
    const moves = Math.abs(diff) / 100
    return diff > 0
      ? { label: `${moves.toFixed(2)} moves fewer needed`, tone: "need" }
      : { label: `${moves.toFixed(2)} moves inside target already`, tone: "already" }
  }

  return null
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
  const [targetGoals, setTargetGoals] = useState<Record<RankScope, TargetGoal>>(emptyTargets)
  const [activeTargetScope, setActiveTargetScope] = useState<RankScope | null>(null)

  const resultDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const targetDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  const applyBest = useCallback(
    (
      best: number | null,
      list: RankListIndex | null,
      totalsDoc: RankTotalsDocument | null,
      p: PlayerInfo | null,
      targetMeta?: { scope: RankScope; requiredBest: number | null; targetRank: number | null },
    ) => {
      setHypotheticalBest(best)
      if (best === null || !list || !p) {
        setRanks(null)
        setTargetGoals(emptyTargets)
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
      setTargetGoals(goalsFromRanks(next, list.eventId, list.rankType, targetMeta))
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
    setTargetGoals(emptyTargets)
    setActiveTargetScope(null)
    setHypotheticalBest(null)
    setResultDraft("")
    setTargetGoals(emptyTargets)
    setActiveTargetScope(null)

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
          applyBest(seed, list, totalsDoc, player)
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
    setActiveTargetScope(null)
    if (resultDebounceRef.current) clearTimeout(resultDebounceRef.current)
    resultDebounceRef.current = setTimeout(() => {
      const parsed = parseResultInput(eventId, rankType, value)
      applyBest(parsed, index, totals, player)
    }, 80)
  }

  const onTargetPercentChange = (scope: RankScope, raw: string) => {
    const draft = cleanPercentDraft(raw)
    setActiveTargetScope(scope)
    setTargetGoals((prev) => ({
      ...prev,
      [scope]: {
        ...prev[scope],
        percentDraft: draft,
        requiredBest: null,
        targetRank: null,
        formattedBest: "",
      },
    }))
    if (!index || !player) return
    if (targetDebounceRef.current) clearTimeout(targetDebounceRef.current)
    targetDebounceRef.current = setTimeout(() => {
      const trimmed = draft.trim()
      if (!trimmed || trimmed === ".") return
      const num = Number(trimmed)
      if (!Number.isFinite(num) || num <= 0) return
      const { requiredBest, targetRank } = targetToRequiredBest(
        index,
        scope,
        "percent",
        num,
        previousBest,
        player.country.iso2,
        player.country.continentId,
        totals,
      )
      setTargetGoals((prev) => ({
        ...prev,
        [scope]: {
          ...prev[scope],
          percentDraft: draft,
          rankDraft: targetRank !== null ? String(targetRank) : "",
          requiredBest,
          targetRank,
          formattedBest:
            requiredBest !== null ? formatResult(eventId, requiredBest, rankType) : "",
        },
      }))
      if (requiredBest !== null) {
        setResultDraft(formatResultInputValue(eventId, rankType, requiredBest))
        applyBest(requiredBest, index, totals, player, { scope, requiredBest, targetRank })
      }
    }, 80)
  }

  const onTargetRankChange = (scope: RankScope, raw: string) => {
    const draft = raw.replace(/[^\d]/g, "")
    setActiveTargetScope(scope)
    setTargetGoals((prev) => ({
      ...prev,
      [scope]: {
        ...prev[scope],
        rankDraft: draft,
        requiredBest: null,
        targetRank: null,
        formattedBest: "",
      },
    }))
    if (!index || !player) return
    if (targetDebounceRef.current) clearTimeout(targetDebounceRef.current)
    targetDebounceRef.current = setTimeout(() => {
      const trimmed = draft.trim()
      if (!trimmed) return
      const num = Number(trimmed)
      if (!Number.isInteger(num) || num <= 0) return
      const { requiredBest, targetRank } = targetToRequiredBest(
        index,
        scope,
        "rank",
        num,
        previousBest,
        player.country.iso2,
        player.country.continentId,
        totals,
      )
      const afterRanks =
        requiredBest !== null
          ? resultToAllScopeRanks(
              index,
              requiredBest,
              previousBest,
              player.country.iso2,
              player.country.continentId,
              totals,
            )
          : null
      if (requiredBest !== null) {
        setResultDraft(formatResultInputValue(eventId, rankType, requiredBest))
        setRanks(afterRanks)
        if (afterRanks) {
          setTargetGoals(
            goalsFromRanks(afterRanks, eventId, rankType, { scope, requiredBest, targetRank }),
          )
        }
        setHypotheticalBest(requiredBest)
      } else {
        setTargetGoals((prev) => ({
          ...prev,
          [scope]: {
            ...prev[scope],
            rankDraft: draft,
            percentDraft: "",
            requiredBest: null,
            targetRank: null,
            formattedBest: "",
          },
        }))
      }
    }, 80)
  }

  const activeTarget =
    activeTargetScope &&
    (targetGoals[activeTargetScope].rankDraft || targetGoals[activeTargetScope].percentDraft)
      ? targetGoals[activeTargetScope]
      : null
  const activeTargetGap =
    activeTargetScope && activeTarget
      ? formatTargetGap(eventId, rankType, previousBest ?? hypotheticalBest, activeTarget.requiredBest)
      : null
  const officialScopeStats = useMemo(
    () => getOfficialScopeStats(player, eventId, rankType, totals),
    [player, eventId, rankType, totals],
  )

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
      if (resultDebounceRef.current) clearTimeout(resultDebounceRef.current)
      if (targetDebounceRef.current) clearTimeout(targetDebounceRef.current)
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
                <p className="goal-step-label text-[var(--rank-cr)]">02 · Top % → result</p>
                <h2 className="goal-card-title mt-2.5 text-xl">
                  What time for Top 1%?
                </h2>
                <p className="goal-card-body mt-2.5 text-[0.95rem]">
                  Set a target Top % on NR, CR, or WR. Goal solves for the official result
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
              Hypothetical single or average → NR / CR / WR and Top %. Or set a target Top % and
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
                  <div className="bezel-inner grid gap-5 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-stretch">
                    <div>
                      <label className="eyebrow mb-2 block">
                        Step 3 · If my official {rankType} were
                      </label>
                      <p className="mb-3 max-w-xl text-xs leading-relaxed text-muted-foreground">
                        Enter a result as WCA stores it (e.g.{" "}
                        <span className="font-data text-foreground/80">8.50</span> or{" "}
                        <span className="font-data text-foreground/80">1:05.32</span>
                        ). Top boxes stay on the cuber's current WCA stats. Bottom inputs translate
                        this result into rank + Top %, and can also solve back to the time.
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

                    <div className="rounded-xl border border-[rgba(var(--theme-bright-rgb),0.24)] bg-[radial-gradient(circle_at_25%_20%,rgba(var(--theme-bright-rgb),0.14),transparent_32%),rgba(5,9,18,0.72)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                        Desired gap
                      </p>
                      {activeTargetScope && activeTarget ? (
                        <div className="mt-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-bold text-foreground">
                              {scopeName(activeTargetScope)} target
                            </span>
                            <span className="rounded-full border border-border bg-secondary/60 px-2.5 py-1 font-data text-xs text-foreground">
                              {activeTarget.percentDraft
                                ? `Top ${activeTarget.percentDraft}%`
                                : `#${activeTarget.rankDraft}`}
                            </span>
                          </div>
                          {activeTarget.requiredBest !== null ? (
                            <>
                              <p className="mt-4 text-xs text-muted-foreground">Required official result</p>
                              <p className="mt-1 font-data text-3xl font-extrabold text-foreground">
                                {activeTarget.formattedBest}
                              </p>
                              {activeTargetGap && (
                                <p
                                  className={cn(
                                    "mt-3 rounded-lg border px-3 py-2 text-sm font-bold",
                                    activeTargetGap.tone === "need"
                                      ? "border-[rgba(var(--theme-bright-rgb),0.34)] bg-[rgba(var(--theme-rgb),0.12)] text-[rgb(var(--theme-bright-rgb))]"
                                      : "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
                                  )}
                                >
                                  {activeTargetGap.label}
                                </p>
                              )}
                              {activeTarget.targetRank !== null && (
                                <p className="mt-3 text-xs text-muted-foreground">
                                  Target rank: #{activeTarget.targetRank.toLocaleString()}{" "}
                                  {activeTargetScope.toUpperCase()}
                                </p>
                              )}
                            </>
                          ) : (
                            <p className="mt-4 text-sm leading-relaxed text-rose-300">
                              That target is outside the available ranked list for this scope.
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                          Type a desired Top % in NR, CR, or WR below. This panel will show the
                          exact result and the seconds you need to close.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <ScopeCard
                    scope="nr"
                    label="NR"
                    face="facelet-nr"
                    current={officialScopeStats.nr}
                    ranks={ranks}
                    target={targetGoals.nr}
                    onRankChange={(v) => onTargetRankChange("nr", v)}
                    onPercentChange={(v) => onTargetPercentChange("nr", v)}
                  />
                  <ScopeCard
                    scope="cr"
                    label="CR"
                    face="facelet-cr"
                    current={officialScopeStats.cr}
                    ranks={ranks}
                    target={targetGoals.cr}
                    onRankChange={(v) => onTargetRankChange("cr", v)}
                    onPercentChange={(v) => onTargetPercentChange("cr", v)}
                  />
                  <ScopeCard
                    scope="wr"
                    label="WR"
                    face="facelet-wr"
                    current={officialScopeStats.wr}
                    ranks={ranks}
                    target={targetGoals.wr}
                    onRankChange={(v) => onTargetRankChange("wr", v)}
                    onPercentChange={(v) => onTargetPercentChange("wr", v)}
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
