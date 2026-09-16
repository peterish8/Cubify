import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, BookOpen, ChevronRight, FileJson2, Info, Search, Scale, Target, Trophy } from "lucide-react"
import { notFound } from "next/navigation"
import { DocsThemeFrame } from "@/components/docs/DocsThemeFrame"
import { DocsMobileMenu } from "@/components/docs/DocsMobileMenu"
import { CubeWordmark } from "@/components/brand/CubeLogo"
import { VsCodeBlock } from "@/components/docs/VsCodeBlock"

const features = {
  lookup: {
    name: "Lookup", icon: Search, method: "GET", path: "/api/v1/competitors/{wcaId}", eyebrow: "Competitor intelligence",
    summary: "Turn a canonical WCA ID into a current, source-backed competitor profile.",
    why: "Use Lookup when a user needs verified facts about one competitor before comparing, planning a goal, or understanding a competition field.",
    request: "GET /api/v1/competitors/2022RPRA01",
    response: `{
  "data": {
    "wcaId": "2022RPRA01",
    "name": "Prathick Dhanes R",
    "country": { "name": "India", "iso2": "IN" },
    "personalRecords": { "333": { "average": { "best": 1163 } } }
  },
  "source": "World Cube Association",
  "generatedAt": "2026-09-16T00:00:00.000Z"
}`,
    useCases: ["Show a competitor’s official PBs and rankings in a Cubify profile.", "Verify a WCA ID before starting a comparison or competition report.", "Give an AI assistant primary-source context rather than guessing from a name."],
    notes: ["Pass a canonical WCA ID, never a person name.", "Personal-record values use official WCA result units.", "Activity is returned when it is available from the WCA source."],
  },
  compare: {
    name: "Compare", icon: Scale, method: "POST", path: "/api/v1/comparisons", eyebrow: "Head-to-head analysis",
    summary: "Compare two official profiles event by event without inventing a winner where data is missing.",
    why: "Use Compare to see which competitor has the stronger official world ranking across shared events, and where the available evidence is incomplete.",
    request: `POST /api/v1/comparisons
Content-Type: application/json

{
  "wcaIdA": "2022RPRA01",
  "wcaIdB": "2017BACH09"
}`,
    response: `{
  "data": {
    "competitors": { "a": { "wcaId": "2022RPRA01" }, "b": { "wcaId": "2017BACH09" } },
    "events": [{ "eventId": "333", "shared": true, "slots": [] }],
    "score": { "sharedEvents": { "a": 4, "b": 2 } }
  },
  "source": "World Cube Association"
}`,
    useCases: ["Help a cuber understand a likely rival’s strengths event by event.", "Generate evidence-led head-to-head context for an AI conversation.", "Compare progress with a training partner using official ranking data."],
    notes: ["A lower world rank is stronger.", "Only available official records participate in a result.", "A missing record is not treated as a poor result."],
  },
  goal: {
    name: "Goal", icon: Target, method: "POST", path: "/api/v1/goals/projection", eyebrow: "Rank projection",
    summary: "Model the rank impact of a hypothetical official result for one event and result type.",
    why: "Use Goal when a cuber asks what a target time could mean for their national, continental, and world standing.",
    request: `POST /api/v1/goals/projection
Content-Type: application/json

{
  "wcaId": "2022RPRA01",
  "eventId": "333",
  "rankType": "average",
  "hypotheticalBest": 1500
}`,
    response: `{
  "data": {
    "eventId": "333",
    "rankType": "average",
    "previousBest": 1163,
    "hypotheticalBest": 1500,
    "projectedRanks": { "nr": { "rank": 1857 }, "cr": { "rank": 16988 }, "wr": { "rank": 43776 } }
  }
}`,
    useCases: ["Explore what a target average may do to a 3×3 ranking.", "Turn a training goal into a measurable rank outcome.", "Let an AI explain rank movement with clearly bounded assumptions."],
    notes: ["hypotheticalBest is an integer in official WCA units; 1500 means 15.00 seconds.", "Projection uses Cubify rank-list data and is not a guarantee of a future rank.", "Use single or average according to the event’s official result type."],
  },
  reports: {
    name: "Competition reports", icon: Trophy, method: "POST", path: "/api/v1/reports", eyebrow: "Competition field intelligence",
    summary: "Read an official WCA registrations page and compare your single and average PBs against every opponent in your shared events.",
    why: "Use Competition reports when a cuber wants to understand who is registered in their events, every shared opponent’s official PBs, their own single and average field position, and the event where their PB is theoretically strongest.",
    request: `POST /api/v1/reports
Content-Type: application/json

{
  "competitionUrl": "https://www.worldcubeassociation.org/competitions/CubeathonBengaluru2026/registrations",
  "competitorWcaId": "2022RPRA01",
  "eventIds": ["333", "222"]
}`,
     response: `{
  "data": {
    "competition": { "name": "Cube-a-thon Bengaluru 2026", "roundPlans": { "333": { "rounds": [] } } },
    "personalized": {
      "sharedEventIds": ["333", "222"],
      "theoreticalBestEvent": { "bySingle": { "eventId": "333", "position": 17 }, "byAverage": { "eventId": "333", "position": 15 } },
      "recentForm": [{ "eventId": "333", "latestAverage": 1140, "trend": "improving", "standardDeviation": 68 }]
    },
    "byEvent": [{ "eventId": "333", "myStanding": { "single": { "position": 17 }, "average": { "position": 15 } } }]
  },
  "source": { "provider": "World Cube Association" }
}`,
    useCases: ["Prepare for a competition by seeing every shared opponent’s single and average PB beside yours.", "Find your field position separately for singles and averages in each shared event.", "Identify the event where your PB has the strongest theoretical standing, while keeping first-time competitors explicitly unknown."],
     notes: ["competitionUrl must be an official World Cube Association competition or registrations URL.", "When competitorWcaId is provided, only events shared with your accepted registration are included.", "Recent form is a descriptive tail of official WCA averages, not a competition-day prediction.", "Round plans expose WCA advancement conditions and PB thresholds when available; they do not guarantee advancement.", "Theoretical standing is PB-only: it does not predict competition-day results or rank unknown-strength competitors."],
  },
} as const

