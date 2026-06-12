import { readdirSync, statSync, openSync, readSync, closeSync } from "node:fs"
import { join } from "node:path"
import { costOf, type Usage } from "./pricing"
import { inferStatus, lastSaidOf, lastToolOf, snippet, taskOf, toolLabel } from "./status"
import { parseTail, tailText } from "./jsonl"
import { SessionCache } from "./cache"
import { rhythmOf } from "../signal"
import type { AgentStatus, WaitKind } from "../types"

const HOME = process.env.HOME ?? ""

export interface ClaudeSignals {
  sessionId: string
  /** model as reported by the transcript (for display) */
  model: string
  status: AgentStatus
  waitKind?: WaitKind
  question?: string
  options?: string[]
  task?: string
  lastSaid?: string
  lastTool?: string
  lastActivity: string
  recent: string[]
  contextPct: number
  tokens: number
  costUsd: number
  idleSec: number
  rhythm: number[]
}

// Claude Code encodes the cwd by replacing every non-alphanumeric char with "-"
// e.g. /Users/zee/Code/zee.gg → -Users-zee-Code-zee-gg  (dot → dash)
//      …/omnipair/.claude/worktrees/x → …-omnipair--claude-worktrees-x  (/. → --)
const projectDir = (cwd: string) => join(HOME, ".claude", "projects", cwd.replace(/[^a-zA-Z0-9]/g, "-"))
// Models that offer a 1M-token context. The [1m] flag is definitive when present,
// but it lives only on the CLI command — a 1M session launched without it (e.g. enabled
// via config) carries a plain model id. The user runs these at 1M, so default them to 1M
// rather than assume 200k and lie near 100%; the occ>200k rescue still corrects anything
// mislabeled. Parse family+version from the NEW naming (claude-<family>-<major>-<minor>) so
// the OLD order (claude-3-5-sonnet-DATE) can't read its date suffix as a version.
const supports1M = (model: string): boolean => {
  const m = model.toLowerCase().match(/(?:^|claude-)(opus|sonnet|fable)-(\d+)(?:-(\d+))?/)
  if (!m) return false
  const [, family, majorS, minorS] = m
  const major = Number(majorS)
  const minor = Number(minorS ?? 0)
  if (family === "opus") return major > 4 || (major === 4 && minor >= 6) // Opus 4.6+
  if (family === "sonnet") return major >= 4 // Sonnet 4+
  return major >= 5 // Fable 5+
}
export const windowFor = (model: string) =>
  /\[1m\]/i.test(model) || supports1M(model) ? 1_000_000 : 200_000

// which .jsonl is live changes rarely — re-sweep the dir (a stat per entry)
// only every few seconds; between sweeps stat just the chosen file, so the
// live signals stay tick-fresh. A newer session is picked up within PICK_TTL.
const PICK_TTL = 5_000
const pickCache = new SessionCache<string, { path: string; id: string; pickedAt: number }>()

export function activeSession(
  cwd: string,
  resumeId?: string,
  nowMs = Date.now(),
): { path: string; mtimeMs: number; id: string } | null {
  const dir = projectDir(cwd)
  if (resumeId) {
    try {
      const p = join(dir, `${resumeId}.jsonl`)
      return { path: p, mtimeMs: statSync(p).mtimeMs, id: resumeId }
    } catch {
      /* resume target missing — fall through to the sweep */
    }
  }
  const hit = pickCache.get(dir, nowMs)
  if (hit && nowMs - hit.pickedAt < PICK_TTL) {
    try {
      return { path: hit.path, mtimeMs: statSync(hit.path).mtimeMs, id: hit.id }
    } catch {
      /* vanished — re-sweep */
    }
  }
  let entries: string[]
  try {
    entries = readdirSync(dir).filter((f) => f.endsWith(".jsonl"))
  } catch {
    return null
  }
  let best: { path: string; mtimeMs: number; id: string } | null = null
  for (const f of entries) {
    const p = join(dir, f)
    let mt: number
    try {
      mt = statSync(p).mtimeMs
    } catch {
      continue
    }
    if (!best || mt > best.mtimeMs) best = { path: p, mtimeMs: mt, id: f.replace(/\.jsonl$/, "") }
  }
  if (best) pickCache.set(dir, { path: best.path, id: best.id, pickedAt: nowMs }, nowMs)
  return best
}

