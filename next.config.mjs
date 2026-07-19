// Only serialize the build workers on Windows, where multi-worker page-data
// collection races on the filesystem (ENOENT /_document, vendor-chunks, *.nft.json).
// On Vercel's Linux builders this workaround would needlessly slow the build.
const isWindows = process.platform === "win32"

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  eslint: {
    // Lint isn't a build gate yet; enforced separately in CI. Keep builds unblocked.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Type errors must fail the build. `tsc --noEmit` is clean; keep it that way.
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  ...(isWindows
    ? {
        experimental: {
          cpus: 1,
          workerThreads: false,
        },
      }
    : {}),
}

export default nextConfig
