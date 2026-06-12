import { $ } from "bun"
import { existsSync } from "node:fs"
import type { DevServer } from "../types"
import { cwdOf, branchOf, etimeToSec } from "./process"
import { shorten, fmtDuration } from "../format"

const DEV = /^(node|bun|deno|vite|next-server)/

export async function collectServers(): Promise<DevServer[]> {
  const lsof = await $`lsof -nP -iTCP -sTCP:LISTEN`.nothrow().quiet().text()
  const seen = new Set<string>()
  const listeners: { port: number; pid: number }[] = []

  for (const line of lsof.split("\n").slice(1)) {
    const cols = line.split(/\s+/)
    if (cols.length < 9) continue
    const pid = parseInt(cols[1], 10)
    const port = parseInt(cols[8].split(":").pop() || "", 10)
    if (!port || isNaN(pid)) continue
    const key = `${port}:${pid}`
    if (seen.has(key)) continue
    seen.add(key)
    listeners.push({ port, pid })
  }
  if (listeners.length === 0) return []

  // one batched ps answers rss/etime/comm for every listener — not 3 spawns per port
  const pids = [...new Set(listeners.map((l) => l.pid))].join(",")
  const ps = await $`ps -p ${pids} -o pid=,rss=,etime=,comm=`.nothrow().quiet().text()
  const info = new Map<number, { rssKB: number; etime: string; base: string }>()
  for (const line of ps.split("\n")) {
    const m = line.match(/^\s*(\d+)\s+(\d+)\s+(\S+)\s+(.+)$/)
    if (!m) continue
    info.set(parseInt(m[1], 10), {
      rssKB: parseInt(m[2], 10) || 0,
      etime: m[3],
      base: m[4].trim().split("/").pop() || "",
    })
  }

  const servers = (
    await Promise.all(
      listeners.map(async ({ port, pid }): Promise<DevServer | null> => {
        const i = info.get(pid)
        if (!i || !DEV.test(i.base)) return null
        const cwd = await cwdOf(pid)
        const project = shorten(cwd).split("/").pop() || i.base
        const branch = await branchOf(cwd)
        const stale = cwd ? !existsSync(cwd) : false
        return { port, pid, memKB: i.rssKB, uptime: fmtDuration(etimeToSec(i.etime)), project, branch, cwd, stale }
      }),
    )
  ).filter((s): s is DevServer => s !== null)
  return servers.sort((a, b) => a.port - b.port)
}
