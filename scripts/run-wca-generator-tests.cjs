const { spawnSync } = require("node:child_process")

const result = spawnSync(
  process.platform === "win32" ? "python.exe" : "python",
  ["-m", "unittest", "discover", "-s", "tests", "-v"],
  {
    cwd: "tools/wca-rank-totals",
    env: {
      ...process.env,
      PYTHONPATH: "src",
    },
    stdio: "inherit",
  },
)

if (result.error) {
  console.error(result.error.message)
  process.exit(1)
}

process.exit(result.status ?? 1)
