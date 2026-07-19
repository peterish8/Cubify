"use client"

import { useEffect } from "react"
import Link from "next/link"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="editorial-page flex min-h-[100dvh] flex-col">
      <div className="editorial-shell flex min-h-[100dvh] flex-1 items-center justify-center px-4">
        <div className="bezel w-full max-w-md">
          <div className="bezel-inner p-8 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--rank-wr,#ef4444)]">
              Something broke
            </p>
            <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight text-foreground">
              Unexpected error
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              A part of Cubify failed to load. This is usually temporary — data comes
              live from the WCA API and GitHub, so it can hiccup.
            </p>
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                onClick={reset}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground"
              >
                Try again
              </button>
              <Link
                href="/"
                className="btn-ghost inline-flex h-11 items-center justify-center rounded-lg px-5 text-sm"
              >
                Go home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
