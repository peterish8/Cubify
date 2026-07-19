/**
 * Cross-platform unit test runner.
 * npm scripts pass globs literally on some shells, so CI needs concrete files.
 */
const { spawnSync } = require("child_process")
const fs = require("fs")
const path = require("path")

const testsDir = path.join(__dirname, "..", "tests")
const files = fs
  .readdirSync(testsDir)
  .filter((name) => name.endsWith(".test.ts"))
  .map((name) => path.join(testsDir, name))
  .sort()

if (files.length === 0) {
  console.error("No tests/*.test.ts files found")
  process.exit(1)
}

const tsxCli = require.resolve("tsx/cli")
const result = spawnSync(process.execPath, [tsxCli, "--test", ...files], {
  stdio: "inherit",
  env: process.env,
  windowsHide: true,
})

process.exit(result.status ?? 1)
