"use client"

import { motion, type HTMLMotionProps } from "framer-motion"
import { cn } from "@/lib/utils"

interface RevealProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode
  className?: string
  delay?: number
  y?: number
  /** Kept for API compat — mount animation is always used so content never stays hidden */
  once?: boolean
}

const spring = { type: "spring" as const, stiffness: 140, damping: 24, mass: 0.7 }

/**
 * Fade/slide in on mount. Uses `animate` (not whileInView) so content is never
 * stuck at opacity 0 when IntersectionObserver / Lenis / SSR races.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 16,
  once: _once,
  ...props
}: RevealProps) {
  return (
    <motion.div
      className={cn(className)}
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay }}
      {...props}
    >
      {children}
    </motion.div>
  )
}

export function Stagger({
  children,
  className,
  stagger = 0.07,
}: {
  children: React.ReactNode
  className?: string
  stagger?: number
}) {
  return (
    <motion.div
      className={cn(className)}
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: stagger } },
      }}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({
  children,
  className,
  y = 16,
}: {
  children: React.ReactNode
  className?: string
  y?: number
}) {
  return (
    <motion.div
      className={cn("h-full", className)}
      variants={{
        hidden: { opacity: 0, y },
        show: { opacity: 1, y: 0, transition: spring },
      }}
    >
      {children}
    </motion.div>
  )
}
