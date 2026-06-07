import { $ } from "bun"
import { existsSync } from "node:fs"
import type { DevServer } from "../types"
import { cwdOf, branchOf, etimeToSec } from "./process"
import { shorten, fmtDuration } from "../format"

const DEV = /^(node|bun|deno|vite|next-server)/

export async function collectServers(): Promise<DevServer[]> {
  const lsof = await $`lsof -nP -iTCP -sTCP:LISTEN`.nothrow().quiet().text()
  const seen = new Set<string>()
  const servers: DevServer[] = []

  for (const line of lsof.split("\n").slice(1)) {
    const cols = line.split(/\s+/)
    if (cols.length < 9) continue
    const pid = parseInt(cols[1], 10)
    const port = parseInt(cols[8].split(":").pop() || "", 10)
    if (!port || isNaN(pid)) continue
    const key = `${port}:${pid}`
    if (seen.has(key)) continue
    seen.add(key)

    const base = (await $`ps -p ${pid} -o comm=`.nothrow().quiet().text()).trim().split("/").pop() || ""
    if (!DEV.test(base)) continue

    const rss = parseInt((await $`ps -p ${pid} -o rss=`.nothrow().quiet().text()).trim(), 10) || 0
    const etime = (await $`ps -p ${pid} -o etime=`.nothrow().quiet().text()).trim()
    const cwd = await cwdOf(pid)
    const project = shorten(cwd).split("/").pop() || base
    const branch = await branchOf(cwd)
    const stale = cwd ? !existsSync(cwd) : false
    servers.push({ port, pid, memKB: rss, uptime: fmtDuration(etimeToSec(etime)), project, branch, stale })
  }
  return servers.sort((a, b) => a.port - b.port)
}
