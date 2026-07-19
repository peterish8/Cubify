/**
 * Starts a Next dev server for Playwright in an isolated dist directory.
 *
 * This keeps e2e tests from racing with a developer server that is already
 * using .next on another port.
 */
const { spawn } = require("child_process")
const fs = require("fs")
const path = require("path")

const port = process.argv[2] || process.env.E2E_PORT || "3101"
const distDir = process.env.NEXT_DIST_DIR || ".next-e2e"
const projectRoot = path.join(__dirname, "..")

process.env.NEXT_DIST_DIR = distDir

fs.rmSync(path.join(projectRoot, distDir), {
  recursive: true,
  force: true,
})

const child = spawn(
  process.execPath,
  [path.join(__dirname, "run-next.cjs"), "dev", "-p", port],
  {
    cwd: projectRoot,
    stdio: "inherit",
    env: process.env,
    windowsHide: true,
  },
)

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 0)
})
