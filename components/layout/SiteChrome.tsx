import Link from "next/link"
import { CubeWordmark } from "@/components/brand/CubeLogo"
import { cn } from "@/lib/utils"

export function SiteHeader({
  active,
}: {
  active?: "home" | "compare" | "goal" | "countries" | "settings"
}) {
  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-4 sm:pt-4">
      <div className="nav-island mx-auto flex h-14 max-w-7xl items-center justify-between rounded-full px-3 sm:px-5 xl:max-w-[90rem] xl:px-6">
        <Link href="/" className="group" aria-label="Cubify home">
          <CubeWordmark />
        </Link>
        <nav className="ml-3 flex min-w-0 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] sm:gap-1.5">
          <Link
            href="/"
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1.5 text-[12px] font-semibold transition-colors sm:px-3.5 sm:text-[13px]",
              active === "home"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Lookup
          </Link>
          <Link
            href="/goal"
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1.5 text-[12px] font-semibold transition-colors sm:px-3.5 sm:text-[13px]",
              active === "goal"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Goal
          </Link>
          <Link
            href="/compare"
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1.5 text-[12px] font-semibold transition-colors sm:px-3.5 sm:text-[13px]",
              active === "compare"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Compare
          </Link>
          <Link
            href="/countries"
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1.5 text-[12px] font-semibold transition-colors sm:px-3.5 sm:text-[13px]",
              active === "countries"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Countries
          </Link>
          <Link
            href="/settings"
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1.5 text-[12px] font-semibold transition-colors sm:px-3.5 sm:text-[13px]",
              active === "settings"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Settings
          </Link>
        </nav>
      </div>
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6 xl:max-w-[90rem] xl:px-8">
        <div className="flex items-center gap-3">
          <CubeWordmark />
          <span className="hidden h-3 w-px bg-border sm:block" />
          <p className="text-xs text-muted-foreground">
            Independent · data from the{" "}
            <a
              href="https://www.worldcubeassociation.org/"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              World Cube Association
            </a>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] font-data tracking-wide text-muted-foreground">
          <span className="inline-flex items-center gap-1.5" title="National Rank">
            <span className="facelet facelet-nr">NR</span>
            <span className="hidden sm:inline">National</span>
          </span>
          <span className="inline-flex items-center gap-1.5" title="Continental Rank">
            <span className="facelet facelet-cr">CR</span>
            <span className="hidden sm:inline">Continental</span>
          </span>
          <span className="inline-flex items-center gap-1.5" title="World Rank">
            <span className="facelet facelet-wr">WR</span>
            <span className="hidden sm:inline">World</span>
          </span>
        </div>
      </div>
    </footer>
  )
}
