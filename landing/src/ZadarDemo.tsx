"use client"
import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { C, G, WORK, SPARKLE, sparkline, ctxBar, ctxColor, waitColor, projectHue } from "./zadar-tokens"

/* ─────────────────────────────────────────────────────────────────────────
   Fleet model — the data the terminal renders. Each scenario "beat" sets a
   whole Fleet; React diffs it and Motion animates the change.
   ───────────────────────────────────────────────────────────────────────── */

type Status = "working" | "ready" | "waiting"
type Agent = {
  id: string
  name: string
  branch: string
  rhythm: number[]
  ctxPct: number
  cost: number
  procs?: number
  ghost?: boolean
  status: Status
  advancing: boolean // spinner runs only when truly advancing
}
type QKind = "question" | "review" | "memory"
type QItem = {
  id: string
  kind: QKind
  glyph: string
  glyphColor: string
  project: string
  task: string
  rightWord: string
  rightColor: string
  age?: string
  spin?: boolean
  question?: string
  chips?: string[]
  pressed?: number
  diff?: { plus: number; minus: number; files: number }
}
type Pills = { working: number; waiting: number; ready: number; error: number }
type Fleet = {
  beacon: string
  pills: Pills
  burn: string
  queue: QItem[]
  agents: Agent[]
  lit: Record<"working" | "idle" | "waiting" | "review" | "error", boolean>
}

const RHYTHM = {
  webapp: [1, 3, 5, 2, 4, 6, 3, 5, 7, 4, 6, 8],
  zefleet: [2, 4, 6, 3, 1, 0, 2, 7, 9, 6, 8, 5],
  api: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1],
}

const agent = (over: Partial<Agent> & Pick<Agent, "id" | "name" | "branch" | "rhythm" | "ctxPct" | "cost">): Agent => ({
  status: "working",
  advancing: true,
  ...over,
})

// the three sessions, in their resting (calm) form
const calmAgents = (): Agent[] => [
  agent({ id: "webapp", name: "webapp/fix-auth", branch: "fix/auth-redirect", rhythm: RHYTHM.webapp, ctxPct: 52, cost: 0.4 }),
  agent({ id: "zefleet", name: "zefleet", branch: "main", procs: 2, rhythm: RHYTHM.zefleet, ctxPct: 71, cost: 1.24 }),
  agent({ id: "api", name: "api-gateway", branch: "feat/rate-limit", rhythm: RHYTHM.api, ctxPct: 38, cost: 0.88, ghost: true, advancing: false }),
]

const QUESTION: QItem = {
  id: "q-webapp",
  kind: "question",
  glyph: SPARKLE[0],
  glyphColor: C.dim,
  project: "webapp",
  task: "fix the auth redirect loop on the marketing pages",
  rightWord: "waiting",
  rightColor: C.attention,
  age: "now",
  spin: true,
  question: "Should I overwrite the existing config at app/config.ts?",
  chips: ["Overwrite", "Merge keys"],
}
const REVIEW: QItem = {
  id: "r-zefleet",
  kind: "review",
  glyph: G.ready,
  glyphColor: C.positive,
  project: "zefleet",
  task: "write the getting-started guide",
  rightWord: "review",
  rightColor: C.positive,
  age: "now",
  diff: { plus: 214, minus: 38, files: 9 },
}
const MEMORY: QItem = {
  id: "m-webapp",
  kind: "memory",
  glyph: G.error === "✕" ? "▲" : "▲", // warn triangle (Nerd warn glyph absent in subset)
  glyphColor: C.danger,
  project: "webapp",
  task: ":3000 holding 14GB of memory",
  rightWord: "memory",
  rightColor: C.danger,
}

