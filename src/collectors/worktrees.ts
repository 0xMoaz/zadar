import { $ } from "bun"
import { readdirSync, existsSync, statSync } from "node:fs"
import { join } from "node:path"
import type { RepoWorktrees, WorktreeItem } from "../types"

const HOME = process.env.HOME ?? ""

// worktree status changes slowly and is the heaviest collector (git spawns
// per worktree). Cache the whole result with a short TTL; bust after prunes.
let cache: { v: RepoWorktrees[]; t: number } | null = null
const TTL = 15_000

export function invalidateWorktrees(): void {
  cache = null
}

export async function collectWorktrees(nowMs = Date.now()): Promise<RepoWorktrees[]> {
  if (cache && nowMs - cache.t < TTL) return cache.v
  const v = await scanWorktrees(nowMs)
  cache = { v, t: nowMs }
  return v
}

async function scanWorktrees(nowMs: number): Promise<RepoWorktrees[]> {
  const codeDir = join(HOME, "Code")
  let repos: string[]
  try {
    repos = readdirSync(codeDir)
  } catch {
    return []
  }

  const out: RepoWorktrees[] = []
  for (const repo of repos) {
    const repoPath = join(codeDir, repo)
    const wts = join(repoPath, ".claude", "worktrees")
    if (!existsSync(wts)) continue
    let dirs: string[]
    try {
      dirs = readdirSync(wts)
    } catch {
      continue
    }
    const items: WorktreeItem[] = []
    for (const d of dirs) {
      const p = join(wts, d)
      let ageDays = 0
      try {
        ageDays = Math.floor((nowMs - statSync(p).mtimeMs) / 86_400_000)
      } catch {
        continue
      }
      const branch = (await $`git -C ${p} rev-parse --abbrev-ref HEAD`.nothrow().quiet().text()).trim()
      const st = await $`git -C ${p} status --porcelain`.nothrow().quiet().text()
      const dirty = st.split("\n").filter((l) => l.trim()).length
      items.push({ name: d, branch, dirty, ageDays, path: p })
    }
    if (items.length > 0) {
      // dirty first (needs a decision), then oldest — the prune queue orders itself
      items.sort((a, b) => (b.dirty > 0 ? 1 : 0) - (a.dirty > 0 ? 1 : 0) || b.ageDays - a.ageDays)
      out.push({
        repo,
        path: repoPath,
        total: items.length,
        changed: items.filter((i) => i.dirty > 0).length,
        items,
      })
    }
  }
  return out
}
