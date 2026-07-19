/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Avoid flaky multi-worker page-data collection on Windows (ENOENT /_document, missing page modules).
  experimental: {
    cpus: 1,
    workerThreads: false,
  },
}

export default nextConfig
