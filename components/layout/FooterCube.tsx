"use client"

import { useEffect, useRef } from "react"

// Three faces of an isometric cube. Each is a 3x3 sheet of glass stickers; the
// CSS sheers each sheet into place, so the frosted backdrop blur is real.
const FACES = [
  { name: "top", delay: (i: number, j: number) => (i + j) * 0.22 },
  { name: "left", delay: (i: number, j: number) => 0.6 + (i + j) * 0.22 },
  { name: "right", delay: (i: number, j: number) => 0.9 + (i + j) * 0.22 },
] as const

export function FooterCube() {
  const ref = useRef<HTMLDivElement>(null)

  // Only animate while the footer is on screen; the frosted faces are costly to repaint.
  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(([entry]) => {
      el.dataset.paused = entry?.isIntersecting ? "false" : "true"
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const onMove = (event: PointerEvent) => {
      el.style.setProperty("--px", ((event.clientX / window.innerWidth) * 2 - 1).toFixed(3))
      el.style.setProperty("--py", ((event.clientY / window.innerHeight) * 2 - 1).toFixed(3))
    }

    window.addEventListener("pointermove", onMove, { passive: true })
    return () => window.removeEventListener("pointermove", onMove)
  }, [])

  return (
    <div ref={ref} className="site-footer__cube" aria-hidden="true">
      <div className="cube-stage">
        <div className="cube-lights">
          <div className="cube-blob cube-blob--a"><span /></div>
          <div className="cube-blob cube-blob--b"><span /></div>
          <div className="cube-blob cube-blob--c"><span /></div>
        </div>

        {FACES.map((face) => (
          <div key={face.name} className={`cube-face cube-face--${face.name}`}>
            {[0, 1, 2].flatMap((i) =>
              [0, 1, 2].map((j) => (
                <i
                  key={`${i}-${j}`}
                  className="cube-sticker"
                  data-v={(i * 3 + j * 5 + face.name.length) % 4}
                  style={{ animationDelay: `${face.delay(i, j).toFixed(2)}s` }}
                />
              )),
            )}
          </div>
        ))}
      </div>

      <div className="cube-wordmark">Cubify</div>
    </div>
  )
}
