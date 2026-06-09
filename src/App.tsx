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
  const [sel, setSel] = useState(0)
  const [open, setOpen] = useState<Record<Section, boolean>>({ agents: true, servers: false, worktrees: false })
  const [confirm, setConfirm] = useState<{ label: string; run: () => void } | null>(null)
  const [toast, setToast] = useState("")
  const [help, setHelp] = useState(false)
  const [showIdle, setShowIdle] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sbRef = useRef<any>(null)

  const idleCount = snap.agents.filter((a) => !isActive(a)).length
  const visibleAgents = showIdle ? snap.agents : snap.agents.filter(isActive)
  const waiting = snap.agents.filter((a) => a.status === "waiting").length
  const compact = width < 64

  // flattened, navigable rows — section headers plus the items of expanded sections
  const rows: Row[] = [{ sid: "h-agents", kind: "header", section: "agents" }]
  if (open.agents) visibleAgents.forEach((a) => rows.push({ sid: `a-${a.id}`, kind: "agent", section: "agents", agent: a }))
  rows.push({ sid: "h-servers", kind: "header", section: "servers" })
  if (open.servers) snap.servers.forEach((s) => rows.push({ sid: `s-${s.pid}`, kind: "server", section: "servers", server: s }))
  rows.push({ sid: "h-worktrees", kind: "header", section: "worktrees" })
  if (open.worktrees) snap.worktrees.forEach((w) => rows.push({ sid: `w-${w.repo}`, kind: "worktree", section: "worktrees", wt: w }))

  const selSafe = Math.min(sel, rows.length - 1)
  const cur = rows[selSafe]
  const selSid = cur?.sid

  const serverMem = snap.servers.reduce((n, s) => n + s.memKB, 0)
  const staleN = snap.servers.filter((s) => s.stale).length
  const dirtyN = snap.worktrees.reduce((n, w) => n + w.changed, 0)
  const summaryFor = (s: Section): string => {
    if (s === "agents")
      return snap.agents.length === 0
        ? "none"
        : `${visibleAgents.length} active${waiting ? ` · ${waiting} waiting` : ""}${idleCount ? ` · ${idleCount} idle` : ""}`
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
  const toggle = (s: Section) => setOpen((o) => ({ ...o, [s]: !o[s] }))

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
    const id = rows[selSafe]?.sid
    if (id) sbRef.current?.scrollChildIntoView?.(id)
  }, [selSafe, rows.length])

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

    if (k === "j" || k === "down") setSel((s) => Math.min(s + 1, rows.length - 1))
    else if (k === "k" || k === "up") setSel((s) => Math.max(s - 1, 0))
    else if (k === "g") setSel(0)
    else if (k === "G") setSel(rows.length - 1)
    else if (k === "right" || k === "l") {
      // expand a collapsed section, or step into its content
      if (cur?.kind === "header") {
        if (!open[cur.section]) toggle(cur.section)
        else setSel((s) => Math.min(s + 1, rows.length - 1))
      }
    } else if (k === "left" || k === "h") {
      // collapse an expanded section, or jump from an item up to its header
      if (cur?.kind === "header") {
        if (open[cur.section]) toggle(cur.section)
      } else if (cur) {
        const idx = rows.findIndex((r) => r.kind === "header" && r.section === cur.section)
        if (idx >= 0) setSel(idx)
      }
    } else if (k === "i") setShowIdle((v) => !v)
    else if (k === "return" || k === "space") {
      if (!cur) return
      if (cur.kind === "header") toggle(cur.section)
      else if (cur.kind === "agent") {
        void copyResume(cur.agent.id)
        flash(`copied  ${resumeCommand(cur.agent.id.slice(0, 8) + "…")}`)
      } else if (cur.kind === "server") {
        void copyText(`http://localhost:${cur.server.port}`)
        flash(`copied  localhost:${cur.server.port}`)
      }
    } else if (k === "c") {
      if (cur?.kind === "agent") {
        void copyResume(cur.agent.id)
        flash("copied resume")
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
        ? "collapse"
        : "expand"
      : cur.kind === "agent"
        ? "copy"
        : cur.kind === "server"
          ? "copy url"
          : "select"

  return (
    <box flexDirection="column" width={width} height={height} padding={1}>
      <box
        flexGrow={1}
        flexDirection="column"
        border
        borderStyle="rounded"
        borderColor={color.faint}
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
      >
        {/* header */}
        <box flexDirection="row" justifyContent="space-between">
          <text>
            <span fg={color.accent} attributes={TextAttributes.BOLD}>
              fleet
            </span>
          </text>
          <text fg={color.dim}>{snap.time || "…"}</text>
        </box>

        <box paddingTop={1}>
          <Rule />
        </box>

        {/* middle — one scrolling accordion of collapsible sections */}
        <box flexGrow={1} flexBasis={0} minHeight={0} flexDirection="column" paddingTop={1}>
          {help ? (
            <HelpOverlay />
          ) : (
            <scrollbox ref={sbRef} scrollY flexGrow={1} flexBasis={0} minHeight={0} contentOptions={{ gap: 1 }}>
              <Pillar
                id="h-agents"
                label={LABEL.agents}
                summary={summaryFor("agents")}
                expanded={open.agents}
                selected={selSid === "h-agents"}
              >
                {visibleAgents.length
                  ? visibleAgents.map((a) => (
                      <box key={`a-${a.id}`} id={`a-${a.id}`}>
                        <AgentBlock agent={a} selected={selSid === `a-${a.id}`} />
                      </box>
                    ))
                  : null}
              </Pillar>

              <Pillar
                id="h-servers"
                label={LABEL.servers}
                summary={summaryFor("servers")}
                expanded={open.servers}
                selected={selSid === "h-servers"}
              >
                {snap.servers.length
                  ? snap.servers.map((s) => (
                      <box key={`s-${s.pid}`} id={`s-${s.pid}`}>
                        <ServerCard server={s} selected={selSid === `s-${s.pid}`} compact={compact} />
                      </box>
                    ))
                  : null}
              </Pillar>

              <Pillar
                id="h-worktrees"
                label={LABEL.worktrees}
                summary={summaryFor("worktrees")}
                expanded={open.worktrees}
                selected={selSid === "h-worktrees"}
              >
                {snap.worktrees.length
                  ? snap.worktrees.map((w) => (
                      <box key={`w-${w.repo}`} id={`w-${w.repo}`}>
                        <WorktreeCard wt={w} selected={selSid === `w-${w.repo}`} />
                      </box>
                    ))
                  : null}
              </Pillar>
            </scrollbox>
          )}
        </box>

        {/* footer */}
        <box flexShrink={0} flexDirection="column" paddingTop={1}>
          <Rule />
          <box paddingTop={1}>
            {confirm ? (
              <text>
                <span fg={color.attention}>{confirm.label}</span>
                <span fg={color.dim}>{"   "}y / n</span>
              </text>
            ) : (
              <Footer toast={toast} primary={primary} />
            )}
          </box>
        </box>
      </box>
    </box>
  )
}
