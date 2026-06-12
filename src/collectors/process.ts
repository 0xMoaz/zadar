import { $ } from "bun"
import type { AgentKind } from "../types"

export interface RawProc {
  pid: number
  kind: AgentKind
  etimeSec: number
  rssKB: number
  /** value of the --model flag, if present (carries the [1m] suffix) */
  model: string
  cwd: string
  resumeId?: string
}

/** ps etime "[[dd-]hh:]mm:ss" → seconds */
export function etimeToSec(e: string): number {
  let days = 0
  let rest = e
  if (e.includes("-")) {
    const [d, r] = e.split("-")
    days = parseInt(d, 10) || 0
    rest = r
  }
  const parts = rest.split(":").map((n) => parseInt(n, 10) || 0)
  let s = 0
  if (parts.length === 3) s = parts[0] * 3600 + parts[1] * 60 + parts[2]
  else if (parts.length === 2) s = parts[0] * 60 + parts[1]
  else s = parts[0]
  return days * 86400 + s
}

// a process's cwd is immutable for its lifetime → cache forever by pid
const cwdCache = new Map<number, string>()
export async function cwdOf(pid: number): Promise<string> {
  const hit = cwdCache.get(pid)
  if (hit !== undefined) return hit
  const t = await $`lsof -a -p ${pid} -d cwd -Fn`.nothrow().quiet().text()
  const line = t.split("\n").find((l) => l.startsWith("n"))
  const cwd = line ? line.slice(1) : ""
  if (cwd) cwdCache.set(pid, cwd)
  return cwd
}

// branch changes rarely → cache with a short TTL to avoid a git spawn every tick
const branchCache = new Map<string, { v: string; t: number }>()
export async function branchOf(cwd: string, nowMs = Date.now()): Promise<string> {
  if (!cwd) return ""
  const hit = branchCache.get(cwd)
  if (hit && nowMs - hit.t < 10_000) return hit.v
  const b = (await $`git -C ${cwd} rev-parse --abbrev-ref HEAD`.nothrow().quiet().text()).trim()
  branchCache.set(cwd, { v: b, t: nowMs })
  return b
}

export async function discoverAgents(): Promise<RawProc[]> {
  const out = await $`ps -axo pid=,etime=,rss=,command=`.nothrow().quiet().text()
  const found: Omit<RawProc, "cwd">[] = []
  for (const line of out.split("\n")) {
    const m = line.match(/^\s*(\d+)\s+(\S+)\s+(\d+)\s+(.*)$/)
    if (!m) continue
    const [, pidS, etime, rssS, cmd] = m

    let kind: AgentKind | null = null
    if (
      cmd.includes("claude.app/Contents/MacOS/claude") &&
      cmd.includes("stream-json") &&
      !cmd.includes("Helpers/disclaimer")
    ) {
      kind = "claude"
    } else if (/(^|\/)codex(\s|$)/.test(cmd) && !cmd.includes(" grep ") && !cmd.includes("ps -axo")) {
      kind = "codex"
    }
    if (!kind) continue

    // parse ONLY the model + resume tokens — never retain the raw cmd (it can hold secrets)
    const model = cmd.match(/--model[= ]+(\S+)/)?.[1] ?? ""
    const resumeId = cmd.match(/--resume[= ]+([0-9a-f-]{8,})/)?.[1]
    const pid = parseInt(pidS, 10)
    found.push({ pid, kind, etimeSec: etimeToSec(etime), rssKB: parseInt(rssS, 10), model, resumeId })
  }
  // cwd lookups spawn lsof on cache misses — resolve them concurrently
  const cwds = await Promise.all(found.map((f) => cwdOf(f.pid)))
  // the Codex desktop app keeps one global `codex app-server` daemon rooted at "/" —
  // not a session (its per-workspace engines carry real cwds), so drop it
  return found.map((f, i) => ({ ...f, cwd: cwds[i] })).filter((f) => !(f.kind === "codex" && f.cwd === "/"))
}
