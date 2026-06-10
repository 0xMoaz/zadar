import type { AgentStatus, WaitKind } from "../types"

/** transcript silence before "actively generating" lapses */
export const ACTIVE_SEC = 45
/** a pending tool call older than this needs you (approval or hung) */
export const APPROVAL_SEC = 120
/** a finished turn stays "ready for review" this long */
export const READY_SEC = 20 * 60

export interface InferredStatus {
  status: AgentStatus
  waitKind?: WaitKind
  /** the literal question (question) · the pending tool label (approval) · failure note (error) */
  question?: string
  /** AskUserQuestion option labels, for pre-deciding before you switch */
  options?: string[]
}

export function toolLabel(b: any): string {
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

const meaningful = (e: any) => e?.type === "user" || e?.type === "assistant"

/** agents speak markdown; the dashboard speaks prose — strip links/code/emphasis */
export const stripMd = (s: string) =>
  s
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/`+/g, "")
    .replace(/\*\*|__|(?<![\w*])\*(?!\s)|(?<!\s)\*(?![\w*])/g, "")
    .replace(/^#+\s+/gm, "")

const squish = (t: string, max: number) => {
  const s = stripMd(t).replace(/\s+/g, " ").trim()
  return s.length > max ? s.slice(0, max - 1) + "…" : s
}

/**
 * The task: the user's last typed prompt — the anchor that answers "what is
 * this session for?". Typed prompts are user events with STRING content;
 * tool results are arrays, harness injections start with '<', interrupts
 * with '[', and sidechain (subagent) traffic isn't yours.
 */
export function taskOf(tail: any[], max = 90): string | undefined {
  for (let i = tail.length - 1; i >= 0; i--) {
    const ev = tail[i]
    if (ev?.type !== "user" || ev.isSidechain || ev.isMeta) continue
    const c = ev.message?.content
    // typed prompts are strings; prompts with attachments are arrays of
    // image+text blocks — but tool results are arrays too, so guard those out
    let text: string | undefined
    if (typeof c === "string") text = c
    else if (Array.isArray(c) && !c.some((b: any) => b?.type === "tool_result")) {
      text = c.find((b: any) => b?.type === "text" && b.text?.trim())?.text
    }
    const t = text?.trim()
    if (!t || t.startsWith("<") || t.startsWith("[")) continue
    return squish(t, max)
  }
  return undefined
}

/** the agent's last words — the most recent assistant text block */
export function lastSaidOf(tail: any[], max = 90): string | undefined {
  for (let i = tail.length - 1; i >= 0; i--) {
    const ev = tail[i]
    if (ev?.type !== "assistant" || ev.isSidechain) continue
    const c = ev.message?.content
    if (!Array.isArray(c)) continue
    for (let j = c.length - 1; j >= 0; j--) {
      if (c[j]?.type === "text" && c[j].text?.trim()) return squish(c[j].text, max)
    }
  }
  return undefined
}

/** the agent's last ACTION — the most recent tool call (the "now/last" row) */
export function lastToolOf(tail: any[]): string | undefined {
  for (let i = tail.length - 1; i >= 0; i--) {
    const ev = tail[i]
    if (ev?.type !== "assistant" || ev.isSidechain) continue
    const c = ev.message?.content
    if (!Array.isArray(c)) continue
    for (let j = c.length - 1; j >= 0; j--) {
      if (c[j]?.type === "tool_use") return toolLabel(c[j])
    }
  }
  return undefined
}

/**
 * Pure status inference over the parsed transcript tail.
 *
 * Priority: unanswered AskUserQuestion → waiting(question);
 * other unanswered tool_use → working while young, waiting(approval) once old
 * (either it needs approval or it hung — both deserve attention);
 * turn that died on a failed tool → error; finished turn → ready (then idle);
 * recent writes → working; otherwise idle.
 */
export function inferStatus(tail: any[], idleSec: number): InferredStatus {
  let lastA = -1
  for (let i = tail.length - 1; i >= 0; i--) {
    if (tail[i]?.type === "assistant" && tail[i]?.message) {
      lastA = i
      break
    }
  }
  if (lastA < 0) return { status: idleSec <= ACTIVE_SEC ? "working" : "idle" }

  const a = tail[lastA]
  const after = tail.slice(lastA + 1).filter(meaningful)

  const answered = new Set<string>()
  for (const ev of after) {
    const c = ev?.message?.content
    if (!Array.isArray(c)) continue
    for (const b of c) if (b?.type === "tool_result" && b.tool_use_id) answered.add(b.tool_use_id)
  }
  const content = Array.isArray(a.message?.content) ? a.message.content : []
  const pending = content.filter((b: any) => b?.type === "tool_use" && !answered.has(b.id))

  const ask = pending.find((b: any) => b.name === "AskUserQuestion")
  if (ask) {
    const q = ask.input?.questions?.[0]
    const options = Array.isArray(q?.options)
      ? q.options.map((o: any) => (typeof o === "string" ? o : (o?.label ?? ""))).filter(Boolean)
      : undefined
    return {
      status: "waiting",
      waitKind: "question",
      question: q?.question ?? ask.input?.question ?? "waiting for your input",
      options: options?.length ? options : undefined,
    }
  }
  if (pending.length > 0) {
    if (idleSec <= APPROVAL_SEC) return { status: "working" }
    return { status: "waiting", waitKind: "approval", question: toolLabel(pending[pending.length - 1]) }
  }

  const last = tail[tail.length - 1]
  const lastContent = last?.message?.content
  const erroredTail =
    Array.isArray(lastContent) && lastContent.some((b: any) => b?.type === "tool_result" && b?.is_error)
  if (erroredTail && idleSec > ACTIVE_SEC) return { status: "error", question: "turn ended on a failed tool call" }

  if (a.message?.stop_reason === "end_turn" && after.length === 0) {
    return { status: idleSec <= READY_SEC ? "ready" : "idle" }
  }
  return { status: idleSec <= ACTIVE_SEC ? "working" : "idle" }
}
