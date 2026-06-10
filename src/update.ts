import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import pkg from "../package.json"

/** the running version — bundled into the compiled binary via the JSON import */
export const VERSION: string = pkg.version

const CACHE = join(process.env.HOME ?? "", ".zadar", "update.json")
const TTL = 24 * 3600_000
const REGISTRY = "https://registry.npmjs.org/zadar/latest"

export type InstallKind = "binary" | "source"

/**
 * How this copy runs: a compiled standalone binary IS the executable;
 * source installs (npm / bunx / clone) execute through the bun runtime.
 */
export function installKind(execPath = process.execPath): InstallKind {
  return /(^|\/)bun(x)?([.-][\w.]+)?$/.test(execPath) ? "source" : "binary"
}

export const INSTALLER_URL = "https://raw.githubusercontent.com/0xMoaz/zadar/main/install.sh"

/** the right upgrade command for how this copy was installed */
export function upgradeHint(kind: InstallKind = installKind()): string {
  return kind === "binary" ? "zadar upgrade" : "bun add -g zadar@latest"
}

/** true when `b` is a higher semver than `a` (major.minor.patch, numeric) */
export function isNewer(a: string, b: string): boolean {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0)
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < 3; i++) {
    const x = pa[i] ?? 0
    const y = pb[i] ?? 0
    if (y !== x) return y > x
  }
  return false
}

interface Cache {
  latest: string
  t: number
}

/**
 * Ambient update check: the newest published version if we're behind, else null.
 * Cached for a day, network failure is silent, never blocks the UI. Deps are
 * injectable so the logic is testable without touching the network or $HOME.
 */
export async function checkForUpdate(
  opts: {
    now?: number
    file?: string
    current?: string
    fetcher?: (url: string) => Promise<{ json: () => Promise<any> }>
  } = {},
): Promise<string | null> {
  const now = opts.now ?? Date.now()
  const file = opts.file ?? CACHE
  const current = opts.current ?? VERSION

  let cached: Cache | null = null
  try {
    cached = JSON.parse(readFileSync(file, "utf8"))
  } catch {
    /* no cache yet */
  }

  let latest: string | undefined = cached?.latest
  if (!cached || now - cached.t >= TTL) {
    try {
      const res = await (opts.fetcher ?? fetch)(REGISTRY)
      const body = await res.json()
      if (body?.version) {
        latest = body.version
        try {
          mkdirSync(join(file, ".."), { recursive: true })
          writeFileSync(file, JSON.stringify({ latest, t: now }))
        } catch {
          /* cache write is best-effort */
        }
      }
    } catch {
      /* offline / registry down → fall back to the cached value, if any */
    }
  }

  return latest && isNewer(current, latest) ? latest : null
}
