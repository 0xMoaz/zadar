import { readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { priceFor } from "./pricing"
import { READY_SEC, stripMd } from "./status"
import { headLine, parseTail, tailText } from "./jsonl"
import { rhythmOf } from "../signal"
import type { AgentStatus } from "../types"

const HOME = process.env.HOME ?? ""
const SESS_ROOT = join(HOME, ".codex", "sessions")

export interface CodexSignals {
  sessionId: string
  model: string
  status: AgentStatus
  task?: string
  lastSaid?: string
  lastActivity: string
  recent: string[]
  contextPct: number
  tokens: number
  costUsd: number
  idleSec: number
  rhythm: number[]
  /** plan-quota burn (rate_limits.primary.used_percent) */
  planPct?: number
}

// a session file's cwd/id never change → cache by path forever
const metaCache = new Map<string, { cwd: string; id: string } | null>()

function metaOf(path: string): { cwd: string; id: string } | null {
  const hit = metaCache.get(path)
  if (hit !== undefined) return hit
  let meta: { cwd: string; id: string } | null = null
  try {
    const first = JSON.parse(headLine(path))
    if (first?.type === "session_meta" && first.payload?.cwd) {
      meta = { cwd: String(first.payload.cwd), id: String(first.payload.id ?? "") }
    }
  } catch {
    /* unreadable / not a session file */
  }
  metaCache.set(path, meta)
  return meta
}

/** Codex stores sessions flat by date — walk recent day-dirs, newest first. */
export function findCodexSession(
  cwd: string,
  root = SESS_ROOT,
  maxDays = 14,
): { path: string; mtimeMs: number; id: string } | null {
  const files: { path: string; mtimeMs: number }[] = []
  let days = 0
  try {
    for (const y of readdirSync(root).sort().reverse()) {
      for (const m of readdirSync(join(root, y)).sort().reverse()) {
        for (const d of readdirSync(join(root, y, m)).sort().reverse()) {
          const day = join(root, y, m, d)
          for (const f of readdirSync(day)) {
            if (!f.endsWith(".jsonl")) continue
            const p = join(day, f)
            try {
              files.push({ path: p, mtimeMs: statSync(p).mtimeMs })
            } catch {
              /* vanished */
            }
          }
          if (++days >= maxDays) throw "done"
        }
      }
    }
  } catch (e) {
    if (e !== "done" && files.length === 0) return null
  }
  files.sort((a, b) => b.mtimeMs - a.mtimeMs)
  for (const f of files) {
    const meta = metaOf(f.path)
    if (meta && meta.cwd === cwd) return { path: f.path, mtimeMs: f.mtimeMs, id: meta.id }
  }
  return null
}

/** task lifecycle from the event tail: started → working, complete → ready */
export function inferCodexStatus(tail: any[], idleSec: number): AgentStatus {
  for (let i = tail.length - 1; i >= 0; i--) {
    const t = tail[i]?.payload?.type
    if (t === "task_complete") return idleSec <= READY_SEC ? "ready" : "idle"
    if (t === "turn_aborted") return "idle"
    if (t === "task_started") return idleSec <= 300 ? "working" : "idle"
  }
  return idleSec <= 45 ? "working" : "idle"
}

/** cumulative cost from total_token_usage (Codex keeps the running total in-file) */
export function codexCost(u: {
  input_tokens?: number
  cached_input_tokens?: number
  output_tokens?: number
}): number {
  const p = priceFor("gpt")
  const cached = u.cached_input_tokens ?? 0
  const fresh = Math.max(0, (u.input_tokens ?? 0) - cached)
  return (fresh * p.input + cached * p.cacheRead + (u.output_tokens ?? 0) * p.output) / 1e6
}

const snippet = (t: string) => stripMd(t).replace(/\s+/g, " ").trim().slice(0, 70)

export function parseCodex(cwd: string, flagModel: string, nowMs: number, root = SESS_ROOT): CodexSignals | null {
  const sess = findCodexSession(cwd, root)
  if (!sess) return null
  const tail = parseTail(tailText(sess.path, 128 * 1024))
  // recency by real activity, not file mtime (mirrors the Claude fix): a resumed
  // session can touch the file without a real turn. Anchor on the last content event,
  // skipping pure token_count bookkeeping.
  let lastTurnMs = 0
  for (let i = tail.length - 1; i >= 0; i--) {
    const ev = tail[i]
    if (ev?.payload?.type === "token_count") continue
    const ts = ev?.timestamp ? Date.parse(ev.timestamp) : NaN
    if (Number.isFinite(ts)) {
      lastTurnMs = ts
      break
    }
  }
  const idleSec = Math.max(0, (nowMs - (lastTurnMs || sess.mtimeMs)) / 1000)

  let info: any = null
  let planPct: number | undefined
  let model = flagModel
  let task: string | undefined
  const recent: string[] = []
  for (let i = tail.length - 1; i >= 0; i--) {
    const ev = tail[i]
    if (!info && ev?.payload?.type === "token_count" && ev.payload.info) info = ev.payload.info
    if (planPct === undefined && ev?.payload?.type === "token_count" && ev.payload.rate_limits?.primary)
      planPct = ev.payload.rate_limits.primary.used_percent
    if (recent.length < 4 && ev?.payload?.type === "agent_message" && ev.payload.message)
      recent.push(snippet(ev.payload.message))
    if (!task && ev?.payload?.type === "user_message" && ev.payload.message) task = snippet(ev.payload.message)
    if (ev?.type === "turn_context" && ev.payload?.model) model = ev.payload.model
  }

  const window = info?.model_context_window ?? 0
  const occ = info?.last_token_usage?.total_tokens ?? 0
  const total = info?.total_token_usage
  const status = inferCodexStatus(tail, idleSec)

  return {
    sessionId: sess.id || sess.path,
    model: model || "codex",
    status,
    task,
    lastSaid: recent[0],
    lastActivity: recent[0] ?? (status === "working" ? "task running" : "—"),
    recent,
    contextPct: window > 0 ? Math.min(100, (occ / window) * 100) : 0,
    tokens: total?.total_tokens ?? 0,
    costUsd: total ? codexCost(total) : 0,
    idleSec,
    rhythm: rhythmOf(tail, nowMs),
    planPct,
  }
}