type FeatureKey = keyof typeof features

function isFeatureKey(value: string): value is FeatureKey {
  return value in features
}

export function generateStaticParams() {
  return Object.keys(features).map((feature) => ({ feature }))
}

export function generateMetadata({ params }: { params: { feature: string } }): Metadata {
  if (!isFeatureKey(params.feature)) return {}
  const feature = features[params.feature]
  return { title: `${feature.name} API | Cubify`, description: `${feature.summary} Learn why to use ${feature.name}, its request shape, response, and use cases.` }
}

export default function FeatureApiPage({ params }: { params: { feature: string } }) {
  if (!isFeatureKey(params.feature)) notFound()
  const feature = features[params.feature]
  const Icon = feature.icon

  return <DocsThemeFrame><main className="docs-workspace min-h-screen bg-background text-foreground">
    <header className="docs-workspace-topbar"><div className="flex items-center gap-3"><Link href="/" aria-label="Cubify home"><CubeWordmark /></Link></div><div className="hidden items-center gap-2 text-sm text-muted-foreground lg:flex"><Link href="/docs" className="docs-parent-link">AI instructions</Link><ChevronRight className="h-3.5 w-3.5" /><span className="font-semibold text-foreground">Developer docs</span></div><Link href="/docs" className="docs-back-link"><ArrowLeft /><span>Back to AI instructions</span></Link></header>
    <DocsMobileMenu active={params.feature} />
    <div className="mx-auto grid max-w-[1280px] lg:grid-cols-[238px_minmax(0,1fr)]">
      <aside className="docs-side-nav"><p className="docs-side-label">Product documentation</p><nav><Link href="/docs/api"><BookOpen />Overview</Link><p>Feature APIs</p>{Object.entries(features).map(([key, item]) => { const NavIcon = item.icon; return <Link key={key} href={`/docs/api/${key}`} className={key === params.feature ? "docs-side-active" : ""} aria-current={key === params.feature ? "page" : undefined}><NavIcon />{item.name}</Link> })}<p>Artifacts</p><a href="/openapi.json"><FileJson2 />OpenAPI JSON</a><a href="/llms.txt"><Info />AI operating notes</a></nav><div className="docs-side-foot"><span className="h-1.5 w-1.5 rounded-full bg-[var(--rank-nr)]" /> V1 public beta<br /><small>Four callable WCA data routes.</small></div></aside>
      <article className="docs-feature-page min-w-0 border-x border-border px-5 py-8 sm:px-9 lg:px-12">
        <nav className="docs-crumb" aria-label="Breadcrumb"><Link href="/docs/api">Developer docs</Link><ChevronRight className="h-3.5 w-3.5" /><strong>{feature.name}</strong></nav>
        <section className="mt-10"><div className="docs-feature-icon"><Icon /></div><p className="docs-section-kicker mt-6">Cubify8 / {feature.eyebrow}</p><h1 className="mt-2 max-w-3xl font-display text-4xl font-bold tracking-[-0.05em] sm:text-5xl">{feature.name} API</h1><p className="mt-4 max-w-3xl text-[16px] leading-7 text-muted-foreground">{feature.summary}</p><div className="docs-path-chip mt-6"><span className={feature.method === "GET" ? "docs-method docs-method-get" : "docs-method docs-method-post"}>{feature.method}</span><code>{feature.path}</code><span className="docs-live-status">Live</span></div></section>
        <section className="docs-feature-section"><h2>Why use this API?</h2><p>{feature.why}</p></section>
        <section className="docs-feature-section"><div className="flex items-end justify-between gap-4"><div><p className="docs-section-kicker">Request example</p><h2>What to send</h2></div></div><VsCodeBlock className="mt-4" language="http" fileName="request.http" code={feature.request} /></section>
        <section className="docs-feature-section"><div className="flex items-end justify-between gap-4"><div><p className="docs-section-kicker">Response example</p><h2>What comes back</h2></div></div><VsCodeBlock className="mt-4" language="json" fileName="response.json" code={feature.response} /></section>
        <section className="docs-feature-section"><p className="docs-section-kicker">Practical use</p><h2>When it helps</h2><ul className="docs-use-case-list">{feature.useCases.map((useCase) => <li key={useCase}>{useCase}</li>)}</ul></section>
        <section className="docs-feature-section"><p className="docs-section-kicker">Data notes</p><h2>Use it responsibly</h2><ul className="docs-note-list">{feature.notes.map((note) => <li key={note}>{note}</li>)}</ul></section>
      </article>
    </div>
  </main></DocsThemeFrame>
}
