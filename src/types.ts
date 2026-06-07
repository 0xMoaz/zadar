export type AgentKind = "claude" | "codex"
export type AgentStatus = "working" | "waiting" | "idle" | "error"

export interface Agent {
  id: string
  pid: number
  kind: AgentKind
  project: string
  cwd: string
  branch: string
  model: string
  status: AgentStatus
  /** the literal question the agent is blocked on (status === "waiting") */
  question?: string
  /** one-line "what it's doing now" */
  lastActivity: string
  /** recent activity lines, newest first */
  recent: string[]
  /** 0..100 */
  contextPct: number
  costUsd: number
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
