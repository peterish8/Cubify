import type React from "react"
import type { Metadata } from "next"
import { Space_Grotesk } from "next/font/google"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import { Providers } from "@/components/Providers"
import { ALL_THEME_IDS, DEFAULT_THEME, THEME_STORAGE_KEY } from "@/lib/cubify-themes"
import "./globals.css"

/** Site display face — cinematic tech (replaces Syne site-wide). */
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
  weight: ["500", "600", "700"],
})

export const metadata: Metadata = {
  title: "Cubify - WCA Stats Analyzer",
  description:
    "Analyze your speedcubing statistics and see where you rank nationally, continentally, and worldwide.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`dark ${GeistSans.variable} ${GeistMono.variable} ${spaceGrotesk.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem(${JSON.stringify(
              THEME_STORAGE_KEY,
            )});var ok=${JSON.stringify(
              ALL_THEME_IDS,
            )}.includes(t);document.documentElement.dataset.cubifyTheme=ok?t:${JSON.stringify(
              DEFAULT_THEME,
            )}}catch(e){document.documentElement.dataset.cubifyTheme=${JSON.stringify(
              DEFAULT_THEME,
            )}}`,
          }}
        />
      </head>
      {/* suppressHydrationWarning: browser extensions inject attrs (e.g. cz-shortcut-listen) */}
      <body className={`${GeistSans.className} antialiased`} suppressHydrationWarning>
        <Providers>
          <Suspense fallback={null}>{children}</Suspense>
        </Providers>
        <Analytics />
      </body>
    </html>
  )
}
