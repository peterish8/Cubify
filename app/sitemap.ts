import type { MetadataRoute } from "next"

const origin = "https://cubify.in"

const pages = [
  "/",
  "/docs",
  "/docs/ai",
  "/docs/api",
  "/docs/api/lookup",
  "/docs/api/compare",
  "/docs/api/goal",
  "/docs/api/reports",
]

export default function sitemap(): MetadataRoute.Sitemap {
  return pages.map((path) => ({
    url: `${origin}${path}`,
    lastModified: new Date(),
  }))
}
