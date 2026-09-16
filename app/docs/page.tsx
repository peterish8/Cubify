"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  ArrowRight,
  Check,
  Copy,
  FileCode2,
  Globe2,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react"
import { SiteFooter, SiteHeader } from "@/components/layout/SiteChrome"

const chatGptPrompt = `Read and follow Cubify8’s competition-analysis instructions:
https://cubify.in/docs

If the rendered docs page is unavailable, read one of these machine-readable
fallbacks using the exact plain URL (do not wrap it in Markdown like
[label](https://...)):
https://cubify.in/llms.txt
https://cubify.in/docs.txt
https://cubify.in/docs.md
https://cubify.in/docs/agent.md
https://cubify.in/api/openapi.json

If every plain URL fails with a DNS or name-resolution error, that is a network
restriction in the current runtime. Report that limitation clearly; it does not
mean the Cubify routes are missing. Do not retry by passing Markdown link text
to an HTTP client.

You are a Cubify8 API client. Do not web-search the WCA or any other site for
competition details. Cubify calls the official WCA data server-side and returns
the report; your job is to collect inputs, call Cubify, and explain its response.

Start a guided Cubify8 competition-analysis intake. Do not analyze a field yet.

1. First ask me for either:
   - the official WCA competition registration link, OR
   - the canonical WCA competition ID (the final path segment, for example
     CubeathonBengaluru2026).
   If I give only a name, city, or year, ask me for the official registration
   link or canonical ID. Do not search for it yourself.

2. After I confirm the competition, ask for:
   - my WCA ID (or let me say I am a first-time competitor), and
   - the events I am participating in.

3. Then call Cubify’s one-request report endpoint. If I gave a registration
   link, extract only the ID from /competitions/<ID> or /competitions/<ID>/registrations.
   Use a plain URL, never Markdown link text. Call:
   https://cubify.in/api/v1/agent/competition-report?competitionId=<ID>&wcaId=<WCA_ID>&events=<comma-separated-event-ids>
   Add &include=all only when every opponent is needed. If I am a first-time
   competitor and have no WCA ID, explain that the current report endpoint
   requires a WCA ID before calling it.

4. Render the JSON response faithfully. Give me:
   - opponents in each event
   - my PB position in the field
   - the best-average-based possible overall range
   - first-time competitors separately
   - source, generatedAt, event states, and all warnings
   - a simple competition strategy only as clearly labelled advice

Use pbSingleDisplay and pbAverageDisplay in prose. Never turn an absent average
into a single-based rank. Never invent placement or podium probabilities when
the response says they are unavailable.

If Cubify itself cannot be reached, show the exact endpoint and the network error
instead of web-searching around it.`

function PromptDialog({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  async function copy() {
    await navigator.clipboard.writeText(chatGptPrompt)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="prompt-dialog-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 1 }}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.button aria-label="Close prompt" className="absolute inset-0 cursor-default bg-black/75 backdrop-blur-md" onClick={onClose} initial={{ opacity: 0, backdropFilter: "blur(0px)" }} animate={{ opacity: 1, backdropFilter: "blur(14px)" }} exit={{ opacity: 0, backdropFilter: "blur(0px)" }} transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }} />
      <motion.section className="relative max-h-[calc(100vh-1.5rem)] w-full max-w-4xl overflow-hidden rounded-[1.6rem] border border-[rgba(var(--theme-bright-rgb),0.3)] bg-[#05070d] shadow-[0_32px_120px_rgba(0,0,0,0.8)] sm:max-h-[calc(100vh-3rem)]" initial={{ opacity: 0, y: 16, scale: 0.98, filter: "blur(3px)" }} animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }} exit={{ opacity: 0, y: 8, scale: 0.992, filter: "blur(2px)" }} transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}>
        <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-7 sm:py-5">
          <div><p className="font-data text-[10px] font-bold tracking-[0.16em] text-[var(--blue-bright)]">CHATGPT STARTER</p><h2 id="prompt-dialog-title" className="mt-1 font-display text-xl font-bold tracking-[-0.04em]">Your guided Cubify prompt</h2></div>
          <button type="button" onClick={onClose} className="pressable rounded-full border border-border p-2 text-muted-foreground hover:border-[rgba(var(--theme-bright-rgb),0.35)] hover:text-foreground" aria-label="Close prompt"><X className="h-4 w-4" /></button>
        </header>
        <div className="max-h-[calc(100vh-8.5rem)] overflow-y-auto p-5 sm:max-h-[calc(100vh-10rem)] sm:p-7">
          <div className="overflow-hidden rounded-xl border border-border bg-black/50">
            <div className="flex flex-col gap-3 border-b border-border bg-[rgba(var(--theme-rgb),0.06)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="text-xs leading-5 text-muted-foreground">Paste this as your first message. ChatGPT will confirm the competition before it analyzes.</p>
              <button type="button" onClick={copy} className="pressable inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-xs font-extrabold text-primary-foreground shadow-[0_0_28px_rgba(var(--theme-rgb),0.25)]">{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? "Prompt copied" : "Copy full prompt"}</button>
            </div>
            <pre className="whitespace-pre-wrap p-4 font-data text-xs leading-6 text-[#c8d6ef] sm:p-5 sm:text-[13px]">{chatGptPrompt}</pre>
          </div>
        </div>
      </motion.section>
    </motion.div>
  )
}