// ── incremental cost: sum assistant usage over the whole file, by byte offset ──
interface CostState {
  offset: number
  mtimeMs: number
  tokens: number
  cost: number
  seen: Set<string>
}
const costCache = new SessionCache<string, CostState>()

export function accrueCost(
  path: string,
  fallbackModel: string,
  mtimeMs: number,
  nowMs = Date.now(),
): { tokens: number; cost: number } {
  let st = costCache.get(path, nowMs)
  if (st && st.mtimeMs === mtimeMs) return { tokens: st.tokens, cost: st.cost }
  const size = statSync(path).size
  if (!st || size < st.offset) st = { offset: 0, mtimeMs: 0, tokens: 0, cost: 0, seen: new Set() }

  const fd = openSync(path, "r")
  try {
    const len = size - st.offset
    if (len > 0) {
      const buf = Buffer.alloc(len)
      readSync(fd, buf, 0, len, st.offset)
      const chunk = buf.toString("utf8")
      const lastNl = chunk.lastIndexOf("\n")
      const consumed = lastNl >= 0 ? lastNl + 1 : 0
      for (const l of chunk.split("\n")) {
        if (!l.trim()) continue
        let obj: any
        try {
          obj = JSON.parse(l)
        } catch {
          continue
        }
        if (obj.type !== "assistant") continue
        const u = obj.message?.usage
        if (!u) continue
        const key = `${obj.requestId ?? ""}:${obj.message?.id ?? obj.uuid ?? ""}`
        if (st.seen.has(key)) continue
        st.seen.add(key)
        const usage: Usage = {
          input: u.input_tokens ?? 0,
          output: u.output_tokens ?? 0,
          cacheRead: u.cache_read_input_tokens ?? 0,
          cacheWrite: u.cache_creation_input_tokens ?? 0,
        }
        st.tokens += usage.input + usage.output + usage.cacheRead + usage.cacheWrite
        // price each event at ITS model — sessions switch models mid-flight
        st.cost += costOf(usage, obj.message?.model ?? fallbackModel)
      }
      st.offset += consumed
    }
    st.mtimeMs = mtimeMs
    costCache.set(path, st, nowMs)
    return { tokens: st.tokens, cost: st.cost }
  } finally {
    closeSync(fd)
  }
}

function activityLines(tail: any[]): string[] {
  const lines: string[] = []
  for (let i = tail.length - 1; i >= 0 && lines.length < 6; i--) {
    const ev = tail[i]
    if (ev.type !== "assistant") continue
    const c = ev.message?.content
    if (!Array.isArray(c)) continue
    for (let j = c.length - 1; j >= 0 && lines.length < 6; j--) {
      const b = c[j]
      if (b.type === "tool_use") lines.push(toolLabel(b))
      else if (b.type === "text" && b.text?.trim()) lines.push(snippet(b.text))
    }
  }
  return lines
}

// the anchoring prompt can scroll out of the 96KB tail during long agentic
// turns — once seen (or dug up via a deep read), remember it. A dig that finds
// nothing retries on a slow TTL: the prompt may not have been typed yet, and it
// can leave the 96KB tail within one poll (big tool results), so a one-shot
// dig could blank the task line for the whole session
const TASK_DIG_TTL = 10_000
const taskCache = new SessionCache<string, string>()
const taskDugAt = new SessionCache<string, number>()

