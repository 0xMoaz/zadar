import { useEffect, useMemo, useRef, useState } from "react"
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react"
import { collect, emptySnapshot } from "./collect"
import { invalidateWorktrees } from "./collectors/worktrees"
import { attentionQueue, groupByProject, isSeen, pruneAcks, suppressAcked, turnSig, type AttentionItem, type ProjectGroup } from "./fleetmap"
import type { Agent, DevServer, RepoWorktrees, Snapshot, WorktreeItem } from "./types"
import {
  copyResume,
  copyText,
  focusSession,
  killProcess,
  notify,
  openServer,
  pruneWorktree,
  resumeCommand,
} from "./actions"
import { color, glyph, icon, statusColor, statusGlyph, waitColor } from "./theme"
import { fmtCost, fmtDuration, fmtMem } from "./format"
import { diffTransitions, type Transition } from "./signal"
import { appendEvents, loadToday } from "./history"
import { checkForUpdate, pendingUpdate, updateChannel, VERSION } from "./update"
import { AgentBlock } from "./components/AgentBlock"
import { ServerCard } from "./components/ServerCard"
import { WorktreeItemRow } from "./components/WorktreeCard"
import { QueueItem } from "./components/QueueItem"
import { QueueDetail } from "./components/QueueDetail"
import { ProjectCard } from "./components/ProjectCard"
import { Pillar } from "./components/Pillar"
import { Rule } from "./components/Rule"
import { Footer, type Hint } from "./components/Footer"
import { HelpOverlay } from "./components/HelpOverlay"
import { EventLog } from "./components/EventLog"
import { StateLegend } from "./components/StateLegend"
import { Stat } from "./components/Stat"
import { SignalLine, type Signal } from "./components/SignalLine"
import { SignalDetail } from "./components/SignalDetail"
import { TabBar } from "./components/TabBar"
import { TextAttributes } from "@opentui/core"

// Hide only genuinely-dormant sessions. A session you touched recently — even if
// it just finished a turn and is awaiting you — stays visible. Toggle with `i`.
const STALE_SEC = 20 * 60
const isActive = (a: Agent) => a.status !== "idle" || a.idleSec < STALE_SEC

type Section = "queue" | "projects" | "sessions" | "servers"
const LABEL: Record<Section, string> = {
  queue: "Needs you",
  projects: "Projects",
  sessions: "Active sessions",
  servers: "Servers",
}
// compact tier trims the labels too — every cell counts in a sticky HUD
const LABEL_COMPACT: Record<Section, string> = {
  queue: "Needs",
  projects: "Projects",
  sessions: "Sessions",
  servers: "Servers",
}
// the compact lens order — Needs leads, the supporting cast follows
const TABS: Section[] = ["queue", "sessions", "servers", "projects"]
// what each needs-queue kind asks of you, in plain words (compact signal lines)
const NEEDS_WORD: Record<AttentionItem["kind"], string> = {
  question: "asks",
  approval: "approve",
  error: "failed",
  ready: "review",
  "server-mem": "memory",
  "server-stale": "stale",
  "ctx-high": "context",
}
type Row =
  | { sid: string; kind: "header"; section: Section }
  | { sid: string; kind: "queue"; section: Section; item: AttentionItem }
  | { sid: string; kind: "project"; section: Section; group: ProjectGroup }
  | { sid: string; kind: "agent"; section: Section; agent: Agent }
  | { sid: string; kind: "server"; section: Section; server: DevServer }
  | { sid: string; kind: "wtitem"; section: Section; repo: RepoWorktrees; item: WorktreeItem }

