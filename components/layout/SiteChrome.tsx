import Link from "next/link"
import { CubeWordmark } from "@/components/brand/CubeLogo"
import { cn } from "@/lib/utils"
import { SiteNav, type NavKey } from "@/components/layout/SiteNav"
import { FooterCube } from "@/components/layout/FooterCube"

export function SiteHeader({
  active,
  embedded,
}: {
  active?: NavKey
  embedded?: boolean
}) {
  return (
    <header className={cn(embedded ? "relative z-20 px-3 pt-3 sm:px-5 sm:pt-5" : "sticky top-0 z-40 px-3 pt-3 sm:px-4 sm:pt-4")}>
      <SiteNav active={active} embedded={embedded} />
    </header>
  )
}

const FOOTER_LINKS = [
  { href: "/", label: "Lookup" },
  { href: "/goal", label: "Goal" },
  { href: "/compare", label: "Compare" },
  { href: "/countries", label: "Countries" },
  { href: "/settings", label: "Settings" },
  { href: "/docs", label: "Docs" },
] as const

export function SiteFooter() {
  return (
    <footer className="site-footer mx-3 mb-3 mt-20 sm:mx-4 sm:mb-4">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 pb-12 pt-14 sm:px-10 md:grid-cols-[1.5fr_1fr_1fr] xl:max-w-[90rem] xl:px-14 xl:pt-20">
        <div>
          <CubeWordmark className="[&>span:last-child]:text-xl" />
          <p className="font-display mt-7 max-w-md text-3xl font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-4xl">
            Your WCA rank, finally with meaning.
          </p>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Independent project. All results come from the{" "}
            <a
              href="https://www.worldcubeassociation.org/"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-foreground underline underline-offset-4 hover:text-[var(--blue-bright)]"
            >
              World Cube Association
            </a>
            .
          </p>
        </div>

        <nav aria-label="Footer">
          <p className="site-footer__label">Explore</p>
          <ul className="mt-6 grid gap-3.5">
            {FOOTER_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="site-footer__link">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <p className="site-footer__label">Rank key</p>
          <ul className="mt-6 grid gap-4">
            <li className="flex items-center gap-3.5">
              <span className="facelet facelet-lg facelet-nr">NR</span>
              <span className="text-lg font-bold text-foreground">National</span>
            </li>
            <li className="flex items-center gap-3.5">
              <span className="facelet facelet-lg facelet-cr">CR</span>
              <span className="text-lg font-bold text-foreground">Continental</span>
            </li>
            <li className="flex items-center gap-3.5">
              <span className="facelet facelet-lg facelet-wr">WR</span>
              <span className="text-lg font-bold text-foreground">World</span>
            </li>
          </ul>
        </div>
      </div>

      <FooterCube />
    </footer>
  )
}
