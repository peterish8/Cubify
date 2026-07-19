import Link from "next/link"
import { SiteFooter, SiteHeader } from "@/components/layout/SiteChrome"

export default function NotFound() {
  return (
    <div className="editorial-page flex min-h-[100dvh] flex-col">
      <div className="editorial-shell flex min-h-[100dvh] flex-col">
        <SiteHeader />
        <main className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-4">
          <div className="bezel w-full max-w-md">
            <div className="bezel-inner p-8 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Error 404
              </p>
              <h1 className="font-display mt-2 text-4xl font-extrabold tracking-tight text-foreground">
                Page not found
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">
                That page doesn&apos;t exist. Check the address, or head back to the
                lookup.
              </p>
              <Link
                href="/"
                className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground"
              >
                Back to Cubify
              </Link>
            </div>
          </div>
        </main>
        <SiteFooter />
      </div>
    </div>
  )
}
