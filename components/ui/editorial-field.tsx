import * as React from "react"
import { cn } from "@/lib/utils"

/** Native controls that do not fight shadcn default utility stacks. */
export const EditorialInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input">
>(function EditorialInput({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn("input-editorial", className)}
      {...props}
    />
  )
})

export function EditorialButton({
  className,
  children,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <button type="button" className={cn("btn-solid", className)} {...props}>
      {children}
    </button>
  )
}