const rules = [
  "Use accepted registrations only; filter every field to competitors registered for that event.",
  "Match established competitors through their WCA ID. Never identify someone from a name alone.",
  "Use source-published gender only. Never infer gender from a name or photo.",
  "Keep first-time competitors and missing official averages in an unknown-strength group.",
  "Call placements and podium chances estimates, include uncertainty, and never promise an outcome.",
]

export default function DocsPage() {
  const [promptOpen, setPromptOpen] = useState(false)

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <SiteHeader active="docs" />
      <section className="relative mx-auto max-w-7xl px-4 pt-14 pb-8 sm:px-6 sm:pt-20 xl:max-w-[90rem] xl:px-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[34rem] opacity-60 [background:radial-gradient(circle_at_74%_14%,rgba(var(--theme-rgb),0.25),transparent_29%),radial-gradient(circle_at_17%_32%,rgba(var(--theme-bright-rgb),0.1),transparent_28%)]" />
        <div className="max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[rgba(var(--theme-bright-rgb),0.2)] bg-[rgba(var(--theme-rgb),0.1)] px-3 py-1.5 font-data text-[10px] font-bold tracking-[0.16em] text-[var(--blue-bright)]">
            <Sparkles className="h-3.5 w-3.5" /> AI-readable instructions · V1
          </div>
          <h1 className="font-display text-4xl font-bold tracking-[-0.055em] sm:text-6xl">Start with the right competition.</h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            Cubify guides the conversation: confirm the competition, collect the competitor and event details, then return an explainable field report from its API.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 xl:max-w-[90rem] xl:px-8">
        <button type="button" onClick={() => setPromptOpen(true)} className="group pressable relative flex min-h-56 w-full overflow-hidden rounded-[1.5rem] border border-[rgba(var(--theme-bright-rgb),0.3)] bg-[linear-gradient(118deg,rgba(var(--theme-rgb),0.24),rgba(5,7,13,0.86)_48%,rgba(5,7,13,0.95))] p-6 text-left shadow-[0_0_0_1px_rgba(0,0,0,0.4),0_24px_80px_rgba(0,0,0,0.32)] transition hover:border-[rgba(var(--theme-bright-rgb),0.62)] sm:min-h-64 sm:p-9">
          <span className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[rgba(var(--theme-rgb),0.22)] blur-3xl transition group-hover:bg-[rgba(var(--theme-rgb),0.35)]" />
           <span className="relative flex max-w-xl flex-col items-start"><span className="font-data text-[10px] font-bold tracking-[0.16em] text-[var(--blue-bright)]">Start here · Guided intake</span><span className="mt-5 font-display text-3xl font-bold tracking-[-0.05em] sm:text-5xl">Copy the ChatGPT<br />competition prompt.</span><span className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">It calls Cubify’s report API directly, confirms the competition, then collects your WCA ID and events.</span><span className="mt-7 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-extrabold text-primary-foreground shadow-[0_0_28px_rgba(var(--theme-rgb),0.25)]"><Copy className="h-4 w-4" /> Open &amp; copy prompt <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span></span>
        </button>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 pb-14 sm:grid-cols-3 sm:px-6 xl:max-w-[90rem] xl:px-8">
        {[
           [Globe2, "1 · Give the ID or link", "Give ChatGPT the official WCA registration link or canonical competition ID."],
           [FileCode2, "2 · Confirm first", "ChatGPT confirms the competition, then calls Cubify’s report endpoint for the official data."],
           [MessageSquareText, "3 · Then analyze", "It asks for your WCA ID and events, then explains the API response and its uncertainty."],
        ].map(([Icon, title, body]) => {
          const CardIcon = Icon as typeof Globe2
          return <article key={title as string} className="rounded-2xl border border-border bg-[rgba(5,7,13,0.72)] p-6"><CardIcon className="h-5 w-5 text-[var(--blue-bright)]" /><h2 className="mt-5 font-display text-xl font-bold tracking-[-0.035em]">{title as string}</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">{body as string}</p></article>
        })}
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 pb-20 sm:px-6 lg:grid-cols-[1.05fr_.95fr] xl:max-w-[90rem] xl:px-8">
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
          <div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-[var(--rank-nr)]" /><h2 className="font-display text-2xl font-bold tracking-[-0.04em]">Rules for an honest report</h2></div>
          <ul className="mt-6 space-y-4">{rules.map((rule) => <li className="flex gap-3 text-sm leading-6 text-muted-foreground" key={rule}><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--blue-bright)]" />{rule}</li>)}</ul>
        </div>
        <div className="rounded-2xl border border-[rgba(var(--theme-bright-rgb),0.22)] bg-[linear-gradient(145deg,rgba(var(--theme-rgb),0.16),rgba(5,7,13,0.9)_48%)] p-6 sm:p-8">
          <p className="font-data text-[10px] font-bold tracking-[0.16em] text-[var(--blue-bright)]">For developers</p>
          <h2 className="mt-3 font-display text-2xl font-bold tracking-[-0.04em]">Machine-readable, too.</h2>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">The V1 API contract is live so tools can connect against a stable shape. Competition reports return source-backed field data with explicit uncertainty.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/docs/api" className="pressable inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"><FileCode2 className="h-3.5 w-3.5" /> API contract <ArrowRight className="h-3.5 w-3.5" /></Link>
            <a href="/llms.txt" className="pressable inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground">View llms.txt</a>
          </div>
        </div>
      </section>
      <SiteFooter />
      <AnimatePresence>{promptOpen ? <PromptDialog onClose={() => setPromptOpen(false)} /> : null}</AnimatePresence>
    </main>
  )
}
