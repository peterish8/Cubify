"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Check, MousePointer2, Palette, ScrollText } from "lucide-react"
import { SiteFooter, SiteHeader } from "@/components/layout/SiteChrome"
import { useCubifyTheme } from "@/components/theme/CubifyThemeProvider"
import {
  THEME_FAMILIES,
  getFamilyForTheme,
  getThemeById,
  type CubifyThemeId,
  type CubifyThemeVariant,
} from "@/lib/cubify-themes"
import { cn } from "@/lib/utils"

/** Smooth open/close — no spring bounce */
const smooth = { duration: 0.38, ease: [0.22, 1, 0.36, 1] as const }
const smoothExit = { duration: 0.28, ease: [0.4, 0, 1, 1] as const }

/**
 * Left · center · right fan — wide spread so side cards stay fully visible
 * (percentages relative to card width via x transform after centering).
 */
const FAN = [
  { x: "-165%", y: "-105%", rotate: -10, z: 2 },
  { x: "-50%", y: "-132%", rotate: 0, z: 4 },
  { x: "65%", y: "-105%", rotate: 10, z: 3 },
] as const

function PrefToggle({
  on,
  onToggle,
}: {
  on: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className={cn(
        "relative h-9 w-[3.75rem] shrink-0 rounded-full border transition",
        on
          ? "border-[rgba(var(--theme-bright-rgb),0.5)] bg-[rgba(var(--theme-rgb),0.35)]"
          : "border-border bg-secondary",
      )}
    >
      <span
        className={cn(
          "absolute top-1 left-1 h-7 w-7 rounded-full bg-white shadow transition-transform",
          on && "translate-x-[1.65rem]",
        )}
        aria-hidden
      />
    </button>
  )
}

function ShadeCard({
  variant,
  active,
  fan,
  index,
  onPick,
}: {
  variant: CubifyThemeVariant
  active: boolean
  fan: (typeof FAN)[number]
  index: number
  onPick: () => void
}) {
  return (
    <motion.button
      type="button"
      initial={{
        opacity: 0,
        left: "50%",
        top: "42%",
        x: "-50%",
        y: "-20%",
        scale: 0.35,
        rotate: 0,
      }}
      animate={{
        opacity: 1,
        left: "50%",
        top: "42%",
        x: fan.x,
        y: fan.y,
        scale: 1,
        rotate: fan.rotate,
      }}
      exit={{
        opacity: 0,
        left: "50%",
        top: "42%",
        x: "-50%",
        y: "-10%",
        scale: 0.4,
        rotate: 0,
        transition: { ...smoothExit, delay: (2 - index) * 0.04 },
      }}
      transition={{
        ...smooth,
        delay: index * 0.055,
      }}
      style={{
        zIndex: fan.z,
        position: "absolute",
        width: "5.75rem",
        height: "7rem",
        transformOrigin: "center center",
      }}
      data-testid={`theme-${variant.id}`}
      onClick={(e) => {
        e.stopPropagation()
        onPick()
      }}
      className={cn(
        /* Fixed box so all 3 fan cards match (no content-driven shrink) */
        "box-border h-full w-full shrink-0 rounded-xl border p-2.5",
        "shadow-[0_16px_32px_-10px_rgba(0,0,0,0.9)]",
        active
          ? "border-[rgba(var(--theme-bright-rgb),0.75)] bg-[#0c101c] ring-2 ring-[rgba(var(--theme-rgb),0.45)]"
          : "border-white/25 bg-[#0a0d16] hover:border-white/45 hover:bg-[#101522]",
      )}
    >
      {/* Mini swatch strip */}
      <div className="flex h-7 w-full shrink-0 overflow-hidden rounded-lg border border-black/50 sm:h-8">
        {variant.swatches.map((color) => (
          <span key={color} className="h-full min-w-0 flex-1" style={{ background: color }} />
        ))}
      </div>

      <p className="mt-1.5 shrink-0 text-center text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--blue-bright)]">
        {variant.shadeLabel}
      </p>
      <p className="mt-0.5 line-clamp-2 min-h-[2rem] text-center text-[11px] font-bold leading-tight text-white sm:min-h-[2.25rem] sm:text-xs">
        {variant.name}
      </p>

      {active && (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-white/20 bg-white text-black shadow-lg">
          <Check className="h-3 w-3 stroke-[2.5]" />
        </span>
      )}
    </motion.button>
  )
}

