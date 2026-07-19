import { cn } from "@/lib/utils"

/** Isometric cube mark: WR (top) · NR (left) · CR (right) */
export function CubeLogo({
  className,
  size = 28,
}: {
  className?: string
  size?: number
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      {/* Top face — WR silver */}
      <path d="M16 3L28 10L16 17L4 10L16 3Z" fill="#E8E8EC" />
      {/* Left face — NR emerald */}
      <path d="M4 10L16 17V29L4 22V10Z" fill="#3DFFA8" />
      {/* Right face — CR amber */}
      <path d="M16 17L28 10V22L16 29V17Z" fill="#FFC14A" />
      {/* Edge hairlines */}
      <path
        d="M16 3L28 10L16 17L4 10L16 3Z M4 10L16 17V29L4 22V10Z M16 17L28 10V22L16 29V17Z"
        stroke="#050506"
        strokeWidth="0.6"
        strokeLinejoin="round"
        opacity="0.25"
      />
    </svg>
  )
}

export function CubeWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <CubeLogo size={26} />
      <span className="font-display text-[15px] font-extrabold tracking-[-0.03em]">Cubify</span>
    </span>
  )
}
