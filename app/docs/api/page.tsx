import Link from "next/link"
import { ArrowLeft, BookOpen, ChevronRight, FileJson2, Info, Search, Scale, Target, Trophy } from "lucide-react"
import { DocsThemeFrame } from "@/components/docs/DocsThemeFrame"
import { DocsMobileMenu } from "@/components/docs/DocsMobileMenu"
import { CubeWordmark } from "@/components/brand/CubeLogo"
import { VsCodeBlock } from "@/components/docs/VsCodeBlock"

const products = [
  { id: "lookup", icon: Search, name: "Lookup", caption: "Competitor intelligence", endpoint: "GET /competitors/{wcaId}", tone: "blue" },
  { id: "compare", icon: Scale, name: "Compare", caption: "Head-to-head rank scoring", endpoint: "POST /comparisons", tone: "mint" },
  { id: "goal", icon: Target, name: "Goal", caption: "Rank projection", endpoint: "POST /goals/projection", tone: "amber" },
  { id: "reports", icon: Trophy, name: "Competition reports", caption: "Field intelligence", endpoint: "POST /reports", tone: "blue" },
] as const

function Endpoint({ method, path, title, children }: { method: "GET" | "POST"; path: string; title: string; children: string }) {
  return <article className="docs-endpoint" id={path.includes("competitors") ? "lookup" : path.includes("comparisons") ? "compare" : path.includes("goals") ? "goal" : "reports"}>
    <div className="docs-endpoint-head"><span className={method === "GET" ? "docs-method docs-method-get" : "docs-method docs-method-post"}>{method}</span><code>{path}</code><span className="docs-live-status">Live</span></div>
    <div className="docs-endpoint-body"><h3>{title}</h3><p>{children}</p></div>
  </article>
}

function JsonWindow() {
  return <VsCodeBlock className="mt-4" language="json" fileName="create-report.json" code={`{
  "competitionUrl": "https://www.worldcubeassociation.org/...",
  "competitorWcaId": "2022RPRA01",
  "eventIds": ["333", "222"]
}`} />
}

export default function ApiDocsPage() {
  return <DocsThemeFrame><main className="docs-workspace min-h-screen bg-background text-foreground">
    <header className="docs-workspace-topbar"><div className="flex items-center gap-3"><Link href="/" aria-label="Cubify home"><CubeWordmark /></Link></div><div className="hidden items-center gap-2 text-sm text-muted-foreground lg:flex"><Link href="/docs" className="docs-parent-link">AI instructions</Link><ChevronRight className="h-3.5 w-3.5" /><span className="font-semibold text-foreground">Developer docs</span></div><Link href="/docs" className="docs-back-link"><ArrowLeft /><span>Back to AI instructions</span></Link></header>
    <DocsMobileMenu active="overview" />
    <div className="mx-auto grid max-w-[1280px] lg:grid-cols-[238px_minmax(0,1fr)]">
      <aside className="docs-side-nav">
        <p className="docs-side-label">Product documentation</p>
        <nav><Link className="docs-side-active" aria-current="page" href="/docs/api"><BookOpen />Overview</Link><p>Feature APIs</p>{products.map(({ id, icon: Icon, name }) => <Link key={id} href={`/docs/api/${id}`}><Icon />{name}</Link>)}<p>Artifacts</p><a href="/openapi.json"><FileJson2 />OpenAPI JSON</a><a href="/llms.txt"><Info />AI operating notes</a></nav>
        <div className="docs-side-foot"><span className="h-1.5 w-1.5 rounded-full bg-[var(--rank-nr)]" /> V1 public beta<br /><small>Four callable WCA data routes.</small></div>
      </aside>

      <section className="min-w-0 border-x border-border px-5 py-8 sm:px-9 lg:px-12">
        <div className="docs-crumb"><span>Developer docs</span><ChevronRight className="h-3.5 w-3.5" /><strong>API catalogue</strong></div>
        <div className="mt-9" id="catalog"><p className="docs-section-kicker">Cubify8 / API catalogue</p><h1 className="mt-2 font-display text-4xl font-bold tracking-[-0.05em]">Everything Cubify can explain.</h1><p className="mt-4 max-w-2xl text-[15px] leading-7 text-muted-foreground">A focused public API for WCA competitor data, head-to-head comparisons, goal projections, and registered competition fields. Every response identifies its source and generated time.</p><div className="docs-intro-principles"><span>WCA-sourced records</span><span>Canonical IDs only</span><span>Unknown strength stays explicit</span></div></div>
        <div className="docs-product-grid mt-8">{products.map(({ id, icon: Icon, name, caption, endpoint, tone }) => <Link href={`/docs/api/${id}`} key={id} className={`docs-folder-card docs-folder-${tone}`}><div className="docs-folder-art"><div className="docs-folder-paper docs-folder-paper-back" /><div className="docs-folder-paper docs-folder-paper-mid" /><div className="docs-folder-front"><Icon className="h-7 w-7" /><span className="font-data text-[10px] font-bold tracking-[0.12em]">API</span></div></div><div className="docs-folder-copy"><h2>{name}</h2><p>{caption}</p><code>{endpoint}</code></div></Link>)}</div>

        <section className="pt-14"><p className="docs-section-kicker">Endpoint reference</p><h2 className="mt-2 font-display text-2xl font-bold tracking-[-0.035em]">Feature endpoints</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">Each endpoint is intentionally narrow: canonical WCA IDs in, evidence-led Cubify data out.</p>
          <div className="mt-6 space-y-4"><Endpoint method="GET" path="/api/v1/competitors/{wcaId}" title="Lookup a competitor">Resolve one WCA ID into official profile, country, personal records, ranks, competition count, and solve activity.</Endpoint><Endpoint method="POST" path="/api/v1/comparisons" title="Compare two competitors">Submit two WCA IDs to receive shared-event and all-event world-rank scoring, winners by event, and clear coverage.</Endpoint><Endpoint method="POST" path="/api/v1/goals/projection" title="Project a goal result">Submit WCA ID, event, single or average, and a hypothetical WCA result to model rank movement across scopes.</Endpoint><Endpoint method="POST" path="/api/v1/reports" title="Create a competition report">Submit a competition URL, your WCA ID, and events to compare every shared opponent’s single and average PB with yours, calculate both field positions, and identify your strongest theoretical event.</Endpoint></div>
        </section>

        <section className="mt-10 border-t border-border pt-9"><p className="docs-section-kicker">Report request example</p><JsonWindow /><div className="mt-4 flex gap-3 rounded-lg border border-[rgba(61,255,168,0.25)] bg-[rgba(61,255,168,0.07)] px-4 py-3 text-sm leading-6 text-muted-foreground"><Info className="mt-1 h-4 w-4 shrink-0 text-[var(--rank-nr)]" /><p><strong className="text-foreground">Live data:</strong> results are generated from current WCA competition registrations and official competitor records. First-time competitors remain explicitly unknown strength.</p></div></section>
      </section>
    </div>
  </main></DocsThemeFrame>
}