export default function SettingsPage() {
  const {
    theme: activeTheme,
    setTheme,
    customCursor,
    setCustomCursor,
    smoothScroll,
    setSmoothScroll,
  } = useCubifyTheme()
  const selected = getThemeById(activeTheme)
  const activeFamily = getFamilyForTheme(activeTheme)

  const [openFamily, setOpenFamily] = useState<string>("")

  return (
    <div className="editorial-page flex min-h-[100dvh] flex-col">
      <div className="editorial-shell flex min-h-[100dvh] flex-col">
        <SiteHeader active="settings" />

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 sm:py-14 xl:max-w-[90rem] xl:px-8">
          <section className="grid gap-8 border-b border-border pb-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={smooth}
            >
              <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[rgba(var(--theme-bright-rgb),0.28)] bg-[rgba(var(--theme-rgb),0.1)] text-[var(--blue-bright)] shadow-[0_0_28px_-16px_rgba(var(--theme-rgb),0.9)]">
                <Palette className="h-5 w-5" />
              </div>
              <h1 className="display-title text-[3rem] text-foreground sm:text-6xl md:text-7xl">
                Settings.
              </h1>
              <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
                Open a folder — the lid lifts and three shades fan out. Pick pastel, classic, or
                deep. Cursor & smooth scroll default off.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...smooth, delay: 0.06 }}
              className="bezel"
            >
              <div className="bezel-inner p-5 sm:p-6">
                <p className="eyebrow">Current theme</p>
                <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {activeFamily.name} · {selected.shadeLabel}
                    </p>
                    <h2 className="mt-1 text-2xl font-bold text-foreground">{selected.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{selected.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {selected.swatches.map((color) => (
                      <span
                        key={color}
                        className="h-9 w-9 rounded-lg border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
                        style={{ background: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </section>

          {/* Folder fan picker */}
          <section className="border-b border-border py-10">
            <div className="mb-8">
              <p className="eyebrow">Theme library</p>
              <h2 className="mt-2 text-2xl font-bold text-foreground">Color folders</h2>
              <p className="mt-1.5 max-w-lg text-sm text-muted-foreground">
                Tap a folder to open it. Shades rise out smoothly — left, center, right.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-44 pt-36 sm:grid-cols-3 sm:gap-x-10 sm:gap-y-48 lg:grid-cols-4 lg:gap-x-12 lg:gap-y-52">
              {THEME_FAMILIES.map((family, index) => {
                const isOpen = openFamily === family.id
                const familyActive = family.variants.some((v) => v.id === activeTheme)
                const toggleFamily = () => setOpenFamily((current) => (current === family.id ? "" : family.id))

                return (
                  <motion.div
                    key={family.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...smooth, delay: Math.min(index * 0.035, 0.18) }}
                    className={cn(
                      "relative flex flex-col items-center",
                      isOpen && "z-40",
                    )}
                  >
                    {/* Cards stage (above folder) */}
                    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 h-0">
                      <div className="pointer-events-auto relative mx-auto h-0 w-full max-w-[11rem]">
                        <AnimatePresence mode="sync">
                          {isOpen &&
                            family.variants.slice(0, 3).map((variant, vIndex) => (
                              <ShadeCard
                                key={variant.id}
                                variant={variant}
                                active={variant.id === activeTheme}
                                fan={FAN[vIndex] ?? FAN[1]}
                                index={vIndex}
                                onPick={() => setTheme(variant.id as CubifyThemeId)}
                              />
                            ))}
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* Folder unit */}
                    <div
                      className={cn(
                        "relative w-full max-w-[11rem] transition-transform duration-300 ease-out",
                        isOpen && "-translate-y-1 scale-[1.02]",
                      )}
                      style={{ perspective: 900 }}
                    >
                      {/* Interior pocket (visible when open) */}
                      <div
                        className="absolute inset-x-[6%] bottom-[18%] top-[22%] rounded-xl border"
                        style={{
                          background: `linear-gradient(180deg, #05070c, ${family.preview}22 120%)`,
                          borderColor: `${family.preview}35`,
                          boxShadow: "inset 0 10px 24px rgba(0,0,0,0.65)",
                        }}
                      />

                      {/* Tab */}
                      <div
                        className="absolute left-[10%] top-0 z-[1] h-3.5 w-[40%] rounded-t-md border border-b-0"
                        style={{
                          background: `linear-gradient(180deg, ${family.preview}, ${family.preview}66)`,
                          borderColor: `${family.preview}66`,
                        }}
                      />

                      {/* Back wall of folder */}
                      <div
                        className="absolute inset-x-0 top-2 bottom-0 rounded-2xl border"
                        style={{
                          background: `linear-gradient(165deg, ${family.preview}40, #080b12 70%)`,
                          borderColor: `${family.preview}45`,
                        }}
                      />

                      {/* Front lid — hinges open downward when active */}
                      <motion.button
                        type="button"
                        data-testid={`theme-family-folder-${family.id}`}
                        aria-label={`${isOpen ? "Close" : "Open"} ${family.name} theme shades`}
                        aria-expanded={isOpen}
                        onPointerUp={toggleFamily}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault()
                            toggleFamily()
                          }
                        }}
                        className="relative z-[5] mt-2 block w-full origin-bottom outline-none"
                        animate={{
                          rotateX: isOpen ? 52 : 0,
                        }}
                        transition={smooth}
                        style={{
                          transformStyle: "preserve-3d",
                        }}
                      >
                        <div
                          className={cn(
                            "relative aspect-[1.2/1] overflow-hidden rounded-2xl border",
                            isOpen && "shadow-[0_12px_28px_-8px_rgba(0,0,0,0.7)]",
                          )}
                          style={{
                            background: `linear-gradient(160deg, ${family.preview} 0%, ${family.preview}cc 18%, ${family.preview}55 42%, #0a0d14 78%)`,
                            borderColor: familyActive
                              ? `rgba(var(--theme-bright-rgb), 0.55)`
                              : `${family.preview}60`,
                            backfaceVisibility: "hidden",
                          }}
                        >
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-black/30" />

                          {/* Peeking stubs only when closed */}
                          <AnimatePresence>
                            {!isOpen && (
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0, transition: smoothExit }}
                                className="absolute inset-x-0 top-3 flex justify-center gap-1.5"
                              >
                                {family.variants.slice(0, 3).map((v, i) => (
                                  <span
                                    key={v.id}
                                    className="h-9 w-7 rounded-md border border-black/35 shadow-md sm:h-10 sm:w-8"
                                    style={{
                                      background: `linear-gradient(180deg, ${v.swatches[1]}, ${v.swatches[2]})`,
                                      transform: `rotate(${(i - 1) * 7}deg) translateY(${i === 1 ? -5 : 2}px)`,
                                    }}
                                  />
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </motion.button>

                      {/* Clear name plate — always readable, never under gradient mess */}
                      <button
                        type="button"
                        data-testid={`theme-family-${family.id}`}
                        onPointerUp={toggleFamily}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault()
                            toggleFamily()
                          }
                        }}
                        className="relative z-[6] mt-2.5 w-full rounded-xl border border-white/10 bg-[#0b0e16]/95 px-3 py-2.5 text-left shadow-lg backdrop-blur-sm"
                      >
                        {/* Fixed-height plate so Active / open label never shove Motion prefs down */}
                        <div className="flex min-h-[2.75rem] items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-[15px] font-bold tracking-tight text-white">
                              {family.name}
                            </p>
                            <p className="mt-0.5 h-3.5 truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55">
                              {isOpen ? "Pick a shade" : `${family.variants.length} shades`}
                            </p>
                          </div>
                          {/* Always occupy badge slot — invisible when not active (no layout jump) */}
                          <span
                            className={cn(
                              "shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                              familyActive
                                ? "border-[rgba(var(--theme-bright-rgb),0.4)] bg-[rgba(var(--theme-rgb),0.2)] text-[var(--blue-bright)]"
                                : "invisible border-transparent",
                            )}
                            aria-hidden={!familyActive}
                          >
                            Active
                          </span>
                        </div>
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </section>

          <section className="py-10">
            <div className="mb-5">
              <p className="eyebrow">Experience</p>
              <h2 className="mt-2 text-2xl font-bold text-foreground">Motion & pointer</h2>
              <p className="mt-1.5 max-w-lg text-sm text-muted-foreground">
                Both default to off. Enable only if you want the custom pointer or smoother scroll.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="bezel">
                <div className="bezel-inner flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[rgba(var(--theme-bright-rgb),0.28)] bg-[rgba(var(--theme-rgb),0.1)] text-[var(--blue-bright)]">
                      <MousePointer2 className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="text-base font-bold text-foreground">Custom cursor</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {customCursor
                          ? "On — Cubify’s small themed cursor."
                          : "Off — your normal system cursor."}
                      </p>
                    </div>
                  </div>
                  <PrefToggle
                    on={customCursor}
                    onToggle={() => setCustomCursor(!customCursor)}
                  />
                </div>
              </div>

              <div className="bezel">
                <div className="bezel-inner flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[rgba(var(--theme-bright-rgb),0.28)] bg-[rgba(var(--theme-rgb),0.1)] text-[var(--blue-bright)]">
                      <ScrollText className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="text-base font-bold text-foreground">Smooth scroll</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {smoothScroll
                          ? "On — buttery wheel / trackpad flow."
                          : "Off — native browser scrolling."}
                      </p>
                    </div>
                  </div>
                  <PrefToggle
                    on={smoothScroll}
                    onToggle={() => setSmoothScroll(!smoothScroll)}
                  />
                </div>
              </div>
            </div>
          </section>
        </main>

        <SiteFooter />
      </div>
    </div>
  )
}
