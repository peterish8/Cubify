"use client"

import { SmoothScroll } from "@/components/motion/SmoothScroll"
import { CustomCursor } from "@/components/motion/CustomCursor"
import { CubifyThemeProvider } from "@/components/theme/CubifyThemeProvider"

/** Client experience layer: optional smooth-scroll + custom cursor. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CubifyThemeProvider>
      <SmoothScroll>
        {children}
        <CustomCursor />
      </SmoothScroll>
    </CubifyThemeProvider>
  )
}
