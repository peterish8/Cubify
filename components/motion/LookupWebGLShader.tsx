"use client"

import { useEffect, useRef } from "react"
import { useCubifyTheme } from "@/components/theme/CubifyThemeProvider"

const vertexShader = `
attribute vec2 aPosition;

void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`

const fragmentShader = `
precision highp float;

uniform vec2 uResolution;
uniform vec2 uPointer;
uniform float uTime;
uniform float uRibs;
uniform vec3 uAccent;
uniform vec3 uBright;
uniform vec3 uSky;
uniform vec3 uDeep;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float bell(float x, float center, float width) {
  float d = (x - center) / width;
  return exp(-d * d);
}

// Columns of light standing on a domed horizon. Every column breathes on its own phase.
vec3 lightField(vec2 uv) {
  float t = uTime * 0.4;
  float aspect = uResolution.x / uResolution.y;

  float y = uv.y;
  y += (uPointer.y - 0.5) * 0.016 * (1.0 - y);
  float portrait = 1.0 - smoothstep(0.7, 1.3, aspect);
  float x = mix(uv.x, mix(0.22, 0.79, uv.x), portrait);
  x += (uPointer.x - 0.5) * 0.03;

  // The horizon rises toward the middle like a dome.
  float dome = 0.5 + 0.5 * cos((x - 0.5) * 3.14159265 * 1.1);
  y -= dome * 0.07;

  // Golden-ratio spacing keeps the columns from ever looking evenly stamped.
  float columns = 0.0;
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float center = fract(0.11 + fi * 0.618034) + 0.02 * sin(t * 0.5 + fi);
    float width = 0.045 + 0.055 * hash(vec2(fi, 3.0));
    float pulse = 0.62 + 0.38 * sin(t * (0.6 + 0.15 * fi) + fi * 1.9);
    columns += bell(x, center, width) * pulse;
  }

  float drift = bell(x, 0.5 + 0.18 * sin(t * 0.7), 0.42);
  float exposure = 0.5 + 0.9 * drift;
  float heightFade = pow(1.0 - smoothstep(0.04, 1.0, y), 1.05);
  float light = clamp((0.18 + columns * 0.55) * heightFade * exposure, 0.0, 1.0);

  // Colours come only from the theme.
  vec3 dark = uDeep * 0.05 + vec3(0.003, 0.006, 0.016);
  vec3 color = mix(dark, uAccent, smoothstep(0.06, 0.66, light));
  color = mix(color, uBright, smoothstep(0.40, 0.96, light));

  float poolHeight = 0.10 + 0.14 * dome + 0.05 * drift;
  float pool = 1.0 - smoothstep(poolHeight - 0.08, poolHeight + 0.20, y);
  color = mix(color, mix(uBright, uSky, 0.6), pool * 0.85);
  float core = 1.0 - smoothstep(-0.08, poolHeight * 0.6, y);
  color = mix(color, mix(uSky, vec3(1.0), 0.3), core);

  float halo = bell(uv.x, 0.5, 0.3) * bell(y, 0.5, 0.3);
  color += uDeep * 0.05 * halo;
  float vignette = smoothstep(0.0, 0.09, uv.x) * (1.0 - smoothstep(0.97, 1.08, uv.x));
  color *= 0.80 + 0.20 * vignette;
  return color;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;

  // Reeded glass: a prism ramp blended with a rounded bevel, so each flute leans and stays distinct.
  // The glass dissolves over the lower 40%, leaving the light down there smooth.
  float glass = smoothstep(0.02, 0.42, uv.y);
  float phase = fract(uv.x * uRibs);
  float ramp = phase - 0.5;
  float bevel = sin(ramp * 3.14159265);
  float lens = (0.55 * ramp + 0.225 * bevel) * 0.05 * glass;
  vec2 refracted = uv + vec2(lens, ramp * 0.012 * glass);
  vec3 color = lightField(refracted);

  // Colour fringing on the steep edges.
  float split = pow(abs(ramp) * 2.0, 3.0) * 0.002 * glass;
  color.r = lightField(refracted + vec2(split, 0.0)).r;
  color.b = lightField(refracted - vec2(split, 0.0)).b;

  // Dark bevel on the left of each flute, catch-light on the right, body brightening across it.
  float shade = exp(-pow((phase - 0.03) / 0.06, 2.0));
  float catchLight = exp(-pow((phase - 0.94) / 0.05, 2.0));
  float body = 0.9 + 0.2 * phase;
  color *= mix(1.0, body * (1.0 - 0.3 * shade), glass);
  float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color += mix(uSky, uBright, 0.5) * catchLight * (0.02 + luminance * 0.13) * glass;

  // Static grain that only lives in the light.
  float grain = hash(gl_FragCoord.xy) - 0.5;
  color += grain * 0.02 * (0.15 + smoothstep(0.02, 0.35, luminance));

  // A faint glow along the top edge gives the nav glass something to catch.
  color += uBright * 0.10 * smoothstep(0.86, 1.0, uv.y) * (0.6 + 0.4 * sin(uv.x * 3.0 + uTime * 0.36));

  gl_FragColor = vec4(color, 1.0);
}
`

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) return null

  gl.shaderSource(shader, source)
  gl.compileShader(shader)

  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader

  console.warn("[LookupWebGLShader] shader compile failed:", gl.getShaderInfoLog(shader))
  gl.deleteShader(shader)
  return null
}

function createProgram(gl: WebGLRenderingContext) {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexShader)
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShader)
  if (!vertex || !fragment) return null

  const program = gl.createProgram()
  if (!program) return null

  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  gl.deleteShader(vertex)
  gl.deleteShader(fragment)

  if (gl.getProgramParameter(program, gl.LINK_STATUS)) return program

  gl.deleteProgram(program)
  return null
}

