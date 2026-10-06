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

mat3 rotX(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c);
}

mat3 rotY(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c);
}

mat3 rotZ(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0);
}

vec3 rotAxis(vec3 p, vec3 axis, float a) {
  float c = cos(a);
  float s = sin(a);
  return p * c + cross(axis, p) * s + axis * dot(axis, p) * (1.0 - c);
}

// Separate, softly rounded glass pieces leave enough room for clean light-catching seams.
float piece(vec3 local, vec3 idx) {
  vec3 outward = abs(idx) * smoothstep(-0.3, 0.7, sign(idx) * local / 0.318);
  float r = mix(0.018, 0.085, smoothstep(0.5, 2.6, outward.x + outward.y + outward.z));
  vec3 q = abs(local) - vec3(0.318 - r);
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}

// The mechanism in the middle: a core ball with three axles, visible through the glass.
float coreDist(vec3 p) {
  float ball = length(p) - 0.27;
  float ax = max(length(p.yz) - 0.075, abs(p.x) - 0.8);
  float ay = max(length(p.xz) - 0.075, abs(p.y) - 0.8);
  float az = max(length(p.xy) - 0.075, abs(p.z) - 0.8);
  return min(ball, min(ax, min(ay, az)));
}

// The 3x3x3 of separate pieces. One outer layer (axis am, side "layer") is rotated by ang;
// the other pieces stay put. Each set is folded onto its nearest piece with a clamp.
// cp is the point expressed in the frame of whichever set is closer.
float cubeDist(vec3 p, vec3 am, float layer, float ang, out vec3 cp) {
  // A layer value beyond the cube selects the unturned 3x3x3 layout.
  // Without this path, layer=0 is interpreted as a real middle-layer turn
  // and the static set incorrectly loses the cubies on one side of the axis.
  if (abs(layer) > 1.5) {
    vec3 idx = clamp(floor(p * 1.5 + 0.5), -1.0, 1.0);
    cp = p;
    return piece(p - idx * 0.6666667, idx);
  }

  vec3 idxS = clamp(floor(p * 1.5 + 0.5), -1.0, 1.0);
  float lo = layer > 0.0 ? -1.0 : 0.0;
  float hi = layer > 0.0 ? 0.0 : 1.0;
  idxS += am * (clamp(dot(idxS, am), lo, hi) - dot(idxS, am));
  float dS = piece(p - idxS * 0.6666667, idxS);

  vec3 pr = rotAxis(p, am, -ang);
  vec3 idxL = clamp(floor(pr * 1.5 + 0.5), -1.0, 1.0);
  idxL += am * (layer - dot(idxL, am));
  float dL = piece(pr - idxL * 0.6666667, idxL);

  cp = dS < dL ? p : pr;
  return min(dS, dL);
}

vec2 cubeCenter() {
  float aspect = uResolution.x / uResolution.y;
  float portrait = 1.0 - smoothstep(0.7, 1.3, aspect);
  vec2 c = mix(vec2(0.27, 0.5), vec2(0.5, 0.7), portrait);
  c.y += 0.008 * sin(uTime * 0.5);
  return c;
}