/* ── the scenario: a loop of beats, each a full Fleet + how long to hold ── */
function beats(): { fleet: Fleet; hold: number }[] {
  const base = (over: Partial<Fleet>): Fleet => ({
    beacon: C.accent,
    pills: { working: 3, waiting: 0, ready: 0, error: 0 },
    burn: "7.3",
    queue: [],
    agents: calmAgents(),
    lit: { working: true, idle: false, waiting: false, review: false, error: false },
    ...over,
  })

  const calm = base({})

  const askAgents = () =>
    calmAgents().map((a) => (a.id === "webapp" ? { ...a, status: "waiting" as Status, advancing: false } : a))
  const question = base({
    pills: { working: 2, waiting: 1, ready: 0, error: 0 },
    queue: [QUESTION],
    agents: askAgents(),
    lit: { working: true, idle: false, waiting: true, review: false, error: false },
    beacon: C.attention,
  })
  const answered = base({
    queue: [{ ...QUESTION, pressed: 0 }],
    agents: askAgents(),
    lit: { working: true, idle: false, waiting: true, review: false, error: false },
    beacon: C.attention,
  }) // brief: chip pressed, still showing — then it clears in the next (calm) beat

  const reviewAgents = () =>
    calmAgents().map((a) => (a.id === "zefleet" ? { ...a, status: "ready" as Status, advancing: false } : a))
  const review = base({
    pills: { working: 2, waiting: 0, ready: 1, error: 0 },
    queue: [REVIEW],
    agents: reviewAgents(),
    lit: { working: true, idle: false, waiting: false, review: true, error: false },
  })
  const server = base({
    pills: { working: 2, waiting: 0, ready: 1, error: 0 },
    queue: [MEMORY, REVIEW], // server-mem sorts above review
    agents: reviewAgents(),
    lit: { working: true, idle: false, waiting: false, review: true, error: false },
  })

  return [
    { fleet: calm, hold: 3400 },
    { fleet: question, hold: 4200 },
    { fleet: answered, hold: 900 },
    { fleet: review, hold: 3600 },
    { fleet: server, hold: 2800 },
    { fleet: calm, hold: 1600 },
  ]
}

/* ─────────────────────────────────────────────────────────────────────────
   Component
   ───────────────────────────────────────────────────────────────────────── */

const mono = { fontFamily: "var(--term-mono, monospace)" }

export function ZadarDemo() {
  const SCENES = useRef(beats()).current
  const reduced = useReducedMotion()
  const [fleet, setFleet] = useState<Fleet>(SCENES[0].fleet)
  const [tick, setTick] = useState(0)

  // scripted timeline — step through beats, looping. (Reduced motion: hold the
  // question beat statically, no loop.)
  useEffect(() => {
    if (reduced) {
      setFleet(SCENES[1].fleet)
      return
    }
    let i = 0
    let id: ReturnType<typeof setTimeout>
    const step = () => {
      setFleet(SCENES[i].fleet)
      const hold = SCENES[i].hold
      i = (i + 1) % SCENES.length
      id = setTimeout(step, hold)
    }
    step()
    return () => clearTimeout(id)
  }, [SCENES, reduced])

  // one 120ms ticker drives the braille work-glyph + the sparkle, like the app
  useEffect(() => {
    if (reduced) return
    const id = setInterval(() => setTick((t) => t + 1), 120)
    return () => clearInterval(id)
  }, [reduced])

  const work = WORK[tick % WORK.length]
  const sparkle = SPARKLE[tick % SPARKLE.length]

  return (
    // definite width so the panel never shrink-wraps to a beat's longest line
    <div style={{ width: "min(680px, 92vw)" }}>
      <div
        style={{
          background: C.panel,
          border: `1px solid ${C.line}`,
          borderRadius: 13,
          overflow: "hidden",
          boxShadow: "0 24px 70px -20px rgba(0,0,0,.7)",
        }}
      >
        {/* window chrome */}
        <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "11px 14px", borderBottom: `1px solid ${C.line}` }}>
          {[0, 1, 2].map((k) => (
            <span key={k} style={{ width: 11, height: 11, borderRadius: "50%", background: "oklch(0.35 0.012 255)" }} />
          ))}
          <span style={{ ...mono, marginLeft: 8, fontSize: 12, color: C.faint }}>zadar — ~/Code/zefleet</span>
        </div>

        {/* screen — fixed height so the window never resizes between beats; the
            footer bottom-pins and short beats just show empty terminal space */}
        <div style={{ ...mono, fontSize: 13, lineHeight: 1.7, padding: "16px 18px", color: C.fg, height: 372, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <Header fleet={fleet} />
          <Rule />
          <Section label="Needs you">
            <Queue fleet={fleet} sparkle={sparkle} />
          </Section>
          <Section label="Active sessions" summary={sessionSummary(fleet)}>
            {fleet.agents.map((a) => (
              <AgentRow key={a.id} a={a} work={work} />
            ))}
          </Section>
          <div style={{ flex: "1 1 auto", minHeight: 0 }} />
          <Rule mt={10} />
          <Legend lit={fleet.lit} />
          <Row right={<span style={{ color: C.dim }}>{kc("?")} help</span>} />
        </div>
      </div>
    </div>
  )
}

