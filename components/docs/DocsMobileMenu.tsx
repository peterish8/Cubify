"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { BookOpen, FileJson2, Info, Menu, Search, Scale, Target, Trophy, X } from "lucide-react"

const featureLinks = [
  { id: "lookup", label: "Lookup", href: "/docs/api/lookup", icon: Search },
  { id: "compare", label: "Compare", href: "/docs/api/compare", icon: Scale },
  { id: "goal", label: "Goal", href: "/docs/api/goal", icon: Target },
  { id: "reports", label: "Competition reports", href: "/docs/api/reports", icon: Trophy },
] as const

export function DocsMobileMenu({ active }: { active: "overview" | (typeof featureLinks)[number]["id"] }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  return (
    <>
      <button type="button" className="docs-mobile-menu-trigger pressable" aria-expanded={open} aria-controls="docs-mobile-drawer" onClick={() => setOpen(true)}>
        <Menu className="h-4 w-4" />
        <span>Documentation</span>
      </button>

      <div className={`docs-mobile-drawer ${open ? "is-open" : ""}`} aria-hidden={!open}>
        <button type="button" className="docs-mobile-drawer-backdrop" aria-label="Close documentation menu" tabIndex={open ? 0 : -1} onClick={() => setOpen(false)} />
        <aside id="docs-mobile-drawer" className="docs-mobile-drawer-panel" aria-label="Documentation navigation">
          <div className="docs-mobile-drawer-head">
            <div>
              <p className="docs-side-label">Product documentation</p>
              <p className="docs-mobile-drawer-title">Cubify API</p>
            </div>
            <button type="button" className="docs-mobile-drawer-close pressable" aria-label="Close documentation menu" tabIndex={open ? 0 : -1} onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </button>
          </div>

          <nav className="docs-mobile-drawer-nav">
            <Link href="/docs/api" tabIndex={open ? 0 : -1} className={active === "overview" ? "is-active" : ""} onClick={() => setOpen(false)}><BookOpen />Overview</Link>
            <p>Feature APIs</p>
            {featureLinks.map(({ id, label, href, icon: Icon }) => <Link key={id} href={href} tabIndex={open ? 0 : -1} className={active === id ? "is-active" : ""} onClick={() => setOpen(false)}><Icon />{label}</Link>)}
            <p>Artifacts</p>
            <a href="/openapi.json" tabIndex={open ? 0 : -1} onClick={() => setOpen(false)}><FileJson2 />OpenAPI JSON</a>
            <a href="/llms.txt" tabIndex={open ? 0 : -1} onClick={() => setOpen(false)}><Info />AI operating notes</a>
          </nav>

          <div className="docs-mobile-drawer-foot"><span className="h-1.5 w-1.5 rounded-full bg-[var(--rank-nr)]" /> V1 public beta<br /><small>Four callable WCA data routes.</small></div>
        </aside>
      </div>
    </>
  )
}
