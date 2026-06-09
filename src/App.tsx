import { useEffect, useRef, useState } from "react"
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react"
import { collect, emptySnapshot } from "./collect"
import type { Agent, DevServer, RepoWorktrees, Snapshot } from "./types"
import { copyResume, copyText, killProcess, resumeCommand } from "./actions"
import { color } from "./theme"
import { fmtMem } from "./format"
import { AgentBlock } from "./components/AgentBlock"
import { ServerCard } from "./components/ServerCard"
import { WorktreeCard } from "./components/WorktreeCard"
import { Pillar } from "./components/Pillar"
import { Rule } from "./components/Rule"
import { Footer } from "./components/Footer"
import { HelpOverlay } from "./components/HelpOverlay"
import { TextAttributes } from "@opentui/core"

// Hide only genuinely-dormant sessions. A session you touched recently — even if
// it just finished a turn and is awaiting you — stays visible. Toggle with `i`.
const STALE_SEC = 20 * 60
const isActive = (a: Agent) => a.status !== "idle" || a.idleSec < STALE_SEC

type Section = "agents" | "servers" | "worktrees"
const LABEL: Record<Section, string> = { agents: "AGENTS", servers: "SERVERS", worktrees: "WORKTREES" }

type Row =
  | { sid: string; kind: "header"; section: Section }
  | { sid: string; kind: "agent"; section: Section; agent: Agent }
  | { sid: string; kind: "server"; section: Section; server: DevServer }
  | { sid: string; kind: "worktree"; section: Section; wt: RepoWorktrees }

