export type AgentKind = "claude" | "codex"
export type AgentStatus = "working" | "waiting" | "ready" | "idle" | "error" | "unknown"
/** why a waiting agent waits: a literal question vs. a pending tool (approval or hung) */
export type WaitKind = "question" | "approval"

export interface Agent {
  id: string
  pid: number
  kind: AgentKind
  project: string
  /** worktree name when the session runs inside .claude/worktrees/<wt> */
  wt?: string
  cwd: string
  branch: string
  model: string
  status: AgentStatus
  waitKind?: WaitKind
  /** the literal question the agent is blocked on (status === "waiting") */
  question?: string
  /** AskUserQuestion option labels — pre-decide before you switch */
  options?: string[]
  /** live processes that resolved to this session (>1 = shared transcript) */
  procs: number
  /** one-line "what it's doing now" */
  lastActivity: string
  /** recent activity lines, newest first */
  recent: string[]
  /** 0..100 */
  contextPct: number
  /** pre-compaction high-water mark, fading ghost on the bar */
  ctxGhostPct?: number
  costUsd: number
  /** cost velocity over the last ~10 minutes, $/hour */
  burnPerHour?: number
  /** uncommitted change size in the agent's cwd — what it produced for review */
  diff?: { files: number; plus: number; minus: number }
  tokens: number
  uptimeSec: number
  /** seconds since last transcript activity */
  idleSec: number
}

export interface DevServer {
  port: number
  pid: number
  memKB: number
  /** human uptime, e.g. "8m" · "2h" */
  uptime: string
  project: string
  branch: string
  cwd: string
  /** true when the server's cwd no longer exists (orphaned worktree) */
  stale: boolean
}

export interface SystemStat {
  usedGB: number
  totalGB: number
  pct: number
  swap: string
  load: [number, number, number]
  /** recent used% samples for the sparkline */
  memHistory: number[]
}

export interface RepoWorktrees {
  repo: string
  total: number
  changed: number
}

export interface Snapshot {
  time: string
  /** whole-machine memory/load — no longer shown; kept optional for tooling */
  system?: SystemStat
  agents: Agent[]
  servers: DevServer[]
  worktrees: RepoWorktrees[]
}
