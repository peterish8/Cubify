"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { useState } from "react"
import { CubeWordmark } from "@/components/brand/CubeLogo"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { key: "home", href: "/", label: "Lookup" },
  { key: "goal", href: "/goal", label: "Goal" },
  { key: "compare", href: "/compare", label: "Compare" },
  { key: "countries", href: "/countries", label: "Countries" },
  { key: "settings", href: "/settings", label: "Settings" },
  { key: "docs", href: "/docs", label: "Docs" },
] as const

export type NavKey = (typeof NAV_ITEMS)[number]["key"]

export function SiteNav({ active, embedded }: { active?: NavKey; embedded?: boolean }) {
  const [hovered, setHovered] = useState<NavKey | null>(null)
  // The underline rests on the current page and follows the pointer while it is over the nav.
  const underlineOn = hovered ?? active

  return (
    <motion.div
      className={cn(
        "mx-auto flex max-w-7xl items-center justify-between xl:max-w-[90rem]",
        embedded
          ? "nav-bar h-16 px-3 sm:px-5 xl:px-6"
          : "nav-island h-14 rounded-full px-3 sm:px-5 xl:px-6",
      )}
      initial={embedded ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link href="/" className="group relative z-10" aria-label="Cubify home">
        <CubeWordmark />
      </Link>
      <nav
        className="relative z-10 ml-3 flex min-w-0 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] sm:gap-1.5"
        onMouseLeave={() => setHovered(null)}
      >
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.key

          return (
            <Link
              key={item.key}
              href={item.href}
              onMouseEnter={() => setHovered(item.key)}
              onFocus={() => setHovered(item.key)}
              onBlur={() => setHovered(null)}
              className={cn(
                "relative shrink-0 px-2.5 py-2 text-[12px] font-medium transition-colors sm:px-3.5 sm:text-[13px]",
                embedded
                  ? isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                  : cn(
                      "pressable rounded-full py-1.5 font-semibold",
                      isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                    ),
              )}
            >
              {embedded && underlineOn === item.key && (
                <motion.span
                  layoutId="nav-underline"
                  className="nav-underline"
                  aria-hidden="true"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
              <span className="relative z-10">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </motion.div>
  )
}