/* ── primitives ── */

function Row({ left, right }: { left?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", whiteSpace: "pre", gap: 16 }}>
      <span>{left}</span>
      <span style={{ flexShrink: 0 }}>{right}</span>
    </div>
  )
}
const Rule = ({ mt = 0 }: { mt?: number }) => (
  <div style={{ borderTop: `1px solid ${C.line}`, height: 0, margin: `${6 + mt}px 0 6px` }} />
)
const kc = (k: string) => (
  <span style={{ background: C.pill, color: C.fg, borderRadius: 3, padding: "0 5px" }}>{k}</span>
)

function Section({ label, summary, children }: { label: string; summary?: string; children: React.ReactNode }) {
  return (
    <div style={{ margin: "2px 0" }}>
      <Row left={<span style={{ color: C.dim }}>{"  " + label}</span>} right={summary ? <span style={{ color: C.dim }}>{summary}</span> : null} />
      <div style={{ paddingLeft: 3 }}>{children}</div>
    </div>
  )
}

function Header({ fleet }: { fleet: Fleet }) {
  const p = fleet.pills
  const pills: [string, string, number][] = [
    [G.waiting, C.attention, p.waiting],
    [G.error, C.danger, p.error],
    [G.ready, C.positive, p.ready],
    [G.working, C.fg, p.working],
  ]
  return (
    <Row
      left={
        <span>
          <motion.span animate={{ color: fleet.beacon }} transition={{ duration: 0.4 }} style={{ fontWeight: 600 }}>
            zadar
          </motion.span>
          <AnimatePresence>
            {pills
              .filter(([, , n]) => n > 0)
              .map(([g, col, n]) => (
                <motion.span
                  key={g}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ type: "spring", stiffness: 500, damping: 28 }}
                  style={{ color: col, marginLeft: 12 }}
                >
                  {g}
                  {n}
                </motion.span>
              ))}
          </AnimatePresence>
        </span>
      }
      right={
        <span style={{ color: C.dim }}>
          <span style={{ color: C.fg }}>${fleet.burn}</span>/h · thu · 14:08
        </span>
      }
    />
  )
}

function sessionSummary(f: Fleet): string {
  const active = f.agents.length
  const ready = f.agents.filter((a) => a.status === "ready").length
  const waiting = f.agents.filter((a) => a.status === "waiting").length
  const parts = [`${active} active`]
  if (waiting) parts.push(`${waiting} waiting`)
  if (ready) parts.push(`${ready} review`)
  return parts.join(" · ")
}

function statusGlyph(a: Agent, work: string): { ch: string; color: string } {
  if (a.status === "waiting") return { ch: G.waiting, color: C.attention }
  if (a.status === "ready") return { ch: G.ready, color: C.positive }
  if (a.status === "working" && a.advancing) return { ch: work, color: C.fg } // truthful spinner
  return { ch: G.working, color: C.dim } // working-but-stalled → static dot
}

function AgentRow({ a, work }: { a: Agent; work: string }) {
  const g = statusGlyph(a, work)
  const hue = projectHue(a.name.split("/")[0])
  const bar = ctxBar(a.ctxPct)
  const left = (
    <span>
      <motion.span animate={{ color: g.color }} transition={{ duration: 0.35 }} style={{ display: "inline-block", width: "1.2em" }}>
        {g.ch}
      </motion.span>{" "}
      <span style={{ color: C.fg }}>{a.name}</span>
      <span style={{ color: hue }}>{` ${G.branch} `}</span>
      <span style={{ color: C.dim }}>{a.branch}</span>
      {a.procs ? <span style={{ color: C.dim }}>{`  ×${a.procs}`}</span> : null}
    </span>
  )
  // ready row's badge is its diff; others show the vitals grid
  const right =
    a.status === "ready" ? (
      <span>
        <span style={{ color: C.positive }}>+214</span>
        <span style={{ color: C.danger }}> −38</span>
        <span style={{ color: C.dim }}>{"  9 files"}</span>
      </span>
    ) : a.status === "waiting" ? (
      <span style={{ color: C.attention }}>
        {G.waiting} waiting <span style={{ color: C.dim }}>· now</span>
      </span>
    ) : (
      <span style={{ whiteSpace: "pre" }}>
        <span style={{ color: C.dim }}>{sparkline(a.rhythm)}</span>{"  "}
        <span style={{ color: ctxColor(a.ctxPct) }}>{bar.filled}</span>
        <span style={{ color: C.faint }}>{bar.trough}</span>{" "}
        <span style={{ color: a.ctxPct >= 70 ? ctxColor(a.ctxPct) : C.fg }}>{String(a.ctxPct).padStart(3)}%</span>
        <span style={{ color: C.dim }}>{a.ghost ? "⟳" : " "}</span>{" "}
        <span style={{ color: C.fg }}>{("$" + a.cost.toFixed(2)).padStart(6)}</span>
      </span>
    )
  return <Row left={left} right={right} />
}

