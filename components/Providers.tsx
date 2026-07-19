"use client"

import { SmoothScroll } from "@/components/motion/SmoothScroll"
import { CustomCursor } from "@/components/motion/CustomCursor"
import { GlassSheen } from "@/components/motion/GlassSheen"
import { CubifyThemeProvider } from "@/components/theme/CubifyThemeProvider"

/** Client experience layer: smooth-scroll + custom cursor + reactive glass sheen. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CubifyThemeProvider>
      <SmoothScroll>
        {children}
        <GlassSheen />
        <CustomCursor />
      </SmoothScroll>
    </CubifyThemeProvider>
  )
}
