"use client"

import { cn } from "@/lib/utils"

/**
 * Decorative isometric 3×3 cube for Goal (top-right).
 * Fills use CSS theme tokens so it tracks Cubify theme color.
 */
export function FloatingThemeCube({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute right-0 top-0 z-[1] select-none",
        "hidden sm:block",
        className,
      )}
      aria-hidden
    >
      <div className="floating-theme-cube relative h-[11rem] w-[11rem] md:h-[13.5rem] md:w-[13.5rem]">
        {/* Soft glow under the cube */}
        <div
          className="absolute left-1/2 top-[58%] h-16 w-28 -translate-x-1/2 rounded-full blur-2xl"
          style={{
            background: "radial-gradient(ellipse, rgba(var(--theme-rgb), 0.45), transparent 70%)",
          }}
        />
        <svg
          viewBox="0 0 200 220"
          className="relative h-full w-full drop-shadow-[0_20px_40px_rgba(0,0,0,0.55)]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="cubeTop" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgb(var(--theme-sky-rgb))" stopOpacity="0.95" />
              <stop offset="55%" stopColor="rgb(var(--theme-bright-rgb))" stopOpacity="0.9" />
              <stop offset="100%" stopColor="rgb(var(--theme-rgb))" stopOpacity="0.75" />
            </linearGradient>
            <linearGradient id="cubeLeft" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgb(var(--theme-rgb))" stopOpacity="0.72" />
              <stop offset="100%" stopColor="rgb(var(--theme-deep-rgb))" stopOpacity="0.95" />
            </linearGradient>
            <linearGradient id="cubeRight" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgb(var(--theme-bright-rgb))" stopOpacity="0.55" />
              <stop offset="100%" stopColor="rgb(var(--theme-deep-rgb))" stopOpacity="0.88" />
            </linearGradient>
          </defs>

          {/* --- Top face (diamond) with 3×3 stickers --- */}
          <g>
            <path d="M100 18 L176 62 L100 106 L24 62 Z" fill="url(#cubeTop)" />
            {/* sticker grid — dark + thick */}
            <path d="M49.3 47.3 L125.3 91.3" stroke="rgba(0,0,0,0.72)" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M74.7 32.7 L150.7 76.7" stroke="rgba(0,0,0,0.72)" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M49.3 76.7 L125.3 32.7" stroke="rgba(0,0,0,0.72)" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M74.7 91.3 L150.7 47.3" stroke="rgba(0,0,0,0.72)" strokeWidth="2.4" strokeLinecap="round" />
            <path
              d="M100 18 L176 62 L100 106 L24 62 Z"
              stroke="rgba(0,0,0,0.78)"
              strokeWidth="2.6"
              strokeLinejoin="round"
            />
          </g>

          {/* --- Left face --- */}
          <g>
            <path d="M24 62 L100 106 L100 194 L24 150 Z" fill="url(#cubeLeft)" />
            <path d="M49.3 76.7 L49.3 164.7" stroke="rgba(0,0,0,0.78)" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M74.7 91.3 L74.7 179.3" stroke="rgba(0,0,0,0.78)" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M24 91.3 L100 135.3" stroke="rgba(0,0,0,0.78)" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M24 120.7 L100 164.7" stroke="rgba(0,0,0,0.78)" strokeWidth="2.5" strokeLinecap="round" />
            <path
              d="M24 62 L100 106 L100 194 L24 150 Z"
              stroke="rgba(0,0,0,0.85)"
              strokeWidth="2.7"
              strokeLinejoin="round"
            />
          </g>

          {/* --- Right face --- */}
          <g>
            <path d="M100 106 L176 62 L176 150 L100 194 Z" fill="url(#cubeRight)" />
            <path d="M125.3 91.3 L125.3 179.3" stroke="rgba(0,0,0,0.78)" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M150.7 76.7 L150.7 164.7" stroke="rgba(0,0,0,0.78)" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M100 135.3 L176 91.3" stroke="rgba(0,0,0,0.78)" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M100 164.7 L176 120.7" stroke="rgba(0,0,0,0.78)" strokeWidth="2.5" strokeLinecap="round" />
            <path
              d="M100 106 L176 62 L176 150 L100 194 Z"
              stroke="rgba(0,0,0,0.85)"
              strokeWidth="2.7"
              strokeLinejoin="round"
            />
          </g>

          {/* Outer silhouette — heavier dark edge */}
          <path
            d="M100 18 L176 62 L176 150 L100 194 L24 150 L24 62 Z"
            stroke="rgba(0,0,0,0.9)"
            strokeWidth="2.8"
            strokeLinejoin="round"
            fill="none"
          />
          {/* Soft top ridge light (thin, so dark grid stays dominant) */}
          <path
            d="M24 62 L100 18 L176 62"
            stroke="rgba(255,255,255,0.22)"
            strokeWidth="1.2"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </div>
    </div>
  )
}
