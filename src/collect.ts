import { basename } from "node:path"
import { discoverAgents, branchOf } from "./collectors/process"
import { parseClaude } from "./transcript/claude"
import { collectServers } from "./collectors/servers"
import { collectWorktrees } from "./collectors/worktrees"
import type { Agent, AgentStatus, Snapshot } from "./types"

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

const STATUS_RANK: Record<AgentStatus, number> = { waiting: 0, working: 1, error: 2, idle: 3 }

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
    const project = basename(p.cwd) || "?"
    if (p.kind === "claude") {
      const s = parseClaude(p.cwd, p.model, p.resumeId, now)
      agents.push({
        id: s?.sessionId ?? String(p.pid),
        pid: p.pid,
        kind: "claude",
        project,
        cwd: p.cwd,
        branch,
        model: prettyModel(s?.model ?? p.model),
        status: s?.status ?? "idle",
        question: s?.question,
        lastActivity: s?.lastActivity ?? "—",
        recent: s?.recent ?? [],
        contextPct: s?.contextPct ?? 0,
        costUsd: s?.costUsd ?? 0,
        tokens: s?.tokens ?? 0,
        uptimeSec: p.etimeSec,
        idleSec: s?.idleSec ?? 0,
      })
    } else {
      // codex — iter 4. Show the process so it isn't invisible.
      agents.push({
        id: String(p.pid),
        pid: p.pid,
        kind: "codex",
        project,
        cwd: p.cwd,
        branch,
        model: prettyModel(p.model) || "codex",
        status: "working",
        lastActivity: "—",
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
  // one with the most context (the real owner over a sidechain).
  const byId = new Map<string, Agent>()
  for (const a of agents) {
    const prev = byId.get(a.id)
    if (!prev || a.contextPct > prev.contextPct || a.costUsd > prev.costUsd) byId.set(a.id, a)
  }
  const unique = [...byId.values()]

  unique.sort((a, b) => {
    const r = STATUS_RANK[a.status] - STATUS_RANK[b.status]
    if (r !== 0) return r
    return b.uptimeSec - a.uptimeSec
  })

  const [servers, worktrees] = await Promise.all([collectServers(), collectWorktrees()])

  return { time: hhmm(now), agents: unique, servers, worktrees }
}
