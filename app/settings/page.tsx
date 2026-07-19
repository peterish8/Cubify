"use client"

import { motion } from "framer-motion"
import { Check, Palette } from "lucide-react"
import { SiteFooter, SiteHeader } from "@/components/layout/SiteChrome"
import { CUBIFY_THEMES, useCubifyTheme } from "@/components/theme/CubifyThemeProvider"
import { cn } from "@/lib/utils"

const ease = [0.16, 1, 0.3, 1] as const

export default function SettingsPage() {
  const { theme: activeTheme, setTheme } = useCubifyTheme()
  const selected = CUBIFY_THEMES.find((theme) => theme.id === activeTheme) ?? CUBIFY_THEMES[0]

  return (
    <div className="editorial-page flex min-h-[100dvh] flex-col">
      <div className="editorial-shell flex min-h-[100dvh] flex-col">
        <SiteHeader active="settings" />

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
          <section className="grid gap-8 border-b border-border pb-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease }}
            >
              <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[rgba(var(--theme-bright-rgb),0.28)] bg-[rgba(var(--theme-rgb),0.1)] text-[var(--blue-bright)] shadow-[0_0_28px_-16px_rgba(var(--theme-rgb),0.9)]">
                <Palette className="h-5 w-5" />
              </div>
              <h1 className="display-title text-[3rem] text-foreground sm:text-6xl md:text-7xl">
                Settings.
              </h1>
              <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
                Pick the glow Cubify opens with. Your theme is saved on this browser.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.06, ease }}
              className="bezel"
            >
              <div className="bezel-inner p-5 sm:p-6">
                <p className="eyebrow">Current theme</p>
                <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">{selected.name}</h2>
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

          <section className="py-10">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <p className="eyebrow">Theme library</p>
                <h2 className="mt-2 text-2xl font-bold text-foreground">Choose your color system</h2>
              </div>
              <p className="hidden text-right text-xs text-muted-foreground sm:block">
                Stored in local storage
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {CUBIFY_THEMES.map((theme, index) => {
                const active = theme.id === activeTheme
                return (
                  <motion.button
                    key={theme.id}
                    type="button"
                    onClick={() => setTheme(theme.id)}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: Math.min(index * 0.035, 0.18), ease }}
                    className={cn(
                      "surface-card surface-card-hover group min-h-48 rounded-lg p-4 text-left transition",
                      active &&
                        "border-[rgba(var(--theme-bright-rgb),0.5)] shadow-[0_0_0_1px_rgba(var(--theme-rgb),0.2),0_24px_70px_-34px_rgba(var(--theme-rgb),0.95)]",
                    )}
                  >
                    <div className="relative z-10 flex h-full flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex gap-1.5">
                          {theme.swatches.map((color) => (
                            <span
                              key={color}
                              className="h-8 w-5 rounded-md border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
                              style={{ background: color }}
                            />
                          ))}
                        </div>
                        <span
                          className={cn(
                            "inline-flex h-7 w-7 items-center justify-center rounded-full border transition",
                            active
                              ? "border-[rgba(var(--theme-bright-rgb),0.5)] bg-primary text-primary-foreground"
                              : "border-border bg-secondary/40 text-transparent group-hover:text-muted-foreground",
                          )}
                        >
                          <Check className="h-4 w-4" />
                        </span>
                      </div>

                      <div className="mt-auto pt-8">
                        <h3 className="text-lg font-bold text-foreground">{theme.name}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                          {theme.description}
                        </p>
                      </div>
                    </div>
                  </motion.button>
                )
              })}
            </div>
          </section>
        </main>

        <SiteFooter />
      </div>
    </div>
  )
}