function Queue({ fleet, sparkle }: { fleet: Fleet; sparkle: string }) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {fleet.queue.length === 0 ? (
        <motion.div key="clear" layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <Row left={<span><span style={{ color: C.positive }}>{"   " + G.check}</span><span style={{ color: C.dim }}> nothing needs you</span></span>} />
        </motion.div>
      ) : (
        fleet.queue.map((it) => <QueueItem key={it.id} it={it} sparkle={sparkle} />)
      )}
    </AnimatePresence>
  )
}

function QueueItem({ it, sparkle }: { it: QItem; sparkle: string }) {
  const hue = projectHue(it.project)
  return (
    <motion.div
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 36 }}
      style={{ overflow: "hidden" }}
    >
      <Row
        left={
          <span>
            <span style={{ color: C.dim }}>{"   "}</span>
            <span style={{ color: it.spin ? waitColor(0) : it.glyphColor }}>{it.spin ? sparkle : it.glyph} </span>
            <span style={{ color: C.fg }}>{it.project}</span>
            <span style={{ color: hue }}>{" · "}</span>
            <span style={{ color: C.dim }}>{it.task}</span>
          </span>
        }
        right={
          it.age ? (
            <span style={{ color: it.rightColor }}>
              {it.rightWord} <span style={{ color: C.dim }}>· {it.age}</span>
            </span>
          ) : (
            <span style={{ color: it.rightColor }}>{it.rightWord}</span>
          )
        }
      />
      {it.question && (
        <>
          <div style={{ color: C.fg, paddingLeft: "3.2em" }}>“{it.question}”</div>
          <div style={{ paddingLeft: "3.2em", marginTop: 2 }}>
            {it.chips?.map((c, i) => (
              <motion.span
                key={c}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.08 }}
                style={{ marginRight: 14 }}
              >
                <motion.span
                  animate={it.pressed === i ? { background: C.accent, color: C.panel, scale: 0.94 } : {}}
                  style={{ background: C.pill, color: C.fg, borderRadius: 3, padding: "0 5px" }}
                >
                  {i + 1}
                </motion.span>
                <span style={{ color: C.dim }}> {c}</span>
              </motion.span>
            ))}
          </div>
        </>
      )}
      {it.diff && (
        <div style={{ paddingLeft: "3.2em", color: C.dim }}>
          review <span style={{ color: C.positive }}>+{it.diff.plus}</span>
          <span style={{ color: C.danger }}> −{it.diff.minus}</span> across <span style={{ color: C.fg }}>{it.diff.files}</span> files
        </div>
      )}
    </motion.div>
  )
}

function Legend({ lit }: { lit: Fleet["lit"] }) {
  const item = (g: string, label: string, on: boolean, onColor: string) => (
    <motion.span animate={{ color: on ? onColor : C.faint }} transition={{ duration: 0.3 }}>
      {g} {label}
    </motion.span>
  )
  return (
    <Row
      left={
        <span style={{ display: "inline-flex", gap: 18, alignItems: "center" }}>
          {item(G.waiting, "waiting", lit.waiting, C.attention)}
          {item(G.ready, "review", lit.review, C.positive)}
          {item(G.error, "error", lit.error, C.danger)}
          <span style={{ color: C.faint }}>│</span>
          {item(G.working, "working", lit.working, C.fg)}
          {item(G.idle, "idle", lit.idle, C.dim)}
        </span>
      }
    />
  )
}
