import { $ } from "bun"

export interface DiffStat {
  files: number
  plus: number
  minus: number
}

/** "9 files changed, 214 insertions(+), 38 deletions(-)" → {9, 214, 38} */
export function parseShortstat(out: string): DiffStat | undefined {
  const m = out.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/)
  if (!m) return undefined
  return { files: +m[1], plus: +(m[2] ?? 0), minus: +(m[3] ?? 0) }
}

// what-did-it-change is review-time info — a 15s cache keeps git quiet
const cache = new Map<string, { v: DiffStat | undefined; t: number }>()
const TTL = 15_000

export async function diffOf(cwd: string, nowMs = Date.now()): Promise<DiffStat | undefined> {
  if (!cwd) return undefined
  const hit = cache.get(cwd)
  if (hit && nowMs - hit.t < TTL) return hit.v
  const out = await $`git -C ${cwd} diff --shortstat HEAD`.nothrow().quiet().text()
  const v = parseShortstat(out)
  cache.set(cwd, { v, t: nowMs })
  return v
}
