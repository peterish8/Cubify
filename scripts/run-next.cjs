/**
 * Runs Next with NEXT_IGNORE_INCORRECT_LOCKFILE=1.
 *
 * Why: Next's find-up walks parent dirs for package-lock.json. On this machine
 * it hits C:\Users\nithy\package-lock.json, then tries to fetch SWC metadata
 * for next's version and crashes (SWC package versions don't match 1:1).
 * We use pnpm + pnpm-lock.yaml; that npm lockfile patch is irrelevant.
 */
const { spawn } = require("child_process")
const path = require("path")

process.env.NEXT_IGNORE_INCORRECT_LOCKFILE = "1"

const args = process.argv.slice(2)
const nextBin = path.join(
  __dirname,
  "..",
  "node_modules",
  "next",
  "dist",
  "bin",
  "next",
)

const child = spawn(process.execPath, [nextBin, ...args], {
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