export function App({
  snapshot,
  live = true,
  pollMs = 2000,
}: {
  snapshot?: Snapshot
  live?: boolean
  pollMs?: number
}) {
  const { width, height } = useTerminalDimensions()
  const renderer = useRenderer()
  const [snap, setSnap] = useState<Snapshot>(snapshot ?? emptySnapshot)
  const [selSid, setSelSid] = useState("h-agents")
  const [open, setOpen] = useState<Record<Section, boolean>>({ agents: true, servers: false, worktrees: false })
  const [openRows, setOpenRows] = useState<Set<string>>(new Set())
  const [confirm, setConfirm] = useState<{ label: string; run: () => void } | null>(null)
  const [toast, setToast] = useState("")
  const [help, setHelp] = useState(false)
  const [showIdle, setShowIdle] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastIdx = useRef(0)
  const sbRef = useRef<any>(null)

  const idleCount = snap.agents.filter((a) => !isActive(a)).length
  const visibleAgents = showIdle ? snap.agents : snap.agents.filter(isActive)
  const waiting = snap.agents.filter((a) => a.status === "waiting").length
  const ready = snap.agents.filter((a) => a.status === "ready").length

  // sizing tiers — fleet lives in splits; rows and air adapt to the pane
  const cardWidth = Math.max(36, width - 7)
  const dense = height < 24
  const short = height < 14

  // flattened, navigable rows — section headers plus the items of expanded sections
  const rows: Row[] = [{ sid: "h-agents", kind: "header", section: "agents" }]
  if (open.agents) visibleAgents.forEach((a) => rows.push({ sid: `a-${a.id}`, kind: "agent", section: "agents", agent: a }))
  rows.push({ sid: "h-servers", kind: "header", section: "servers" })
  if (open.servers) snap.servers.forEach((s) => rows.push({ sid: `s-${s.pid}`, kind: "server", section: "servers", server: s }))
  rows.push({ sid: "h-worktrees", kind: "header", section: "worktrees" })
  if (open.worktrees) snap.worktrees.forEach((w) => rows.push({ sid: `w-${w.repo}`, kind: "worktree", section: "worktrees", wt: w }))

  // selection follows identity, not position — re-sorts never move it under you
  const found = rows.findIndex((r) => r.sid === selSid)
  const selIdx = found >= 0 ? found : Math.max(0, Math.min(lastIdx.current, rows.length - 1))
  lastIdx.current = selIdx
  const cur = rows[selIdx]
  const curSid = cur?.sid

  const serverMem = snap.servers.reduce((n, s) => n + s.memKB, 0)
  const staleN = snap.servers.filter((s) => s.stale).length
  const dirtyN = snap.worktrees.reduce((n, w) => n + w.changed, 0)
  const summaryFor = (s: Section): string => {
    if (s === "agents") {
      if (snap.agents.length === 0) return "none"
      const parts = [`${visibleAgents.length} active`]
      if (waiting) parts.push(`${waiting} waiting`)
      if (ready) parts.push(`${ready} ready`)
      if (idleCount && !showIdle) parts.push(`${idleCount} idle`)
      return parts.join(" · ")
    }
    if (s === "servers")
      return snap.servers.length === 0
        ? "none"
        : `${snap.servers.length} · ${fmtMem(serverMem)}${staleN ? ` · ${staleN} stale` : ""}`
    return snap.worktrees.length === 0 ? "none" : `${snap.worktrees.length} repos · ${dirtyN} dirty`
  }

  const flash = (m: string) => {
    setToast(m)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(""), 2800)
  }
  const refresh = async () => {
    try {
      setSnap(await collect())
      flash("refreshed")
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
  const toggleSection = (s: Section) => setOpen((o) => ({ ...o, [s]: !o[s] }))
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

  useEffect(() => {
    if (!live) return
    let on = true
    const tick = async () => {
      try {
        const s = await collect()
        if (on) setSnap(s)
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
    if (k === "?") return setHelp(true)

    if (k === "j" || k === "down") move(1)
    else if (k === "k" || k === "up") move(-1)
    else if (k === "g") setSelSid(rows[0]?.sid ?? "h-agents")
    else if (k === "G") setSelSid(rows[rows.length - 1]?.sid ?? "h-agents")
    else if (k === "right" || k === "l") {
      if (!cur) return
      if (cur.kind === "header") {
        if (!open[cur.section]) toggleSection(cur.section)
        else move(1)
      } else if (cur.kind !== "worktree") setRowOpen(cur.sid, true)
    } else if (k === "left" || k === "h") {
      if (!cur) return
      if (cur.kind === "header") {
        if (open[cur.section]) toggleSection(cur.section)
      } else if (openRows.has(cur.sid)) setRowOpen(cur.sid, false)
      else {
        const idx = rows.findIndex((r) => r.kind === "header" && r.section === cur.section)
        if (idx >= 0) setSelSid(rows[idx].sid)
      }
    } else if (k === "i") setShowIdle((v) => !v)
    else if (k === "return" || k === "space") {
      if (!cur) return
      if (cur.kind === "header") toggleSection(cur.section)
      else if (cur.kind !== "worktree") setRowOpen(cur.sid, !openRows.has(cur.sid))
    } else if (k === "c") {
      if (cur?.kind === "agent") {
        void copyResume(cur.agent.id)
        flash(`copied  ${resumeCommand(cur.agent.id.slice(0, 8) + "…")}`)
      } else if (cur?.kind === "server") {
        void copyText(`http://localhost:${cur.server.port}`)
        flash(`copied  localhost:${cur.server.port}`)
      }
    } else if (k === "x") {
      if (cur?.kind === "agent")
        setConfirm({
          label: `kill ${cur.agent.project} · pid ${cur.agent.pid}?`,
          run: () => {
            void killProcess(cur.agent.pid).then((ok) =>
              flash(ok ? `killed pid ${cur.agent.pid}` : `kill failed — pid ${cur.agent.pid} still alive`),
            )
          },
        })
      else if (cur?.kind === "server")
        setConfirm({
          label: `kill server :${cur.server.port} · pid ${cur.server.pid}?`,
          run: () => {
            void killProcess(cur.server.pid).then((ok) =>
              flash(ok ? `killed :${cur.server.port}` : `kill failed — :${cur.server.port} still alive`),
            )
          },
        })
    } else if (k === "r") {
      if (live) void refresh()
    } else if (k === "q") quit()
    // esc never quits — only cancels confirm/help
  })

  const primary = !cur
    ? "select"
    : cur.kind === "header"
      ? open[cur.section]
        ? "fold"
        : "unfold"
      : cur.kind === "worktree"
        ? "select"
        : openRows.has(cur.sid)
          ? "collapse"
          : "details"

  const hints: [string, string][] = short
    ? [["?", "help"]]
    : (() => {
        const h: [string, string][] = [["↑↓", "move"], ["⏎", primary]]
        if (cur?.kind === "agent" || cur?.kind === "server") h.push(["c", "copy"], ["x", "kill"])
        if (idleCount > 0 || showIdle) h.push(["i", showIdle ? "hide idle" : `+${idleCount} idle`])
        h.push(["?", "help"], ["q", "quit"])
        return h
      })()

  return (
    <box flexDirection="column" width={width} height={height} paddingLeft={2} paddingRight={2}>
      {/* header */}
      <box flexShrink={0} flexDirection="row" justifyContent="space-between" paddingTop={dense ? 0 : 1}>
        <text>
          <span fg={color.accent} attributes={TextAttributes.BOLD}>
            fleet
          </span>
        </text>
        <text fg={color.dim}>{snap.time || "…"}</text>
      </box>
      <Rule />

      {/* middle — one scrolling accordion of collapsible sections */}
      <box flexGrow={1} flexBasis={0} minHeight={0} flexDirection="column" paddingTop={dense ? 0 : 1}>
        {help ? (
          <HelpOverlay />
        ) : (
          <scrollbox ref={sbRef} scrollY flexGrow={1} flexBasis={0} minHeight={0} contentOptions={{ gap: dense ? 0 : 1 }}>
            <Pillar
              id="h-agents"
              label={LABEL.agents}
              summary={summaryFor("agents")}
              expanded={open.agents}
              selected={curSid === "h-agents"}
              dense={dense}
            >
              {visibleAgents.length
                ? visibleAgents.map((a) => (
                    <box key={`a-${a.id}`} id={`a-${a.id}`}>
                      <AgentBlock
                        agent={a}
                        selected={curSid === `a-${a.id}`}
                        expanded={openRows.has(`a-${a.id}`)}
                        width={cardWidth}
                      />
                    </box>
                  ))
                : null}
            </Pillar>

            <Pillar
              id="h-servers"
              label={LABEL.servers}
              summary={summaryFor("servers")}
              expanded={open.servers}
              selected={curSid === "h-servers"}
              dense={dense}
            >
              {snap.servers.length
                ? snap.servers.map((s) => (
                    <box key={`s-${s.pid}`} id={`s-${s.pid}`}>
                      <ServerCard
                        server={s}
                        selected={curSid === `s-${s.pid}`}
                        expanded={openRows.has(`s-${s.pid}`)}
                        width={cardWidth}
                      />
                    </box>
                  ))
                : null}
            </Pillar>

            <Pillar
              id="h-worktrees"
              label={LABEL.worktrees}
              summary={summaryFor("worktrees")}
              expanded={open.worktrees}
              selected={curSid === "h-worktrees"}
              dense={dense}
            >
              {snap.worktrees.length
                ? snap.worktrees.map((w) => (
                    <box key={`w-${w.repo}`} id={`w-${w.repo}`}>
                      <WorktreeCard wt={w} selected={curSid === `w-${w.repo}`} />
                    </box>
                  ))
                : null}
            </Pillar>
          </scrollbox>
        )}
      </box>

      {/* footer */}
      <box flexShrink={0} flexDirection="column">
        <Rule />
        <box paddingBottom={dense ? 0 : 1}>
          {confirm ? (
            <text>
              <span fg={color.attention}>{confirm.label}</span>
              <span fg={color.dim}>{"   "}y / n</span>
            </text>
          ) : (
            <Footer hints={hints} toast={toast} />
          )}
        </box>
      </box>
    </box>
  )
}
