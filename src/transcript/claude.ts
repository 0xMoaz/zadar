import { readdirSync, statSync, openSync, readSync, closeSync } from "node:fs"
import { join } from "node:path"
import { costOf, type Usage } from "./pricing"
import type { AgentStatus } from "../types"

const HOME = process.env.HOME ?? ""

export interface ClaudeSignals {
  sessionId: string
  /** model as reported by the transcript (for display) */
  model: string
  status: AgentStatus
  question?: string
  lastActivity: string
  recent: string[]
  contextPct: number
  tokens: number
  costUsd: number
  idleSec: number
}

// Claude Code encodes the cwd by replacing every non-alphanumeric char with "-"
// e.g. /Users/zee/Code/zee.gg → -Users-zee-Code-zee-gg  (dot → dash)
//      …/omnipair/.claude/worktrees/x → …-omnipair--claude-worktrees-x  (/. → --)
const projectDir = (cwd: string) => join(HOME, ".claude", "projects", cwd.replace(/[^a-zA-Z0-9]/g, "-"))
const windowFor = (model: string) => (/\[1m\]/i.test(model) ? 1_000_000 : 200_000)

export function activeSession(
  cwd: string,
  resumeId?: string,
): { path: string; mtimeMs: number; id: string } | null {
  const dir = projectDir(cwd)
  let entries: string[]
  try {
    entries = readdirSync(dir).filter((f) => f.endsWith(".jsonl"))
  } catch {
    return null
  }
  if (entries.length === 0) return null
  if (resumeId && entries.includes(`${resumeId}.jsonl`)) {
    const p = join(dir, `${resumeId}.jsonl`)
    return { path: p, mtimeMs: statSync(p).mtimeMs, id: resumeId }
  }
  let best: { path: string; mtimeMs: number; id: string } | null = null
  for (const f of entries) {
    const p = join(dir, f)
    const mt = statSync(p).mtimeMs
    if (!best || mt > best.mtimeMs) best = { path: p, mtimeMs: mt, id: f.replace(/\.jsonl$/, "") }
  }
  return best
}

function tailText(path: string, bytes = 96 * 1024): string {
  const fd = openSync(path, "r")
  try {
    const size = statSync(path).size
    const start = Math.max(0, size - bytes)
    const len = size - start
    if (len <= 0) return ""
    const buf = Buffer.alloc(len)
    readSync(fd, buf, 0, len, start)
    return buf.toString("utf8")
  } finally {
    closeSync(fd)
  }
}

function parseTail(text: string): any[] {
  const lines = text.split("\n")
  lines.shift() // drop possibly-partial first line
  const out: any[] = []
  for (const l of lines) {
    if (!l.trim()) continue
    try {
      out.push(JSON.parse(l))
    } catch {
      /* skip partial / malformed */
    }
  }
  return out
}

// ── incremental cost: sum assistant usage over the whole file, by byte offset ──
interface CostState {
  offset: number
  mtimeMs: number
  tokens: number
  cost: number
  seen: Set<string>
}
const costCache = new Map<string, CostState>()

function accrueCost(path: string, model: string, mtimeMs: number): { tokens: number; cost: number } {
  let st = costCache.get(path)
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
        st.cost += costOf(usage, model)
      }
      st.offset += consumed
    }
    st.mtimeMs = mtimeMs
    costCache.set(path, st)
    return { tokens: st.tokens, cost: st.cost }
  } finally {
    closeSync(fd)
  }
}

function lastToolUse(ev: any): any | null {
  const c = ev?.message?.content
  if (!Array.isArray(c)) return null
  for (let i = c.length - 1; i >= 0; i--) if (c[i].type === "tool_use") return c[i]
  return null
}

function toolLabel(b: any): string {
  const inp = b.input ?? {}
  const verb =
    ({ Bash: "run", Read: "read", Edit: "edit", Write: "write", Grep: "grep", Glob: "glob", Task: "task" } as Record<
      string,
      string
    >)[b.name] ?? b.name
  // Bash: show the command verbatim (don't path-split). Files: show a short path.
  let arg: string
  if (inp.command) arg = String(inp.command).replace(/\s+/g, " ").trim()
  else if (inp.file_path ?? inp.path) arg = String(inp.file_path ?? inp.path).split("/").slice(-2).join("/")
  else arg = String(inp.pattern ?? inp.query ?? inp.description ?? "")
  arg = arg.slice(0, 46)
  return arg ? `${verb} ${arg}` : verb
}

const snippet = (t: string) => t.replace(/\s+/g, " ").trim().slice(0, 70)

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

export function parseClaude(
  cwd: string,
  flagModel: string,
  resumeId: string | undefined,
  nowMs: number,
): ClaudeSignals | null {
  const sess = activeSession(cwd, resumeId)
  if (!sess) return null
  const tail = parseTail(tailText(sess.path))
  const idleSec = Math.max(0, (nowMs - sess.mtimeMs) / 1000)

  const lastAssistant = [...tail].reverse().find((e) => e.type === "assistant")
  const transcriptModel: string = lastAssistant?.message?.model ?? flagModel
  const window = windowFor(flagModel || transcriptModel)

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
  const contextPct = Math.min(100, (occ / window) * 100)

  // seconds of transcript silence before we consider an agent no longer actively working
  const ACTIVE_SEC = 45
  let status: AgentStatus = "idle"
  let question: string | undefined
  const trailing = lastToolUse(lastAssistant)
  if (trailing?.name === "AskUserQuestion") {
    // blocked on a question for you — highest priority
    status = "waiting"
    question =
      trailing.input?.questions?.[0]?.question ?? trailing.input?.question ?? "waiting for your input"
  } else if (idleSec <= ACTIVE_SEC) {
    // transcript was just written → actively generating / running tools
    status = "working"
  } else if (lastAssistant?.message?.stop_reason === "tool_use") {
    // last action was a tool call with no result yet → running a long tool
    status = "working"
  } else {
    // finished its turn and quiet for a while → idle / awaiting you
    status = "idle"
  }

  const acts = activityLines(tail)
  const lastActivity = question ? "AskUserQuestion" : acts[0] ?? "—"
  const { tokens, cost } = accrueCost(sess.path, transcriptModel, sess.mtimeMs)

  return {
    sessionId: sess.id,
    model: transcriptModel,
    status,
    question,
    lastActivity,
    recent: acts.slice(0, 4),
    contextPct,
    tokens,
    costUsd: cost,
    idleSec,
  }
}
