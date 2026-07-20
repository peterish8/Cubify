/**
 * Runs Next with NEXT_IGNORE_INCORRECT_LOCKFILE=1.
 *
 * Why: Next's find-up walks parent dirs for package-lock.json. On this machine
 * it hits C:\Users\nithy\package-lock.json, then tries to fetch SWC metadata
 * for next's version and crashes (SWC package versions don't match 1:1).
 * We use pnpm + pnpm-lock.yaml; that npm lockfile patch is irrelevant.
 *
 * Dev/start default port: 3008. If busy, try 3009, 3010, … unless -p/--port
 * (or PORT) is already set.
 */
const { spawn } = require("child_process")
const net = require("net")
const path = require("path")

process.env.NEXT_IGNORE_INCORRECT_LOCKFILE = "1"

const DEFAULT_PORT = 3008
const MAX_PORT_ATTEMPTS = 50

const args = process.argv.slice(2)
const command = args[0]
const nextBin = path.join(
  __dirname,
  "..",
  "node_modules",
  "next",
  "dist",
  "bin",
  "next",
)

function hasExplicitPort(argv) {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "-p" || a === "--port") return true
    if (typeof a === "string" && a.startsWith("--port=")) return true
  }
  return false
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.unref()
    server.once("error", () => resolve(false))
    server.listen(port, "0.0.0.0", () => {
      server.close((err) => resolve(!err))
    })
  })
}

async function findAvailablePort(startPort) {
  for (let i = 0; i < MAX_PORT_ATTEMPTS; i++) {
    const port = startPort + i
    if (await isPortFree(port)) return port
  }
  throw new Error(
    `No free port found in range ${startPort}–${startPort + MAX_PORT_ATTEMPTS - 1}`,
  )
}

function run(finalArgs) {
  const child = spawn(process.execPath, [nextBin, ...finalArgs], {
    stdio: "inherit",
    env: process.env,
    windowsHide: true,
  })

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal)
      return
    }
    process.exit(code ?? 0)
  })
}

async function main() {
  let finalArgs = args

  const shouldPickPort =
    (command === "dev" || command === "start") && !hasExplicitPort(args)

  if (shouldPickPort) {
    const preferred = Number(process.env.PORT) || DEFAULT_PORT
    if (!Number.isInteger(preferred) || preferred < 1 || preferred > 65535) {
      console.error(`Invalid PORT: ${process.env.PORT}`)
      process.exit(1)
    }

    const port = await findAvailablePort(preferred)
    if (port !== preferred) {
      console.log(`Port ${preferred} is in use — starting on ${port} instead`)
    }

    process.env.PORT = String(port)
    finalArgs = [...args, "-p", String(port)]
  }

  run(finalArgs)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
