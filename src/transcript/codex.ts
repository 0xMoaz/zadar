import { readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { priceFor } from "./pricing"
import { ACTIVE_SEC, READY_SEC, snippet } from "./status"
import { headEvents, headLine, parseTail, tailText } from "./jsonl"
import { SessionCache } from "./cache"
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

// a session file's cwd/id never change → cache by path while it's in use
const metaCache = new SessionCache<string, { cwd: string; id: string } | null>()

function metaOf(path: string, nowMs: number): { cwd: string; id: string } | null {
  const hit = metaCache.get(path, nowMs)
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
  metaCache.set(path, meta, nowMs)
  return meta
}

// the day-dir walk stats every rollout file — far too heavy for every tick.
// Remember which file answers a cwd and stat just it; re-walk on a short TTL
// so a brand-new session in the same cwd is still picked up within seconds.
// Only FOUND sessions are cached — a missing one re-checks every tick, so a
// session appearing for the first time shows up on the next poll, as before.
const WALK_TTL = 10_000
const walkCache = new SessionCache<string, { at: number; path: string; id: string }>()

/** Codex stores sessions flat by date — walk recent day-dirs, newest first. */
export function findCodexSession(
  cwd: string,
  root = SESS_ROOT,
  maxDays = 14,
  nowMs = Date.now(),
): { path: string; mtimeMs: number; id: string } | null {
  const key = `${root}\0${cwd}`
  const hit = walkCache.get(key, nowMs)
  if (hit && nowMs - hit.at < WALK_TTL) {
    try {
      return { path: hit.path, mtimeMs: statSync(hit.path).mtimeMs, id: hit.id }
    } catch {
      /* vanished — re-walk */
    }
  }
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
    const meta = metaOf(f.path, nowMs)
    if (meta && meta.cwd === cwd) {
      walkCache.set(key, { at: nowMs, path: f.path, id: meta.id }, nowMs)
      return { path: f.path, mtimeMs: f.mtimeMs, id: meta.id }
    }
  }
  return null
}

/** an unfinished task with no writes for this long has lapsed (Codex has no
 *  structured "needs approval" marker, so it can't graduate to waiting) */
const TASK_LAPSE_SEC = 300

/** task lifecycle from the event tail: started → working, complete → ready */
export function inferCodexStatus(tail: any[], idleSec: number): AgentStatus {
  for (let i = tail.length - 1; i >= 0; i--) {
    const t = tail[i]?.payload?.type
    if (t === "task_complete") return idleSec <= READY_SEC ? "ready" : "idle"
    if (t === "turn_aborted") return "idle"
    if (t === "task_started") return idleSec <= TASK_LAPSE_SEC ? "working" : "idle"
  }
  return idleSec <= ACTIVE_SEC ? "working" : "idle"
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

// the tail re-parses only when the file actually changed (ARCHITECTURE §5) —
// time-derived inference (idleSec, status, rhythm) still recomputes every tick
const tailCache = new SessionCache<string, { mtimeMs: number; tail: any[]; headModel?: string }>()

/** Codex writes turn_context once at session start (and on model switches), so
 *  long sessions push it past the tail window — the immutable head still has it */
function headModelOf(path: string): string | undefined {
  for (const ev of headEvents(path)) if (ev?.type === "turn_context" && ev.payload?.model) return ev.payload.model
  return undefined
}

export function parseCodex(cwd: string, flagModel: string, nowMs: number, root = SESS_ROOT): CodexSignals | null {
  const sess = findCodexSession(cwd, root, 14, nowMs)
  if (!sess) return null
  let entry = tailCache.get(sess.path, nowMs)
  if (!entry || entry.mtimeMs !== sess.mtimeMs) {
    // a found head model rides across re-parses (the head never changes);
    // a miss ("") resets so a fresh file version gets re-probed
    entry = { mtimeMs: sess.mtimeMs, tail: parseTail(tailText(sess.path, 128 * 1024)), headModel: entry?.headModel || undefined }
    tailCache.set(sess.path, entry, nowMs)
  }
  const tail = entry.tail
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
  let fileModel: string | undefined
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
    if (!fileModel && ev?.type === "turn_context" && ev.payload?.model) fileModel = ev.payload.model
  }
  if (!fileModel) {
    if (entry.headModel === undefined) entry.headModel = headModelOf(sess.path) ?? ""
    fileModel = entry.headModel || undefined
  }

  const window = info?.model_context_window ?? 0
  const occ = info?.last_token_usage?.total_tokens ?? 0
  const total = info?.total_token_usage
  const status = inferCodexStatus(tail, idleSec)

  return {
    sessionId: sess.id || sess.path,
    model: fileModel || flagModel || "codex",
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
