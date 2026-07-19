"use client"

import { motion, type Variants } from "framer-motion"
import { cn } from "@/lib/utils"

/*
  Scroll-reveal primitives.
  Robust against the classic "stuck invisible" trap: we animate opacity/transform
  only, trigger with whileInView + once, and fall back to visible when reduced-motion
  is on (Framer skips the initial hidden state, so content is never trapped at 0).
*/

const ease = [0.22, 1, 0.36, 1] as const

export function Reveal({
  children,
  className,
  delay = 0,
  y = 16,
  once = true,
  ...props
}: {
  children: React.ReactNode
  className?: string
  delay?: number
  y?: number
  once?: boolean
} & React.ComponentProps<typeof motion.div>) {
  return (
    <motion.div
      className={cn(className)}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount: 0.2 }}
      transition={{ duration: 0.6, ease, delay }}
      {...props}
    >
      {children}
    </motion.div>
  )
}

const containerVariants: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.07, delayChildren: 0.05 },
  },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease } },
}

export function Stagger({
  children,
  className,
  once = true,
}: {
  children: React.ReactNode
  className?: string
  stagger?: number
  once?: boolean
}) {
  return (
    <motion.div
      className={cn(className)}
      variants={containerVariants}
      initial="hidden"
      whileInView="show"
      viewport={{ once, amount: 0.15 }}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
  y?: number
}) {
  return (
    <motion.div variants={itemVariants} className={cn("h-full", className)}>
      {children}
    </motion.div>
  )
}