// A complete 3x3 speedcube: separate rounded plastic cubies, black mechanism
// gaps, and stickerless colored plastic on each visible piece.
vec4 speedCube(vec2 uv) {
  float aspect = uResolution.x / uResolution.y;
  float portrait = 1.0 - smoothstep(0.7, 1.3, aspect);
  vec2 center = cubeCenter();
  float scale = mix(8.2, 10.0, portrait);
  vec2 q = (uv - center) * vec2(aspect, 1.0) * scale;

  // A visibly tilted, steady two-axis turn, with only a hint of pointer response.
  float yaw = uTime * 0.16 + 0.62 + (uPointer.x - 0.5) * 0.08;
  float pitch = -0.42 + 0.035 * sin(uTime * 0.18) + (uPointer.y - 0.5) * 0.035;
  float roll = 0.08 + 0.025 * sin(uTime * 0.14);
  mat3 R = rotZ(roll) * rotX(pitch) * rotY(yaw);

  vec3 rdWorld = normalize(vec3(q, 7.0));
  vec3 ro = vec3(0.0, 0.0, -7.0) * R;
  vec3 rd = rdWorld * R;

  // Clip the ray to the cube bounds, then trace the 27 rounded cubies.
  float bh = 1.0;
  vec3 invD = 1.0 / (rd + vec3(0.00001));
  vec3 ta = (vec3(-bh) - ro) * invD;
  vec3 tb = (vec3(bh) - ro) * invD;
  vec3 tmn = min(ta, tb);
  vec3 tmx = max(ta, tb);
  float t0 = max(max(tmn.x, tmn.y), tmn.z);
  float t1 = min(min(tmx.x, tmx.y), tmx.z);
  if (t1 < max(t0, 0.0)) return vec4(0.0);

  float t = max(t0, 0.0);
  vec3 p = vec3(0.0);
  bool hit = false;
  bool coreHit = false;
  for (int i = 0; i < 64; i++) {
    p = ro + rd * t;
    vec3 cp;
    float dPieces = cubeDist(p, vec3(0.0, 1.0, 0.0), 2.0, 0.0, cp);
    vec3 coreBox = abs(p) - vec3(0.91);
    float dCore = length(max(coreBox, 0.0)) + min(max(coreBox.x, max(coreBox.y, coreBox.z)), 0.0) - 0.022;
    float d = min(dPieces, dCore);
    if (d < 0.0015) {
      hit = true;
      coreHit = dCore < dPieces;
      break;
    }
    t += max(d, 0.0015);
    if (t > t1) break;
  }
  // The backing is black plastic, so the rounded gaps read as mechanism seams
  // instead of letting the animated backdrop shine through between pieces.
  if (!hit) return vec4(0.03, 0.052, 0.088, 1.0);
  if (coreHit) return vec4(0.03, 0.052, 0.088, 1.0);

  vec3 cp;
  cubeDist(p, vec3(0.0, 1.0, 0.0), 2.0, 0.0, cp);
  const float e = 0.002;
  vec3 n = normalize(vec3(
    cubeDist(p + vec3(e, 0.0, 0.0), vec3(0.0, 1.0, 0.0), 2.0, 0.0, cp) - cubeDist(p - vec3(e, 0.0, 0.0), vec3(0.0, 1.0, 0.0), 2.0, 0.0, cp),
    cubeDist(p + vec3(0.0, e, 0.0), vec3(0.0, 1.0, 0.0), 2.0, 0.0, cp) - cubeDist(p - vec3(0.0, e, 0.0), vec3(0.0, 1.0, 0.0), 2.0, 0.0, cp),
    cubeDist(p + vec3(0.0, 0.0, e), vec3(0.0, 1.0, 0.0), 2.0, 0.0, cp) - cubeDist(p - vec3(0.0, 0.0, e), vec3(0.0, 1.0, 0.0), 2.0, 0.0, cp)
  ));
  vec3 an = abs(n);
  float face;
  if (an.x >= an.y && an.x >= an.z) {
    face = n.x > 0.0 ? 0.0 : 1.0;
  } else if (an.y >= an.z) {
    face = n.y > 0.0 ? 2.0 : 3.0;
  } else {
    face = n.z > 0.0 ? 4.0 : 5.0;
  }

  // Monochrome stickerless speedcube palette: ice, cyan, and deep cobalt.
  vec3 faceColor = face < 0.5 ? vec3(0.10, 0.45, 0.84)
    : (face < 1.5 ? vec3(0.045, 0.20, 0.46)
    : (face < 2.5 ? vec3(0.52, 0.76, 0.94)
    : (face < 3.5 ? vec3(0.06, 0.15, 0.34)
    : (face < 4.5 ? vec3(0.16, 0.60, 0.90) : vec3(0.07, 0.31, 0.70)))));
  vec3 lightDir = normalize(vec3(-0.45, 0.78, -0.75));
  float diffuse = 0.74 + 0.26 * max(dot(n, lightDir), 0.0);
  float sheen = pow(max(dot(reflect(rd, n), lightDir), 0.0), 24.0) * 0.12;
  float faceFlatness = max(an.x, max(an.y, an.z));
  float faceSurface = smoothstep(0.72, 0.96, faceFlatness);
  vec3 plastic = mix(vec3(0.012, 0.035, 0.085), faceColor, faceSurface);
  float bevelGlow = 1.0 - faceSurface;
  vec3 color = plastic * diffuse + vec3(0.10, 0.18, 0.28) * sheen
    + vec3(0.012, 0.075, 0.18) * bevelGlow;
  return vec4(color, 1.0);
}

