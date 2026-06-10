import { identityOf, STATUS_RANK } from "./fleetmap"
import { discoverAgents, branchOf } from "./collectors/process"
import { parseClaude } from "./transcript/claude"
import { parseCodex } from "./transcript/codex"
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
        task: s?.task,
        lastSaid: s?.lastSaid,
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
        rhythm: s?.rhythm,
      })
    } else {
      // codex — parsed from ~/.codex/sessions (window + totals live in-file)
      const s = parseCodex(p.cwd, p.model, now)
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
        kind: "codex",
        project,
        wt,
        cwd: p.cwd,
        branch,
        model: prettyModel(p.model) || s?.model || "codex",
        status: s?.status ?? "unknown",
        procs: 1,
        task: s?.task,
        lastSaid: s?.lastSaid,
        lastActivity: s?.lastActivity ?? "no session file found",
        recent: s?.recent ?? [],
        contextPct,
        ctxGhostPct: ghostVisible(g, now),
        costUsd,
        burnPerHour: burnRate(samples),
        planPct: s?.planPct,
        diff: await diffOf(p.cwd, now),
        tokens: s?.tokens ?? 0,
        uptimeSec: p.etimeSec,
        idleSec: s?.idleSec ?? 0,
        rhythm: s?.rhythm,
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
