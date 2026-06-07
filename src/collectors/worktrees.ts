import { $ } from "bun"
import { readdirSync, existsSync } from "node:fs"
import { join } from "node:path"
import type { RepoWorktrees } from "../types"

const HOME = process.env.HOME ?? ""

// worktree dirty-status changes slowly and is the heaviest collector (a git
// spawn per worktree). Cache the whole result with a short TTL.
let cache: { v: RepoWorktrees[]; t: number } | null = null
const TTL = 15_000

export async function collectWorktrees(nowMs = Date.now()): Promise<RepoWorktrees[]> {
  if (cache && nowMs - cache.t < TTL) return cache.v
  const v = await scanWorktrees()
  cache = { v, t: nowMs }
  return v
}

async function scanWorktrees(): Promise<RepoWorktrees[]> {
  const codeDir = join(HOME, "Code")
  let repos: string[]
  try {
    repos = readdirSync(codeDir)
  } catch {
    return []
  }

  const out: RepoWorktrees[] = []
  for (const repo of repos) {
    const wts = join(codeDir, repo, ".claude", "worktrees")
    if (!existsSync(wts)) continue
    let dirs: string[]
    try {
      dirs = readdirSync(wts)
    } catch {
      continue
    }
    let total = 0
    let changed = 0
    for (const d of dirs) {
      const p = join(wts, d)
      total++
      const st = await $`git -C ${p} status --porcelain`.nothrow().quiet().text()
      if (st.split("\n").filter((l) => l.trim()).length > 0) changed++
    }
    if (total > 0) out.push({ repo, total, changed })
  }
  return out
}
