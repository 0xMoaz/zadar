import type { AgentStatus } from "./types"

// ── burn rate: cost velocity over a sliding window ──────────────────────────

export interface BurnSample {
  t: number
  cost: number
}

/** append a sample; trim history but keep one anchor before the window edge */
export function pushSample(samples: BurnSample[], t: number, cost: number, windowMs = 10 * 60_000): BurnSample[] {
  const next = [...samples, { t, cost }]
  const cutoff = t - windowMs
  while (next.length > 1 && next[1].t <= cutoff) next.shift()
  return next
}

/** $/hour across the window — 0 until there are two samples a real moment apart */
export function burnRate(samples: BurnSample[]): number {
  if (samples.length < 2) return 0
  const first = samples[0]
  const last = samples[samples.length - 1]
  const dtH = (last.t - first.t) / 3_600_000
  if (dtH <= 0) return 0
  return Math.max(0, (last.cost - first.cost) / dtH)
}

// ── transitions: what changed between two snapshots ──────────────────────────

export interface Transition {
  t: number
  id: string
  project: string
  from: AgentStatus | undefined
  to: AgentStatus
}

/** status flips since the previous snapshot (appearances count, disappearances don't) */
export function diffTransitions(
  prev: Map<string, AgentStatus>,
  agents: { id: string; project: string; wt?: string; status: AgentStatus }[],
  now: number,
): Transition[] {
  const out: Transition[] = []
  for (const a of agents) {
    const before = prev.get(a.id)
    if (before !== a.status) {
      out.push({ t: now, id: a.id, project: a.wt ? `${a.project}/${a.wt}` : a.project, from: before, to: a.status })
    }
  }
  return out
}

// ── compaction ghost: the high-water mark lingers after occupancy drops ─────

export interface GhostState {
  /** highest context% seen this session */
  hwm: number
  /** the pre-drop mark, visible while fresh */
  ghost?: number
  ghostAt?: number
}

const DROP_PTS = 15
const GHOST_MS = 60_000

export function trackGhost(st: GhostState | undefined, pct: number, now: number): GhostState {
  const prev = st ?? { hwm: pct }
  // sudden drop from the high-water mark → remember where it was
  if (pct < prev.hwm - DROP_PTS) {
    return { hwm: pct, ghost: prev.hwm, ghostAt: now }
  }
  const hwm = Math.max(prev.hwm, pct)
  // keep an existing ghost while it's fresh
  if (prev.ghost !== undefined && prev.ghostAt !== undefined && now - prev.ghostAt < GHOST_MS) {
    return { hwm, ghost: prev.ghost, ghostAt: prev.ghostAt }
  }
  return { hwm }
}

export const ghostVisible = (st: GhostState | undefined, now: number): number | undefined =>
  st?.ghost !== undefined && st.ghostAt !== undefined && now - st.ghostAt < GHOST_MS ? st.ghost : undefined