// the tail re-parses only when the file actually changed (ARCHITECTURE §5) —
// time-derived inference (idleSec, status, rhythm) still recomputes every tick
const tailCache = new SessionCache<string, { mtimeMs: number; tail: any[] }>()

export function parseClaude(
  cwd: string,
  flagModel: string,
  resumeId: string | undefined,
  nowMs: number,
): ClaudeSignals | null {
  const sess = activeSession(cwd, resumeId, nowMs)
  if (!sess) return null
  let entry = tailCache.get(sess.path, nowMs)
  if (!entry || entry.mtimeMs !== sess.mtimeMs) {
    entry = { mtimeMs: sess.mtimeMs, tail: parseTail(tailText(sess.path)) }
    tailCache.set(sess.path, entry, nowMs)
  }
  const tail = entry.tail

  let task = taskOf(tail)
  if (task) taskCache.set(sess.id, task, nowMs)
  else {
    task = taskCache.get(sess.id, nowMs)
    if (!task) {
      const dugAt = taskDugAt.get(sess.id, nowMs)
      if (dugAt === undefined || nowMs - dugAt > TASK_DIG_TTL) {
        task = taskOf(parseTail(tailText(sess.path, 1024 * 1024)))
        if (task) taskCache.set(sess.id, task, nowMs)
        else taskDugAt.set(sess.id, nowMs, nowMs)
      }
    }
  }
  // recency by real activity, not file mtime: resuming an old session rewrites the
  // file (summary/snapshot markers) with no real turn, which would otherwise make a
  // day-old session read as "just finished". Anchor on the last genuine user/assistant
  // turn (tool results are user-role entries, so this tracks live work too).
  let lastTurnMs = 0
  for (let i = tail.length - 1; i >= 0; i--) {
    const e = tail[i]
    if ((e?.type === "user" || e?.type === "assistant") && !e.isMeta && !e.isSidechain && e.timestamp) {
      const t = Date.parse(e.timestamp)
      if (Number.isFinite(t)) {
        lastTurnMs = t
        break
      }
    }
  }
  const idleSec = Math.max(0, (nowMs - (lastTurnMs || sess.mtimeMs)) / 1000)

  const lastAssistant = [...tail].reverse().find((e) => e.type === "assistant")
  const transcriptModel: string = lastAssistant?.message?.model ?? flagModel

  let lastUsage: any = null
  for (let i = tail.length - 1; i >= 0; i--) {
    if (tail[i].type === "assistant" && tail[i].message?.usage) {
      lastUsage = tail[i].message.usage
      break
    }
  }
  const occ = lastUsage
    ? (lastUsage.input_tokens ?? 0) + (lastUsage.cache_read_input_tokens ?? 0) + (lastUsage.cache_creation_input_tokens ?? 0)
    : 0
  // window: [1m] flag or a 1M-capable model → 1M. Occupancy is the backstop proof —
  // a session can't exceed its own window, so anything past 200k means 1M regardless.
  const window = Math.max(windowFor(flagModel || transcriptModel), occ > 200_000 ? 1_000_000 : 0)
  const contextPct = Math.min(100, (occ / window) * 100)

  const inferred = inferStatus(tail, idleSec)

  const acts = activityLines(tail)
  const lastActivity =
    inferred.waitKind === "question" ? "AskUserQuestion" : (inferred.question ?? acts[0] ?? "—")
  const { tokens, cost } = accrueCost(sess.path, transcriptModel, sess.mtimeMs, nowMs)

  return {
    sessionId: sess.id,
    model: transcriptModel,
    status: inferred.status,
    waitKind: inferred.waitKind,
    question: inferred.question,
    options: inferred.options,
    task,
    lastSaid: lastSaidOf(tail),
    lastTool: lastToolOf(tail),
    lastActivity,
    recent: acts.slice(0, 4),
    contextPct,
    tokens,
    costUsd: cost,
    idleSec,
    rhythm: rhythmOf(tail, nowMs),
  }
}