function readThemeColor(value: string, fallback: readonly [number, number, number]) {
  const channels = value
    .split(",")
    .map((channel) => Number(channel.trim()))
    .filter((channel) => Number.isFinite(channel))

  if (channels.length !== 3) return new Float32Array(fallback.map((channel) => channel / 255))
  return new Float32Array(channels.map((channel) => Math.max(0, Math.min(255, channel)) / 255))
}

export function LookupWebGLShader() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { theme } = useCubifyTheme()
  const themeRef = useRef(theme)

  useEffect(() => {
    themeRef.current = theme
  }, [theme])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      powerPreference: "high-performance",
    })
    if (!gl) return

    const program = createProgram(gl)
    if (!program) return

    const buffer = gl.createBuffer()
    if (!buffer) {
      gl.deleteProgram(program)
      return
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)

    const position = gl.getAttribLocation(program, "aPosition")
    const uniforms = {
      resolution: gl.getUniformLocation(program, "uResolution"),
      pointer: gl.getUniformLocation(program, "uPointer"),
      time: gl.getUniformLocation(program, "uTime"),
      ribs: gl.getUniformLocation(program, "uRibs"),
      accent: gl.getUniformLocation(program, "uAccent"),
      bright: gl.getUniformLocation(program, "uBright"),
      sky: gl.getUniformLocation(program, "uSky"),
      deep: gl.getUniformLocation(program, "uDeep"),
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    const pointerTarget = { x: 0.5, y: 0.52 }
    const pointerCurrent = { ...pointerTarget }
    let isVisible = true
    let isDocumentVisible = !document.hidden
    let frame = 0
    let pixelRatio = 1
    let paletteTheme = ""
    let startedAt = performance.now()

    const updatePalette = () => {
      if (paletteTheme === themeRef.current) return

      paletteTheme = themeRef.current
      const styles = getComputedStyle(document.documentElement)
      gl.uniform3fv(uniforms.accent, readThemeColor(styles.getPropertyValue("--theme-rgb"), [59, 130, 246]))
      gl.uniform3fv(uniforms.bright, readThemeColor(styles.getPropertyValue("--theme-bright-rgb"), [96, 165, 250]))
      gl.uniform3fv(uniforms.sky, readThemeColor(styles.getPropertyValue("--theme-sky-rgb"), [56, 189, 248]))
      gl.uniform3fv(uniforms.deep, readThemeColor(styles.getPropertyValue("--theme-deep-rgb"), [29, 78, 216]))
    }

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const mobileQuality = window.innerWidth < 640
      pixelRatio = Math.min(window.devicePixelRatio || 1, mobileQuality ? 1.1 : 1.5)
      const width = Math.max(1, Math.round(rect.width * pixelRatio))
      const height = Math.max(1, Math.round(rect.height * pixelRatio))

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
        gl.viewport(0, 0, width, height)
      }
    }

    const draw = (timestamp: number) => {
      frame = 0
      resize()

      gl.useProgram(program)
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.enableVertexAttribArray(position)
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
      updatePalette()

      pointerCurrent.x += (pointerTarget.x - pointerCurrent.x) * 0.05
      pointerCurrent.y += (pointerTarget.y - pointerCurrent.y) * 0.05
      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height)
      gl.uniform2f(uniforms.pointer, pointerCurrent.x, pointerCurrent.y)
      gl.uniform1f(uniforms.ribs, canvas.clientWidth / Math.min(64, Math.max(30, canvas.clientWidth * 0.032)))
      gl.uniform1f(uniforms.time, reducedMotion.matches ? 1.6 : (timestamp - startedAt) / 1000)
      gl.drawArrays(gl.TRIANGLES, 0, 3)

      if (isVisible && isDocumentVisible && !reducedMotion.matches) {
        frame = requestAnimationFrame(draw)
      }
    }

    const schedule = () => {
      if (!frame && isVisible && isDocumentVisible) frame = requestAnimationFrame(draw)
    }

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      pointerTarget.x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
      pointerTarget.y = Math.max(0, Math.min(1, 1 - (event.clientY - rect.top) / rect.height))
    }

    const onVisibilityChange = () => {
      isDocumentVisible = !document.hidden
      if (isDocumentVisible) {
        startedAt = performance.now() - (reducedMotion.matches ? 1600 : 0)
        schedule()
      }
    }

    const onMotionChange = () => {
      cancelAnimationFrame(frame)
      frame = 0
      schedule()
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry?.isIntersecting ?? true
        if (isVisible) schedule()
        else if (frame) {
          cancelAnimationFrame(frame)
          frame = 0
        }
      },
      { threshold: 0.01 },
    )
    const resizeObserver = new ResizeObserver(schedule)

    observer.observe(canvas)
    resizeObserver.observe(canvas)
    window.addEventListener("pointermove", onPointerMove, { passive: true })
    document.addEventListener("visibilitychange", onVisibilityChange)
    reducedMotion.addEventListener("change", onMotionChange)
    canvas.classList.add("is-ready")
    schedule()

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      resizeObserver.disconnect()
      window.removeEventListener("pointermove", onPointerMove)
      document.removeEventListener("visibilitychange", onVisibilityChange)
      reducedMotion.removeEventListener("change", onMotionChange)
      gl.deleteBuffer(buffer)
      gl.deleteProgram(program)
    }
  }, [])

  return <canvas ref={canvasRef} className="lookup-webgl-canvas" aria-hidden="true" />
}
