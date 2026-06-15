import type { ReactNode } from "react"
import { color } from "../theme"
import { clip, fmtCost, fmtDuration, fmtMem, fmtTokens, shorten, wrapText } from "../format"
import { Keycap } from "./Keycap"
import type { Agent, DevServer } from "../types"
import type { ProjectGroup } from "../fleetmap"

/**
 * The disclosed detail under a HUD signal line (←/→ to fold). Mode-native: a few
 * left-aligned, distilled lines — never the full-view's right-column vitals. Shows
 * the fuller story for whichever entity the row carries.
 */
export function SignalDetail({
  agent,
  server,
  group,
  width,
}: {
  agent?: Agent
  server?: DevServer
  group?: ProjectGroup
  width: number
}) {
  const w = Math.max(12, width - 3)
  const out: ReactNode[] = []
  const line = (key: string, node: ReactNode) => out.push(<text key={key}>{node}</text>)
  const dim = (key: string, s: string, max = 2) =>
    wrapText(s, w, max).forEach((l, i) => out.push(<text key={`${key}${i}`} fg={color.dim}>{l}</text>))

  if (agent) {
    const a = agent
    // the literal ask, untruncated, plus the answer chips
    if (a.waitKind === "question" && a.question)
      wrapText(`“${a.question}”`, w, 3).forEach((l, i) => out.push(<text key={`q${i}`} fg={color.fg}>{l}</text>))
    if (a.options?.length)
      line(
        "opts",
        a.options.slice(0, 9).map((o, i) => (
          <span key={o}>
            <Keycap k={String(i + 1)} />
            <span fg={color.dim}>{` ${o}   `}</span>
          </span>
        )),
      )
    if (a.task) dim("task", `task  ${a.task}`)
    if (a.lastTool) dim("now", `${a.status === "working" ? "now" : "last"}  ${a.lastTool}`, 1)
    if (a.lastSaid) dim("said", `said  “${a.lastSaid}”`, 1)
    if (a.diff && a.diff.files > 0)
      line(
        "built",
        <span>
          <span fg={color.dim}>built </span>
          <span fg={color.positive}>+{a.diff.plus}</span>
          <span fg={color.danger}> −{a.diff.minus}</span>
          <span fg={color.dim}>{` · ${a.diff.files} ${a.diff.files === 1 ? "file" : "files"}`}</span>
        </span>,
      )
    line(
      "vitals",
      <span fg={color.dim}>
        {clip(`${a.model} · ${fmtTokens(a.tokens)} tok · ${fmtCost(a.costUsd)} · ${fmtDuration(a.uptimeSec)} · ${Math.round(a.contextPct)}% ctx`, w)}
      </span>,
    )
    out.push(<text key="cwd" fg={color.faint}>{clip(shorten(a.cwd), w)}</text>)
  } else if (server) {
    const s = server
    line("mem", <span fg={color.dim}>{clip(`:${s.port} ${s.project} · ${fmtMem(s.memKB)} · up ${s.uptime}`, w)}</span>)
    line("pid", <span fg={color.dim}>{`pid ${s.pid}${s.stale ? " · worktree gone" : ""}`}</span>)
    if (s.cwd) out.push(<text key="cwd" fg={color.faint}>{clip(shorten(s.cwd), w)}</text>)
  } else if (group) {
    const g = group
    const parts: string[] = []
    if (g.agents.length) parts.push(`${g.agents.length} ${g.agents.length === 1 ? "session" : "sessions"}`)
    if (g.servers.length) parts.push(`${g.servers.length} ${g.servers.length === 1 ? "server" : "servers"}`)
    if (g.worktrees) parts.push(`${g.worktrees.total} ${g.worktrees.total === 1 ? "tree" : "trees"}${g.worktrees.changed ? ` · ${g.worktrees.changed} dirty` : ""}`)
    if (parts.length) line("make", <span fg={color.dim}>{clip(parts.join(" · "), w)}</span>)
    line("cost", <span fg={color.dim}>{`${fmtCost(g.cost)}${g.burn >= 0.05 ? ` · $${g.burn.toFixed(1)}/h` : ""}`}</span>)
  }

  return (
    <box flexDirection="column" paddingLeft={3} paddingBottom={1}>
      {out}
    </box>
  )
}
