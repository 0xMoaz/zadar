#!/usr/bin/env bun
/**
 * Regenerate the landing page's rotating demo vignettes from the LIVE app — so the
 * marketing demo can never drift from the real UI. Each vignette curates a tiny fleet
 * and focuses the view (collapsing sections), renders it headless, auto-fits the height,
 * captures the exact span grid (text + colors), and converts to colored HTML. The frames
 * are injected as a JSON island the page rotates through.
 *
 *   bun run landing/gen.tsx
 */
import { act } from "react"
import { testRender } from "@opentui/react/test-utils"
import { readFileSync, writeFileSync } from "node:fs"
import { App } from "../src/App"
import { mockSnapshot } from "../src/mock"

const WIDTH = 100
const healthy = (s: { stale: boolean; memKB: number }) => !s.stale && s.memKB < 4 * 1024 * 1024

type Vig = { caption: string; keep: string[]; servers: "healthy" | "all"; open: Record<string, boolean> }
const VIGNETTES: Vig[] = [
  {
    caption: "An agent hits a fork it can't take alone — zadar floats the exact question to the top, its options ready as ① ②.",
    keep: ["web-auth-01", "zee-main-03", "api-rate-04"],
    servers: "healthy",
    open: { sessions: false },
  },
  {
    caption: "A session finishes and parks its diff — +214 −38 across 9 files. Review it on your time, not mid-flow.",
    keep: ["docs-ready-05", "zee-main-03", "api-rate-04"],
    servers: "healthy",
    open: { sessions: false },
  },
  {
    caption: "Not just agents — a dev server eating 14GB or a stale worktree surfaces here too. Kill or prune without leaving.",
    keep: ["zee-main-03", "api-rate-04"],
    servers: "all",
    open: { sessions: false },
  },
  {
    caption: "When nothing's blocked, zadar goes quiet — just your fleet's pulse: who's working, context left, spend.",
    keep: ["zee-main-03", "api-rate-04"],
    servers: "healthy",
    open: { sessions: true },
  },
]

const hex = (b?: Record<string, number>) => {
  if (!b || (b[3] ?? 0) === 0) return null
  return `#${[b[0], b[1], b[2]].map((n) => (n ?? 0).toString(16).padStart(2, "0")).join("")}`
}
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
const DEFAULT_FG = new Set(["#c8cdd4", "#ffffff"])

type Cap = { lines: { spans: { text: string; fg?: { buffer: Record<string, number> }; bg?: { buffer: Record<string, number> }; attributes: number }[] }[] }

async function render(snapshot: object, open: Record<string, boolean>, height: number): Promise<Cap> {
  const setup = await testRender(<App snapshot={snapshot} live={false} demo initialOpen={open} />, { width: WIDTH, height })
  await act(async () => {
    await setup.renderOnce()
  })
  const cap = setup.captureSpans() as Cap
  await act(async () => {
    setup.renderer.destroy()
  })
  return cap
}

const plain = (cap: Cap) => cap.lines.map((ln) => ln.spans.map((s) => s.text).join(""))

// the footer (legend · rule · hints) is pinned to the bottom; find the snug height that
// seats it right under the content with no gap, so the terminal sizes to each vignette.
function fitHeight(big: Cap): number {
  const lines = plain(big)
  const hints = lines.findLastIndex((l) => l.includes("help"))
  let contentEnd = hints - 3
  while (contentEnd > 0 && lines[contentEnd].trim() === "") contentEnd--
  return contentEnd + 1 + 3
}

function toHtml(cap: Cap): string {
  const lines = cap.lines.map((ln) =>
    ln.spans
      .map((sp) => {
        const fg = hex(sp.fg?.buffer)
        const bg = hex(sp.bg?.buffer)
        const styles: string[] = []
        if (fg && !DEFAULT_FG.has(fg)) styles.push(`color:${fg}`)
        if (bg && bg !== "#16181d" && bg !== "#000000") styles.push(`background:${bg}`)
        if (sp.attributes & 1) styles.push("font-weight:600")
        const t = esc(sp.text)
        return styles.length ? `<span style="${styles.join(";")}">${t}</span>` : t
      })
      .join(""),
  )
  const blank = (s: string) => s.replace(/<[^>]*>/g, "").trim() === ""
  let a = 0, b = lines.length
  while (a < b && blank(lines[a])) a++
  while (b > a && blank(lines[b - 1])) b--
  // collapse the pinned-footer's blank gap (the app never stacks 2+ blank rows otherwise),
  // so the legend/footer seat right under the content instead of floating at the bottom.
  const tight: string[] = []
  for (const l of lines.slice(a, b)) {
    if (blank(l) && tight.length && blank(tight[tight.length - 1])) continue
    tight.push(l)
  }
  return tight.join("\n").replace("⠋", '<span class="spin">⠋</span>')
}

const built = VIGNETTES.map((v) => ({
  v,
  snapshot: {
    ...mockSnapshot,
    agents: mockSnapshot.agents.filter((a) => v.keep.includes(a.id)),
    servers: v.servers === "all" ? mockSnapshot.servers : mockSnapshot.servers.filter(healthy),
  },
}))
// each scene snug-fit to its own content; the page animates the terminal height between
// them so it "breathes" as it cycles — no empty gaps, no jump.
const out: { html: string; caption: string }[] = []
for (const b of built) {
  const fit = fitHeight(await render(b.snapshot, b.v.open, 30))
  out.push({ html: toHtml(await render(b.snapshot, b.v.open, fit)), caption: b.v.caption })
}

const json = JSON.stringify(out).replace(/</g, "\\u003c")
const path = new URL("./index.html", import.meta.url).pathname
// function replacement — a string replacement would interpret $1/$2 inside the JSON
// (costs like "$2.1/h") as capture-group refs and inject a stray </script>.
const html = readFileSync(path, "utf8").replace(
  /(<script id="vig-data" type="application\/json">)[\s\S]*?(<\/script>)/,
  (_m, p1, p2) => p1 + json + p2,
)
writeFileSync(path, html)
console.log("vignettes:", out.map((o, i) => `${i}:${o.html.split("\n").length}r`).join("  "))
process.exit(0)
