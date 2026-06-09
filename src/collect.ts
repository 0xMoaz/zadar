import { basename } from "node:path"
import { discoverAgents, branchOf } from "./collectors/process"
import { parseClaude } from "./transcript/claude"
import { collectServers } from "./collectors/servers"
import { collectWorktrees } from "./collectors/worktrees"
import { diffOf } from "./collectors/diff"
import { burnRate, ghostVisible, pushSample, trackGhost, type BurnSample, type GhostState } from "./signal"
import type { Agent, AgentStatus, Snapshot } from "./types"

// per-session living-signal state (sessions are bounded; pruned to the live set)
const burns = new Map<string, BurnSample[]>()
const ghosts = new Map<string, GhostState>()

export const emptySnapshot: Snapshot = {
  time: "",
  agents: [],
  servers: [],
  worktrees: [],
}

function prettyModel(m: string): string {
  if (!m) return "?"
  const oneM = /\[1m\]/i.test(m)
  let s = m.replace(/^claude-/, "").replace(/\[1m\]/i, "")
  s = s.replace(/-(\d+)-(\d+)$/, "-$1.$2") // opus-4-8 → opus-4.8
  return oneM ? `${s} 1m` : s
}

/** Sessions inside .claude/worktrees/<wt> belong to the parent repo — keep both names. */
export function identityOf(cwd: string): { project: string; wt?: string } {
  const m = cwd.match(/\/([^/]+)\/\.claude\/worktrees\/([^/]+)\/?$/)
  if (m) return { project: m[1], wt: m[2] }
  return { project: basename(cwd) || "?" }
}

/** triage order: needs you first, then output to review, then the rest */
const STATUS_RANK: Record<AgentStatus, number> = {
  waiting: 0,
  error: 1,
  ready: 2,
  working: 3,
  unknown: 4,
  idle: 5,
}

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]
function hhmm(ms: number): string {
  const d = new Date(ms)
  const t = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
  return `${DAYS[d.getDay()]} · ${t}`
}

export async function collect(): Promise<Snapshot> {
  const now = Date.now()
  const procs = await discoverAgents()

  const agents: Agent[] = []
  for (const p of procs) {
    const branch = await branchOf(p.cwd)
    const { project, wt } = identityOf(p.cwd)
    if (p.kind === "claude") {
      const s = parseClaude(p.cwd, p.model, p.resumeId, now)
      const id = s?.sessionId ?? String(p.pid)
      const costUsd = s?.costUsd ?? 0
      const contextPct = s?.contextPct ?? 0

      const samples = pushSample(burns.get(id) ?? [], now, costUsd)
      burns.set(id, samples)
      const g = trackGhost(ghosts.get(id), contextPct, now)
      ghosts.set(id, g)

      agents.push({
        id,
        pid: p.pid,
        kind: "claude",
        project,
        wt,
        cwd: p.cwd,
        branch,
        model: prettyModel(s?.model ?? p.model),
        status: s?.status ?? "idle",
        waitKind: s?.waitKind,
        question: s?.question,
        options: s?.options,
        procs: 1,
        lastActivity: s?.lastActivity ?? "—",
        recent: s?.recent ?? [],
        contextPct,
        ctxGhostPct: ghostVisible(g, now),
        costUsd,
        burnPerHour: burnRate(samples),
        diff: await diffOf(p.cwd, now),
        tokens: s?.tokens ?? 0,
        uptimeSec: p.etimeSec,
        idleSec: s?.idleSec ?? 0,
      })
    } else {
      // codex — transcript not parsed yet: show the process honestly as unknown.
      agents.push({
        id: String(p.pid),
        pid: p.pid,
        kind: "codex",
        project,
        wt,
        cwd: p.cwd,
        branch,
        model: prettyModel(p.model) || "codex",
        status: "unknown",
        procs: 1,
        lastActivity: "transcript not parsed yet",
        recent: [],
        contextPct: 0,
        costUsd: 0,
        tokens: 0,
        uptimeSec: p.etimeSec,
        idleSec: 0,
      })
    }
  }

  // dedupe by session id — collapses subagents/duplicate procs that resolve to
  // the same transcript (the "random duplicate sessions" problem). Prefer the
  // one with the most context (the real owner over a sidechain), but surface
  // how many live procs share the row instead of hiding them silently.
  const byId = new Map<string, Agent>()
  for (const a of agents) {
    const prev = byId.get(a.id)
    if (!prev) byId.set(a.id, a)
    else {
      const keep = a.contextPct > prev.contextPct || a.costUsd > prev.costUsd ? a : prev
      keep.procs = prev.procs + 1
      byId.set(a.id, keep)
    }
  }
  const unique = [...byId.values()]

  // drop living-signal state for sessions that are gone
  const liveIds = new Set(unique.map((a) => a.id))
  for (const k of burns.keys()) if (!liveIds.has(k)) burns.delete(k)
  for (const k of ghosts.keys()) if (!liveIds.has(k)) ghosts.delete(k)

  unique.sort((a, b) => {
    const r = STATUS_RANK[a.status] - STATUS_RANK[b.status]
    if (r !== 0) return r
    return b.uptimeSec - a.uptimeSec
  })

  const [servers, worktrees] = await Promise.all([collectServers(), collectWorktrees()])

  return { time: hhmm(now), agents: unique, servers, worktrees }
}