// Columns of light standing on a domed horizon. Every column breathes on its own phase.
vec3 lightField(vec2 uv) {
  float t = uTime * 0.85;
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
    float center = fract(0.11 + fi * 0.618034) + 0.045 * sin(t * 0.6 + fi * 1.3);
    float width = 0.045 + 0.055 * hash(vec2(fi, 3.0));
    float pulse = 0.62 + 0.38 * sin(t * (0.6 + 0.15 * fi) + fi * 1.9);
    columns += bell(x, center, width) * pulse;
  }

  float drift = bell(x, 0.5 + 0.3 * sin(t * 0.55), 0.42);
  float sweep = bell(x, 0.5 + 0.42 * sin(t * 0.38 + 1.7), 0.16);
  float exposure = 0.36 + 0.42 * drift + 0.24 * sweep;
  float heightFade = pow(1.0 - smoothstep(0.04, 1.0, y), 1.12);
  float light = clamp((0.14 + columns * 0.36) * heightFade * exposure, 0.0, 0.72);

  // Colours come only from the theme.
  vec3 dark = uDeep * 0.05 + vec3(0.003, 0.006, 0.016);
  vec3 color = mix(dark, uAccent, smoothstep(0.06, 0.66, light));
  color = mix(color, uBright, smoothstep(0.40, 0.96, light));

  float poolHeight = 0.10 + 0.14 * dome + 0.05 * drift + 0.035 * sin(t * 1.1 + x * 5.0);
  float pool = 1.0 - smoothstep(poolHeight - 0.08, poolHeight + 0.20, y);
  color = mix(color, mix(uBright, uSky, 0.55), pool * 0.42);
  float core = 1.0 - smoothstep(-0.08, poolHeight * 0.6, y);
  color = mix(color, mix(uSky, vec3(1.0), 0.08), core * 0.70);


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
  float lens = (0.55 * ramp + 0.225 * bevel) * 0.05 * glass * (1.0 + 0.22 * sin(uTime * 0.7 + floor(uv.x * uRibs) * 0.6));
  vec2 refracted = uv + vec2(lens, ramp * 0.012 * glass);

  vec3 color = lightField(refracted);

  // Dark bevel on the left of each flute, catch-light on the right, body brightening across it.
  float shade = exp(-pow((phase - 0.03) / 0.06, 2.0));
  float catchLight = exp(-pow((phase - 0.94) / 0.05, 2.0));
  float body = 0.9 + 0.2 * phase;
  color *= mix(1.0, body * (1.0 - 0.4 * shade), glass);
  float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
  vec3 rimColor = mix(uSky, vec3(1.0), 0.55);
  color += rimColor * catchLight * (0.03 + luminance * 0.16) * glass;

  // Static grain that only lives in the light.
  float grain = hash(gl_FragCoord.xy) - 0.5;
  color += grain * 0.011 * (0.15 + smoothstep(0.02, 0.35, luminance));

  // A faint glow along the top edge gives the nav glass something to catch.
  color += uBright * 0.10 * smoothstep(0.86, 1.0, uv.y) * (0.6 + 0.4 * sin(uv.x * 3.0 + uTime * 0.36));

  // Draw the original shader cube last and fully opaque. The animated light
  // field remains around it but cannot leak through the rotating faces.
  vec4 cube = speedCube(uv);
  color = mix(color, cube.rgb, cube.a);

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
      antialias: true,
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
    let quality = 1
    let lastTimestamp = 0
    let averageFrame = 16
    let framesSinceAdjust = 0
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
      pixelRatio = Math.min(window.devicePixelRatio || 1, mobileQuality ? 1 : 1.25) * quality
      // The scene is soft light, so a modest pixel budget looks the same and stays smooth.
      const pixels = rect.width * rect.height * pixelRatio * pixelRatio
      if (pixels > 1100000) pixelRatio *= Math.sqrt(1100000 / pixels)
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

      // Hold a steady frame rate: step the resolution down when frames run long, and back up when there is headroom.
      const frameTime = timestamp - lastTimestamp
      lastTimestamp = timestamp
      if (frameTime > 0 && frameTime < 250) {
        averageFrame = averageFrame * 0.9 + frameTime * 0.1
        framesSinceAdjust += 1
        if (framesSinceAdjust >= 20) {
          framesSinceAdjust = 0
          if (averageFrame > 26 && quality > 0.4) quality = Math.max(0.4, quality * 0.82)
          else if (averageFrame < 15 && quality < 1) quality = Math.min(1, quality * 1.08)
        }
      }
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
