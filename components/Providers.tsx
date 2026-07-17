"use client"

import { SmoothScroll } from "@/components/motion/SmoothScroll"
import { CustomCursor } from "@/components/motion/CustomCursor"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SmoothScroll>
      <CustomCursor />
      {children}
    </SmoothScroll>
  )
}