export function App({
  snapshot,
  live = true,
  pollMs = 2000,
  demo = false,
  mark = false,
  initialOpen,
}: {
  snapshot?: Snapshot
  live?: boolean
  pollMs?: number
  /** mock-data showcase: static fleet, no real polling, but spinners still animate */
  demo?: boolean
  /** render the zadar mark before the wordmark (only when its font is installed) */
  mark?: boolean
  /** seed section fold state — used by the landing vignettes to focus each frame */
  initialOpen?: Partial<Record<Section, boolean>>
}) {
  const { width, height } = useTerminalDimensions()
  const renderer = useRenderer()
  const [snap, setSnap] = useState<Snapshot>(snapshot ?? emptySnapshot)
  const [selSid, setSelSid] = useState("h-queue")
  // active sessions lead the boot view only when nothing needs you; when the
  // queue has items, stay folded so the screen opens on what's urgent
  const [open, setOpen] = useState<Record<Section, boolean>>(() => ({
    queue: true,
    projects: false,
    sessions: snapshot ? attentionQueue(snapshot).length === 0 : false,
    servers: false,
    ...initialOpen,
  }))
  const [openRows, setOpenRows] = useState<Set<string>>(new Set())
  // compact tier: which lens fills the pane. Needs leads, unless the queue is clear.
  const [tab, setTab] = useState<Section>(() =>
    snapshot && attentionQueue(snapshot).length === 0 ? "sessions" : "queue",
  )
  const [confirm, setConfirm] = useState<{ label: string; run: () => void } | null>(null)
  const [toast, setToast] = useState("")
  const [help, setHelp] = useState(false)
  const [log, setLog] = useState(false)
  const [notifyOn, setNotifyOn] = useState(true)
  // reveal sessions that have gone dormant past STALE_SEC (hidden by default); `i`
  const [showIdle, setShowIdle] = useState(false)
  // reviews you've already gone to, keyed by id → the turn signature you saw.
  // Suppressed from the Needs queue + ◆ count for that turn only; a new turn or a
  // reply resurfaces it (see suppressAcked / pruneAcks).
  const [seenReady, setSeenReady] = useState<Map<string, number>>(new Map())
  const [updateVer, setUpdateVer] = useState<string | null>(null)
  // a newer release auto-pulled in the background — shown as "ready · restart to apply"
  const [pending, setPending] = useState<string | null>(() => (live ? pendingUpdate() : null))
  // whether this copy updates itself (a real binary / global install, not a dev checkout)
  const autoUpdates = useMemo(() => live && !process.env.ZADAR_NO_AUTO_UPDATE && updateChannel() !== "none", [live])
  // the flight recorder outlives the process — reload today's story on boot
  const [events, setEvents] = useState<Transition[]>(() => (live ? loadToday(Date.now()) : []))
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastIdx = useRef(0)
  const prevStatuses = useRef<Map<string, Agent["status"]> | null>(null)
  const sbRef = useRef<any>(null)
  const booted = useRef(false)

  // the derived view model recomputes when the data changes (once per poll),
  // not on every render — the 120ms spinner tick re-renders App ~16× per poll
  const {
    idleCount,
    visibleAgents,
    waiting,
    ready,
    reviewN,
    errorN,
    workingN,
    worstWait,
    fleetBurn,
    queue,
    groups,
    serverMem,
    staleN,
    dirtyN,
    presentStates,
    spinning,
  } = useMemo(() => {
    const now = Date.now()
    const visibleAgents = snap.agents.filter((a) => showIdle || isActive(a))
    // the Needs queue reflects what's UNseen — drop reviews you've gone to this turn
    const queue = suppressAcked(attentionQueue(snap), seenReady, now)
    return {
      idleCount: snap.agents.length - visibleAgents.length,
      visibleAgents,
      waiting: snap.agents.filter((a) => a.status === "waiting").length,
      // `ready` is the roster's truth (Sessions summary); `reviewN` is what still
      // needs review (the ◆ beacon) — a session you've seen drops from reviewN only
      ready: snap.agents.filter((a) => a.status === "ready").length,
      reviewN: snap.agents.filter((a) => a.status === "ready" && !isSeen(a, seenReady, now)).length,
      errorN: snap.agents.filter((a) => a.status === "error").length,
      workingN: snap.agents.filter((a) => a.status === "working").length,
      worstWait: Math.max(0, ...snap.agents.filter((a) => a.status === "waiting").map((a) => a.idleSec)),
      fleetBurn: snap.agents.reduce((n, a) => n + (a.burnPerHour ?? 0), 0),
      queue,
      groups: groupByProject(snap),
      serverMem: snap.servers.reduce((n, s) => n + s.memKB, 0),
      staleN: snap.servers.filter((s) => s.stale).length,
      dirtyN: snap.worktrees.reduce((n, w) => n + w.changed, 0),
      presentStates: new Set(snap.agents.map((a) => a.status)),
      spinning:
        queue.some((i) => i.kind === "question" || i.kind === "approval") ||
        snap.agents.some((a) => a.status === "working" && a.idleSec <= 3),
    }
  }, [snap, showIdle, seenReady])
  // the chrome reports the worst case — the wordmark is readable from across the room
  const beacon = errorN > 0 || worstWait > 300 ? color.danger : waiting > 0 ? color.attention : color.accent

  // release acks whose session left `ready` or advanced to a new turn, so a fresh
  // finished turn surfaces again (also bounds the map to live, ready sessions)
  useEffect(() => {
    setSeenReady((prev) => pruneAcks(prev, snap.agents, Date.now()))
  }, [snap])

  // one shared ticker — the sparkle (needs-you) and the braille work-glyph both
  // ride it. Runs only while something is genuinely in motion: a pending ask, or
  // a session whose transcript advanced this poll (the same gate AgentBlock spins on).
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if ((!live && !demo) || !spinning) return
    const id = setInterval(() => setTick((t) => t + 1), 120)
    return () => clearInterval(id)
  }, [live, demo, spinning])

  // sizing tiers — fleet lives in splits; rows and air adapt to the pane
  const cardWidth = Math.max(36, width - 7)
  const dense = height < 24
  const short = height < 14
  // the radar scope, not a readout: one lens fills the pane, each thing is a
  // single signal line, the rest are tabs. Auto, width-driven. The seam sits at
  // 75 — just above where the accordion degrades (drops branch names + ctx bars,
  // headers wrap) — so the scope owns the whole narrow-to-medium band and hands
  // off to the rich accordion only when there's genuine room.
  const compact = width < 75

  // the rows of a single lens — used by the compact tier and its tab switcher
  const buildSectionRows = (s: Section): Row[] => {
    if (s === "queue") return queue.map((it): Row => ({ sid: `q-${it.id}`, kind: "queue", section: "queue", item: it }))
    if (s === "sessions")
      return visibleAgents.map((a): Row => ({ sid: `a-${a.id}`, kind: "agent", section: "sessions", agent: a }))
    if (s === "servers")
      return snap.servers.map((sv): Row => ({ sid: `s-${sv.pid}`, kind: "server", section: "servers", server: sv }))
    return groups.map((g): Row => ({ sid: `pj-${g.key}`, kind: "project", section: "projects", group: g }))
  }

  // flattened, navigable rows — full: urgency first, then the world; compact: one lens
  const rows = useMemo<Row[]>(() => {
    if (compact) return buildSectionRows(tab)
    const rows: Row[] = []
    rows.push({ sid: "h-queue", kind: "header", section: "queue" })
    if (open.queue) queue.forEach((it) => rows.push({ sid: `q-${it.id}`, kind: "queue", section: "queue", item: it }))
    rows.push({ sid: "h-sessions", kind: "header", section: "sessions" })
    if (open.sessions)
      visibleAgents.forEach((a) => rows.push({ sid: `a-${a.id}`, kind: "agent", section: "sessions", agent: a }))
    rows.push({ sid: "h-servers", kind: "header", section: "servers" })
    if (open.servers)
      snap.servers.forEach((s) => rows.push({ sid: `s-${s.pid}`, kind: "server", section: "servers", server: s }))
    rows.push({ sid: "h-projects", kind: "header", section: "projects" })
    if (open.projects)
      groups.forEach((g) => {
        rows.push({ sid: `pj-${g.key}`, kind: "project", section: "projects", group: g })
        if (openRows.has(`pj-${g.key}`) && g.worktrees) {
          const w = g.worktrees
          w.items.forEach((it) =>
            rows.push({ sid: `wi-${w.repo}-${it.name}`, kind: "wtitem", section: "projects", repo: w, item: it }),
          )
        }
      })
    return rows
  }, [compact, tab, queue, groups, visibleAgents, snap.servers, open, openRows])

  // selection follows identity, not position — re-sorts never move it under you
  const found = rows.findIndex((r) => r.sid === selSid)
  const selIdx = found >= 0 ? found : Math.max(0, Math.min(lastIdx.current, rows.length - 1))
  lastIdx.current = selIdx
  const cur = rows[selIdx]
  const curSid = cur?.sid

  // compact vertical rhythm: Needs/Sessions earn a second context line when the
  // window is tall enough for every item to fit; the list breathes when there's
  // slack and tightens to single lines when crowded or short.
  const bodyRows = Math.max(4, height - 8)
  const compactTwoLine =
    compact && (tab === "queue" || tab === "sessions") && !short && rows.length > 0 && rows.length * 3 < bodyRows
  const compactGap = compact && rows.length > 0 && (compactTwoLine || rows.length * 2 <= bodyRows) ? 1 : 0

  const summaryFor = (s: Section): string => {
    if (s === "queue") return queue.length === 0 ? "clear" : `${queue.length} ${queue.length === 1 ? "item" : "items"}`
    if (s === "projects") {
      const cost = groups.reduce((n, g) => n + g.cost, 0)
      if (groups.length === 0) return "none"
      return `${groups.length}${dirtyN ? ` · ${dirtyN} dirty` : ""} · $${cost.toFixed(2)}`
    }
    if (s === "sessions") {
      if (snap.agents.length === 0) return "none"
      const parts = [`${visibleAgents.length} active`]
      if (waiting) parts.push(`${waiting} waiting`)
      if (ready) parts.push(`${ready} ready`)
      if (idleCount) parts.push(`${idleCount} idle`)
      return parts.join(" · ")
    }
    return snap.servers.length === 0
      ? "none"
      : `${snap.servers.length} · ${fmtMem(serverMem)}${staleN ? ` · ${staleN} stale` : ""}`
  }

  // map any row to its compact signal line — blip + name + type + age + context
  const toSignal = (r: Row): Signal => {
    if (r.kind === "queue") {
      const it = r.item
      const ask = it.kind === "question" || it.kind === "approval"
      const gcol = ask
        ? waitColor(it.ageSec)
        : it.kind === "error" || it.kind === "server-mem"
          ? color.danger
          : it.kind === "ready"
            ? color.positive
            : color.attention
      const g = ask ? "✻" : it.kind === "error" ? glyph.error : it.kind === "ready" ? glyph.ready : glyph.warn
      const ctx =
        it.kind === "ready" && it.agent?.diff && it.agent.diff.files > 0
          ? `+${it.agent.diff.plus} −${it.agent.diff.minus}`
          : it.title
      return {
        glyph: g,
        glyphColor: gcol,
        live: ask ? "sparkle" : null,
        name: it.project,
        typeWord: NEEDS_WORD[it.kind],
        typeColor: gcol,
        age: it.ageSec > 0 ? fmtDuration(it.ageSec) : undefined,
        context: ctx,
      }
    }
    if (r.kind === "agent") {
      const a = r.agent
      const name = a.wt ? `${a.project}/${a.wt}` : a.project
      // the roster's own identity — where it lives + what it's doing. Here the
      // glyph carries the state, so we drop the Needs-style review/asks/failed word
      // and diff; the disclosed detail still shows the full question / diff / vitals.
      const where = a.branch && a.branch !== a.wt && !/^(main|master)$/.test(a.branch) ? a.branch : undefined
      const doing = a.lastTool || a.task || a.lastActivity
      const context = where && doing ? `${where} · ${doing}` : doing || where
      if (a.status === "working")
        return { glyph: "⠋", glyphColor: a.idleSec <= 3 ? color.fg : color.dim, live: "work", name, context }
      if (a.status === "idle")
        return { glyph: glyph.idle, glyphColor: color.faint, name, age: fmtDuration(a.idleSec), context }
      if (a.status === "unknown") return { glyph: glyph.unknown, glyphColor: color.faint, name, context }
      // waiting / ready / error — state in the glyph + colour, identity in the line
      const gcol = a.status === "waiting" ? color.attention : a.status === "ready" ? color.positive : color.danger
      const g = a.status === "waiting" ? glyph.waiting : a.status === "ready" ? glyph.ready : glyph.error
      return { glyph: g, glyphColor: gcol, name, age: fmtDuration(a.idleSec), context }
    }
    if (r.kind === "server") {
      const s = r.server
      const heavy = s.memKB > 4 * 1024 * 1024
      const gcol = s.stale ? color.attention : heavy ? color.danger : color.positive
      return {
        glyph: s.stale || heavy ? glyph.warn : glyph.working,
        glyphColor: gcol,
        name: s.project,
        typeWord: s.stale ? "stale" : heavy ? "memory" : undefined,
        typeColor: gcol,
        context: `:${s.port} · ${fmtMem(s.memKB)}`,
      }
    }
    if (r.kind === "project") {
      const g = r.group
      const worst = g.worst ?? "idle"
      const word = worst === "waiting" ? "asks" : worst === "error" ? "failed" : worst === "ready" ? "review" : undefined
      const dirty = g.worktrees?.changed ?? 0
      return {
        glyph: statusGlyph(worst),
        glyphColor: statusColor(worst),
        name: g.key,
        typeWord: word,
        typeColor: statusColor(worst),
        context: `${fmtCost(g.cost)}${dirty ? ` · ${dirty} dirty` : ""}`,
      }
    }
    // header / wtitem never reach the compact lens — keep the type total
    return { glyph: glyph.unknown, glyphColor: color.faint, name: "" }
  }

  const flash = (m: string) => {
    setToast(m)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(""), 2800)
  }
  const refresh = async (silent = false) => {
    try {
      setSnap(await collect())
      if (!silent) flash("refreshed")
    } catch {
      /* keep last good */
    }
  }
  const quit = () => {
    try {
      renderer.destroy()
    } catch {
      /* ignore */
    }
    process.exit(0)
  }
  // the queue is pinned open — it's the whole point of the app, never foldable
  const toggleSection = (s: Section) => {
    if (s === "queue") return
    setOpen((o) => ({ ...o, [s]: !o[s] }))
  }
  // compact: jump to a lens (click or h/l), landing selection on its first row
  const focusTab = (s: Section) => {
    setTab(s)
    const first = buildSectionRows(s)[0]
    setSelSid(first ? first.sid : `t-${s}`)
  }
  const switchTab = (d: number) => focusTab(TABS[(TABS.indexOf(tab) + d + TABS.length) % TABS.length])
  const setRowOpen = (sid: string, v: boolean) =>
    setOpenRows((prev) => {
      const n = new Set(prev)
      if (v) n.add(sid)
      else n.delete(sid)
      return n
    })
  const move = (d: number) => {
    const next = rows[Math.max(0, Math.min(rows.length - 1, selIdx + d))]
    if (next) setSelSid(next.sid)
  }

  // the agent / server a row's actions apply to (queue items carry their target)
  const targetAgent = cur?.kind === "agent" ? cur.agent : cur?.kind === "queue" ? cur.item.agent : undefined
  const targetServer = cur?.kind === "server" ? cur.server : cur?.kind === "queue" ? cur.item.server : undefined

  // go to the thing itself: sessions focus their host app, servers open in the browser
  const goToAgent = (a: Agent) => {
    // going to a finished session IS reviewing it — drop its review from the queue now
    if (a.status === "ready") setSeenReady((prev) => new Map(prev).set(a.id, turnSig(a, Date.now())))
    flash("locating session…")
    void focusSession(a).then((dest) => flash(dest ? `opening ${dest}…` : "couldn't find the session's app"))
  }
  const goToServer = (s: DevServer) => {
    void openServer(s.port)
    flash(`opening localhost:${s.port}`)
  }
  const goToItem = (it: AttentionItem) => {
    if (it.agent) goToAgent(it.agent)
    else if (it.server) goToServer(it.server)
  }

  // one activation vocabulary — ⏎ and click, identical in both tiers: a header
  // folds, a queue item or server GOES (its app / browser), a session or project
  // discloses in place. The HUD has no headers/wtitems, so there ⏎ means go
  // (queue/server) or disclose (agent/project). Disclosure also lives on ←/→.
  const activate = (r: Row) => {
    if (r.kind === "header") toggleSection(r.section)
    else if (r.kind === "queue") goToItem(r.item)
    else if (r.kind === "server") goToServer(r.server)
    else if (r.kind !== "wtitem") setRowOpen(r.sid, !openRows.has(r.sid))
  }
  const clickRow = (sid: string) => (e: { button: number }) => {
    if (e.button !== 0) return
    setSelSid(sid)
    const r = rows.find((row) => row.sid === sid)
    if (r) activate(r)
  }

  // ambient update check — cached daily, silent on failure, never blocks
  useEffect(() => {
    if (!live) return
    void checkForUpdate().then(setUpdateVer).catch(() => {})
  }, [live])

  useEffect(() => {
    if (!live) return
    let on = true
    const tick = async () => {
      try {
        const s = await collect()
        if (!on) return
        setSnap(s)
        // surface a background auto-update the moment it lands (cheap marker read)
        if (autoUpdates) setPending(pendingUpdate())
        // on the first real snapshot, unfold active sessions if nothing needs you
        if (!booted.current) {
          booted.current = true
          if (initialOpen?.sessions === undefined && attentionQueue(s).length === 0) {
            setOpen((o) => ({ ...o, sessions: true }))
            setTab("sessions") // compact: open on the live fleet when nothing needs you
          }
        }
      } catch {
        /* keep last good snapshot */
      }
    }
    void tick()
    const id = setInterval(tick, pollMs)
    return () => {
      on = false
      clearInterval(id)
    }
  }, [live, pollMs])

  // keep the selected row in view as you navigate
  useEffect(() => {
    if (curSid) sbRef.current?.scrollChildIntoView?.(curSid)
  }, [curSid, rows.length])

  // flight recorder: record status flips (seed silently on the first snapshot)
  // + tap on the shoulder when an agent starts needing you
  useEffect(() => {
    if (snap.agents.length === 0 && !prevStatuses.current) return
    if (prevStatuses.current) {
      const trs = diffTransitions(prevStatuses.current, snap.agents, Date.now())
      if (trs.length) {
        setEvents((e) => [...e, ...trs].slice(-200))
        if (live) appendEvents(trs)
        if (live && notifyOn) {
          for (const tr of trs) {
            if (tr.from === undefined) continue // appearances aren't news
            if (tr.to !== "waiting" && tr.to !== "error") continue
            const a = snap.agents.find((x) => x.id === tr.id)
            const body = a?.question ?? (tr.to === "error" ? "turn failed" : "needs your input")
            void notify(`zadar — ${tr.project}`, body)
          }
        }
      }
    }
    prevStatuses.current = new Map(snap.agents.map((a) => [a.id, a.status]))
  }, [snap, live, notifyOn])

  useKeyboard((key) => {
    const k = key.name
    if (confirm) {
      if (k === "y") {
        confirm.run()
        setConfirm(null)
      } else if (k === "n" || k === "escape") setConfirm(null)
      return
    }
    if (help) {
      if (k === "?" || k === "escape") setHelp(false)
      else if (k === "q") quit()
      return
    }
    if (log) {
      if (k === "t" || k === "escape") setLog(false)
      else if (k === "q") quit()
      return
    }
    if (k === "?") return setHelp(true)
    if (k === "t") return setLog(true)

    if (k === "j" || k === "down") move(1)
    else if (k === "k" || k === "up") move(-1)
    // shifted letters arrive as lowercase name + shift flag
    else if (k === "g" || k === "G")
      setSelSid((k === "G" || key.shift ? rows[rows.length - 1] : rows[0])?.sid ?? rows[0]?.sid ?? "h-queue")
    // HUD: Tab cycles the lens band (←/→ are reserved for fold/expand, as below)
    else if (k === "tab" || k === "backtab") {
      if (compact) switchTab(k === "backtab" || key.shift ? -1 : 1)
    } else if (k === "right" || k === "l") {
      if (compact) {
        // HUD: ←/→ are the disclosure gesture (bands ride Tab); rows have no headers/wtitems
        if (cur && cur.kind !== "header" && cur.kind !== "wtitem") setRowOpen(cur.sid, true)
        return
      }
      if (!cur) return
      if (cur.kind === "header") {
        if (!open[cur.section]) toggleSection(cur.section)
        else move(1)
      } else if (cur.kind !== "wtitem") setRowOpen(cur.sid, true)
    } else if (k === "left" || k === "h") {
      if (compact) {
        if (cur && cur.kind !== "header" && cur.kind !== "wtitem") setRowOpen(cur.sid, false)
        return
      }
      if (!cur) return
      if (cur.kind === "header") {
        if (open[cur.section]) toggleSection(cur.section)
      } else if (cur.kind === "wtitem") setSelSid(`w-${cur.repo.repo}`)
      else if (openRows.has(cur.sid)) setRowOpen(cur.sid, false)
      else {
        const idx = rows.findIndex((r) => r.kind === "header" && r.section === cur.section)
        if (idx >= 0) setSelSid(rows[idx].sid)
      }
    } else if (k === "return") {
      if (cur) activate(cur)
    } else if (k === "space") {
      if (!cur) return
      // compact: space toggles the disclosed detail (no headers/wtitems here)
      if (compact) setRowOpen(cur.sid, !openRows.has(cur.sid))
      else if (cur.kind === "header") toggleSection(cur.section)
      else if (cur.kind !== "wtitem") setRowOpen(cur.sid, !openRows.has(cur.sid))
    } else if (k === "o") {
      if (targetAgent) goToAgent(targetAgent)
      else if (targetServer) goToServer(targetServer)
    } else if (k === "p") {
      if (cur?.kind === "wtitem") {
        const { repo, item } = cur
        if (item.dirty > 0) flash(`${item.dirty} dirty files — not pruning`)
        else if (snap.agents.some((a) => a.cwd === item.path)) flash(`an agent is running in ${item.name}`)
        else
          setConfirm({
            label: `prune ${repo.repo}/${item.name} (clean, ${item.ageDays === 0 ? "today" : `${item.ageDays}d`})?`,
            run: () => {
              void pruneWorktree(repo.path, item.path).then((ok) => {
                flash(ok ? `pruned ${item.name}` : `prune failed — ${item.name}`)
                invalidateWorktrees()
                void refresh(true)
              })
            },
          })
      }
    } else if (k === "i") {
      setShowIdle((v) => {
        flash(v ? "idle sessions hidden" : "showing idle sessions")
        return !v
      })
    } else if (k === "n") {
      setNotifyOn((v) => {
        flash(v ? "notifications off" : "notifications on")
        return !v
      })
    } else if (k === "c") {
      if (targetAgent) {
        void copyResume(targetAgent.id)
        flash(`copied  ${resumeCommand(targetAgent.id.slice(0, 8) + "…")}`)
      } else if (targetServer) {
        void copyText(`http://localhost:${targetServer.port}`)
        flash(`copied  localhost:${targetServer.port}`)
      }
    } else if (k === "x") {
      if (targetAgent) {
        const a = targetAgent
        setConfirm({
          label: `kill ${a.project} · pid ${a.pid}?`,
          run: () => {
            void killProcess(a.pid).then((ok) =>
              flash(ok ? `killed pid ${a.pid}` : `kill failed — pid ${a.pid} still alive`),
            )
          },
        })
      } else if (targetServer) {
        const s = targetServer
        setConfirm({
          label: `kill server :${s.port} · pid ${s.pid}?`,
          run: () => {
            void killProcess(s.pid).then((ok) =>
              flash(ok ? `killed :${s.port}` : `kill failed — :${s.port} still alive`),
            )
          },
        })
      }
    } else if (k === "r") {
      if (live) void refresh()
    } else if (k === "q") quit()
    // esc never quits — only cancels confirm/help
  })

  const primary = !cur
    ? "select"
    : cur.kind === "header"
      ? cur.section === "queue"
        ? "" // pinned — nothing to fold
        : open[cur.section]
          ? "fold"
          : "unfold"
      : cur.kind === "queue"
        ? "go"
        : cur.kind === "server"
          ? "browser"
          : cur.kind === "project"
            ? compact
              ? ""
              : openRows.has(cur.sid)
                ? "collapse"
                : "open"
            : cur.kind === "wtitem"
              ? "select"
              : compact
                ? "go"
                : openRows.has(cur.sid)
                  ? "collapse"
                  : "details"

  // the footer speaks to the selection on the left; system keys tuck right.
  // inside an overlay there is exactly one move: back.
  const inOverlay = help || log
  const ctxHints: Hint[] = (() => {
    if (short || inOverlay) return []
    const h: Hint[] = []
    if (compact) {
      h.push(["tab", "switch"])
      // show the direction that does something: → unfolds a closed row, ← folds an open one
      if (cur) h.push(openRows.has(cur.sid) ? ["←", "fold"] : ["→", "unfold"])
      if (cur?.kind === "queue") h.push(["⏎", "go"])
      else if (cur?.kind === "server") h.push(["⏎", "browser"])
      else if (cur?.kind === "agent") h.push(["o", "open"])
      // only a server gets a copy hint (its URL); `c` still copies a session's resume cmd, just unadvertised
      if (targetServer) h.push(["c", "copy"])
      if (targetAgent || targetServer) h.push(["x", "kill"])
      return h
    }
    if (cur && cur.kind !== "wtitem" && primary) h.push(["⏎", primary])
    if (cur?.kind === "queue" || cur?.kind === "server")
      h.push(["␣", openRows.has(cur.sid) ? "collapse" : "inspect"])
    if (cur?.kind === "agent") h.push(["o", "open"])
    if (targetServer) h.push(["c", "copy"])
    if (targetAgent || targetServer) h.push(["x", "kill"])
    if (cur?.kind === "wtitem") h.push(["p", "prune"])
    return h
  })()
  // compact has no room for "? help" on the right — keep the band/fold hints on the
  // left visible and let the help overlay carry the rest (? still works)
  const sysHints: Hint[] = inOverlay
    ? [["esc", "back"]]
    : compact
      ? [["q", "quit"]]
      : [
          ["?", "help"],
          ["q", "quit"],
        ]

  const renderAgent = (a: Agent) => (
    <box key={`a-${a.id}`} id={`a-${a.id}`} onMouseDown={clickRow(`a-${a.id}`)}>
      {/* tick only reaches blocks that animate — everything else memo-bails on spinner frames */}
      <AgentBlock
        agent={a}
        selected={curSid === `a-${a.id}`}
        expanded={openRows.has(`a-${a.id}`)}
        width={cardWidth}
        tick={a.status === "working" && a.idleSec <= 3 ? tick : 0}
      />
    </box>
  )
  const renderServer = (s: DevServer) => (
    <box key={`s-${s.pid}`} id={`s-${s.pid}`} onMouseDown={clickRow(`s-${s.pid}`)}>
      <ServerCard server={s} selected={curSid === `s-${s.pid}`} expanded={openRows.has(`s-${s.pid}`)} width={cardWidth} />
    </box>
  )
  return (
    <box flexDirection="column" width={width} height={height} paddingLeft={2} paddingRight={2}>
      {/* header — the beacon: wordmark tints to the worst case, counts tell the story */}
      <box flexShrink={0} flexDirection="row" justifyContent="space-between" paddingTop={dense ? 0 : 1}>
        <text>
          <span fg={beacon} attributes={TextAttributes.BOLD}>
            {mark ? `${icon.mark} ` : ""}zadar
          </span>
          {waiting > 0 && <span fg={color.attention}>{`  ▲${waiting}`}</span>}
          {errorN > 0 && <span fg={color.danger}>{`  ✕${errorN}`}</span>}
          {reviewN > 0 && <span fg={color.positive}>{`  ◆${reviewN}`}</span>}
          {/* working is calm — drop the count in compact, keep the actionable ones */}
          {!compact && workingN > 0 && <span fg={color.dim}>{`  ●${workingN}`}</span>}
        </text>
        <text>
          {pending ? (
            <span fg={color.positive}>{`${icon.up} ${pending} ready  `}</span>
          ) : updateVer ? (
            <span fg={color.faint}>{`${icon.up} ${updateVer}  `}</span>
          ) : null}
          {/* burn is the least urgent number and the prime collision source — drop it compact */}
          {!compact && fleetBurn >= 0.05 && (
            <span>
              <Stat s={`$${fleetBurn.toFixed(1)}/h`} />
              <span fg={color.dim}>{" · "}</span>
            </span>
          )}
          <span fg={color.dim}>{snap.time || "…"}</span>
        </text>
      </box>
      <Rule />

      {/* middle — one scrolling accordion of collapsible sections */}
      <box flexGrow={1} flexBasis={0} minHeight={0} flexDirection="column" paddingTop={dense ? 0 : 1}>
        {help ? (
          <HelpOverlay version={VERSION} updateVer={updateVer} pending={pending} autoUpdates={autoUpdates} />
        ) : log ? (
          <EventLog events={events} maxRows={height - 8} />
        ) : compact ? (
          // the radar scope: one lens, signal lines that breathe with the height
          <scrollbox ref={sbRef} scrollY flexGrow={1} flexBasis={0} minHeight={0} contentOptions={{ gap: compactGap }}>
            {rows.length ? (
              rows.map((r) => {
                const sig = toSignal(r)
                const open = openRows.has(r.sid)
                return (
                  <box key={r.sid} flexDirection="column">
                    <box id={r.sid} onMouseDown={clickRow(r.sid)}>
                      <SignalLine
                        signal={sig}
                        selected={curSid === r.sid}
                        width={cardWidth}
                        twoLine={compactTwoLine}
                        expanded={open}
                        tick={sig.live ? tick : 0}
                      />
                    </box>
                    {open && (
                      <SignalDetail
                        agent={r.kind === "agent" ? r.agent : r.kind === "queue" ? r.item.agent : undefined}
                        server={r.kind === "server" ? r.server : r.kind === "queue" ? r.item.server : undefined}
                        group={r.kind === "project" ? r.group : undefined}
                        width={cardWidth}
                      />
                    )}
                  </box>
                )
              })
            ) : tab === "queue" ? (
              <text>
                <span fg={color.positive}>{`${glyph.check} `}</span>
                <span fg={color.dim}>nothing needs you</span>
              </text>
            ) : (
              <text fg={color.dim}>
                {tab === "sessions" ? "no active sessions" : tab === "servers" ? "no dev servers" : "no projects"}
              </text>
            )}
          </scrollbox>
        ) : (
          <scrollbox ref={sbRef} scrollY flexGrow={1} flexBasis={0} minHeight={0} contentOptions={{ gap: dense ? 0 : 1 }}>
            <>
                <Pillar
                  id="h-queue"
                  onHeaderMouseDown={clickRow("h-queue")}
                  label={LABEL.queue}
                  summary={summaryFor("queue")}
                  expanded={open.queue}
                  selected={curSid === "h-queue"}
                  dense={dense}
                  pinned
                >
                  {queue.length === 0 ? (
                    <text>
                      <span fg={color.positive}>{`${glyph.check} `}</span>
                      <span fg={color.dim}>
                        nothing needs you
                        {events.length > 0
                          ? ` · ${events.length} ${events.length === 1 ? "flip" : "flips"} today`
                          : ""}
                      </span>
                    </text>
                  ) : (
                    queue.map((it) => (
                      <box key={`q-${it.id}`} flexDirection="column">
                        <box id={`q-${it.id}`} onMouseDown={clickRow(`q-${it.id}`)}>
                          <QueueItem
                            item={it}
                            selected={curSid === `q-${it.id}`}
                            width={cardWidth}
                            tick={it.kind === "question" || it.kind === "approval" ? tick : 0}
                          />
                        </box>
                        {openRows.has(`q-${it.id}`) && it.agent ? (
                          <QueueDetail agent={it.agent} width={cardWidth} />
                        ) : openRows.has(`q-${it.id}`) && it.server ? (
                          <box paddingTop={dense ? 0 : 1}>
                            <ServerCard server={it.server} expanded width={cardWidth} />
                          </box>
                        ) : null}
                      </box>
                    ))
                  )}
                </Pillar>

                <Pillar
                  id="h-sessions"
                  onHeaderMouseDown={clickRow("h-sessions")}
                  label={LABEL.sessions}
                  summary={summaryFor("sessions")}
                  expanded={open.sessions}
                  selected={curSid === "h-sessions"}
                  dense={dense}
                >
                  {visibleAgents.length ? visibleAgents.map(renderAgent) : null}
                </Pillar>

                <Pillar
                  id="h-servers"
                  onHeaderMouseDown={clickRow("h-servers")}
                  label={LABEL.servers}
                  summary={summaryFor("servers")}
                  expanded={open.servers}
                  selected={curSid === "h-servers"}
                  dense={dense}
                >
                  {snap.servers.length ? snap.servers.map(renderServer) : null}
                </Pillar>

                <Pillar
                  id="h-projects"
                  onHeaderMouseDown={clickRow("h-projects")}
                  label={LABEL.projects}
                  summary={summaryFor("projects")}
                  expanded={open.projects}
                  selected={curSid === "h-projects"}
                  dense={dense}
                >
                  {groups.length
                    ? groups.map((g) => (
                        <box key={`pj-${g.key}`} flexDirection="column">
                          <box id={`pj-${g.key}`} onMouseDown={clickRow(`pj-${g.key}`)}>
                            <ProjectCard
                              group={g}
                              selected={curSid === `pj-${g.key}`}
                              expanded={openRows.has(`pj-${g.key}`)}
                              width={cardWidth}
                            />
                          </box>
                          {openRows.has(`pj-${g.key}`) && g.worktrees
                            ? g.worktrees.items.map((it) => (
                                <box
                                  key={`wi-${g.key}-${it.name}`}
                                  id={`wi-${g.worktrees!.repo}-${it.name}`}
                                  onMouseDown={clickRow(`wi-${g.worktrees!.repo}-${it.name}`)}
                                >
                                  <WorktreeItemRow
                                    item={it}
                                    repo={g.worktrees!.repo}
                                    selected={curSid === `wi-${g.worktrees!.repo}-${it.name}`}
                                    width={cardWidth}
                                  />
                                </box>
                              ))
                            : null}
                        </box>
                      ))
                    : null}
                </Pillar>
            </>
          </scrollbox>
        )}
      </box>

      {/* footer */}
      <box flexShrink={0} flexDirection="column">
        {compact && !log ? (
          <box height={1} flexDirection="row">
            <TabBar tabs={TABS.map((s) => ({ key: s, label: LABEL_COMPACT[s] }))} active={tab} onTab={(k) => focusTab(k as Section)} />
          </box>
        ) : !short && !dense && !log ? (
          <box height={1} flexDirection="row">
            <StateLegend present={presentStates} />
          </box>
        ) : null}
        <Rule />
        <box paddingBottom={dense ? 0 : 1}>
          {confirm ? (
            <text>
              <span fg={color.attention}>{confirm.label}</span>
              <span fg={color.dim}>{"   "}y / n</span>
            </text>
          ) : (
            <Footer left={ctxHints} right={sysHints} toast={toast} width={width - 4} />
          )}
        </box>
      </box>
    </box>
  )
}
