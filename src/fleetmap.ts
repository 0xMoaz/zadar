import type { Agent, AgentStatus, DevServer, RepoWorktrees, Snapshot } from "./types"
import { fmtMem } from "./format"
import { basename } from "node:path"

/** Sessions inside .claude/worktrees/<wt> belong to the parent repo — keep both names. */
export function identityOf(cwd: string): { project: string; wt?: string } {
  const m = cwd.match(/\/([^/]+)\/\.claude\/worktrees\/([^/]+)\/?$/)
  if (m) return { project: m[1], wt: m[2] }
  return { project: basename(cwd) || "?" }
}

/** triage order: needs you first, then output to review, then the rest */
export const STATUS_RANK: Record<AgentStatus, number> = {
  waiting: 0,
  error: 1,
  ready: 2,
  working: 3,
  unknown: 4,
  idle: 5,
}

// ── the map: one entity per project, alphabetical and stable ─────────────────

export interface ProjectGroup {
  key: string
  agents: Agent[]
  servers: DevServer[]
  worktrees?: RepoWorktrees
  cost: number
  burn: number
  /** most urgent agent status in the project, for the card glyph */
  worst?: AgentStatus
}

export function groupByProject(snap: Snapshot): ProjectGroup[] {
  const groups = new Map<string, ProjectGroup>()
  const get = (key: string): ProjectGroup => {
    let g = groups.get(key)
    if (!g) {
      g = { key, agents: [], servers: [], cost: 0, burn: 0 }
      groups.set(key, g)
    }
    return g
  }

  for (const a of snap.agents) {
    const g = get(a.project)
    g.agents.push(a)
    g.cost += a.costUsd
    g.burn += a.burnPerHour ?? 0
    if (!g.worst || STATUS_RANK[a.status] < STATUS_RANK[g.worst]) g.worst = a.status
  }
  for (const s of snap.servers) {
    // a server living inside a worktree belongs to the parent repo
    const key = s.cwd ? identityOf(s.cwd).project : s.project
    get(key).servers.push(s)
  }
  for (const w of snap.worktrees) get(w.repo).worktrees = w

  // the map is for spatial memory: alphabetical, never re-ranked by urgency
  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key))
}

// ── the queue: every actionable item, ranked — urgency lives HERE ────────────

export type AttentionKind = "question" | "approval" | "error" | "server-mem" | "ready" | "ctx-high" | "server-stale"

export interface AttentionItem {
  /** stable identity for selection */
  id: string
  kind: AttentionKind
  severity: number
  project: string
  /** one-line action sentence */
  title: string
  ageSec: number
  agent?: Agent
  server?: DevServer
}

const SEVERITY: Record<AttentionKind, number> = {
  question: 0,
  approval: 1,
  error: 2,
  "server-mem": 3,
  ready: 4,
  "ctx-high": 5,
  "server-stale": 6,
}

const MEM_CRITICAL_KB = 4 * 1024 * 1024

export function attentionQueue(snap: Snapshot): AttentionItem[] {
  const items: AttentionItem[] = []
  const push = (kind: AttentionKind, project: string, title: string, ageSec: number, agent?: Agent, server?: DevServer) =>
    items.push({
      id: `${kind}:${agent?.id ?? `${server?.port}:${server?.pid}`}`,
      kind,
      severity: SEVERITY[kind],
      project,
      title,
      ageSec,
      agent,
      server,
    })

  for (const a of snap.agents) {
    const label = a.wt ? `${a.project}/${a.wt}` : a.project
    if (a.status === "waiting" && a.waitKind === "question")
      push("question", label, `“${a.question ?? "needs your input"}”`, a.idleSec, a)
    else if (a.status === "waiting") push("approval", label, a.question ?? "tool pending", a.idleSec, a)
    else if (a.status === "error") push("error", label, a.question ?? a.lastActivity, a.idleSec, a)
    else if (a.status === "ready")
      push(
        "ready",
        label,
        a.diff && a.diff.files > 0
          ? `review +${a.diff.plus} −${a.diff.minus} across ${a.diff.files} ${a.diff.files === 1 ? "file" : "files"}`
          : `review: ${a.lastActivity}`,
        a.idleSec,
        a,
      )
    else if (a.status === "working" && a.contextPct >= 90)
      push("ctx-high", label, `context ${Math.round(a.contextPct)}% — nearing the limit`, 0, a)
  }
  for (const s of snap.servers) {
    const project = s.cwd ? identityOf(s.cwd).project : s.project
    if (s.stale) push("server-stale", project, `:${s.port} worktree is gone — safe to kill`, 0, undefined, s)
    else if (s.memKB > MEM_CRITICAL_KB)
      push("server-mem", project, `:${s.port} holding ${fmtMem(s.memKB)} of memory`, 0, undefined, s)
  }

  // most urgent class first; within a class, the longest-waiting first
  return items.sort((x, y) => x.severity - y.severity || y.ageSec - x.ageSec)
}
