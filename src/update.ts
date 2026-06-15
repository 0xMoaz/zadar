import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { createHash } from "node:crypto"
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

// ── self-update ──────────────────────────────────────────────────────────────

const REPO = "0xMoaz/zadar"
const RELEASES_LATEST = `https://api.github.com/repos/${REPO}/releases/latest`
const APPLIED = join(process.env.HOME ?? "", ".zadar", "update-applied")

export type UpdateChannel = "binary" | "global-npm" | "none"

// climb from `dir` looking for a .git — a working checkout we must NEVER self-update
function inGitCheckout(dir: string): boolean {
  let d = dir
  for (let i = 0; i < 15; i++) {
    if (existsSync(join(d, ".git"))) return true
    const up = dirname(d)
    if (up === d) return false
    d = up
  }
  return false
}

/**
 * How this copy may update itself:
 *  - "binary"     — a compiled standalone (install.sh): swap the executable from the release
 *  - "global-npm" — a global bun/npm install: re-install with `bun add -g zadar@latest`
 *  - "none"       — a dev checkout (has .git) or a bunx/temp run: never touched automatically
 */
export function updateChannel(execPath = process.execPath, root = dirname(import.meta.dir)): UpdateChannel {
  if (installKind(execPath) === "binary") return "binary"
  if (inGitCheckout(root)) return "none" // hands off a working checkout
  // a real global install lives under node_modules (bun -g / npm -g); bunx runs from a cache
  return /[/\\]node_modules[/\\]/.test(root) && !/[/\\]cache[/\\]/.test(root) ? "global-npm" : "none"
}

/** the release asset for this platform, e.g. "zadar-darwin-arm64.zip" */
export function assetName(arch: string = process.arch): string {
  return `zadar-darwin-${arch === "arm64" ? "arm64" : "x64"}.zip`
}

export interface Release {
  version: string
  zipUrl: string
  shaUrl: string
}

/** the latest GitHub release + this platform's binary asset, or null */
export async function latestRelease(
  fetcher: (url: string) => Promise<{ json: () => Promise<any> }> = (u) => fetch(u),
): Promise<Release | null> {
  try {
    const body = await (await fetcher(RELEASES_LATEST)).json()
    const tag: string | undefined = body?.tag_name
    if (!tag) return null
    const want = assetName()
    const assets: any[] = Array.isArray(body?.assets) ? body.assets : []
    const url = (n: string): string | undefined => assets.find((a) => a?.name === n)?.browser_download_url
    const zipUrl = url(want)
    if (!zipUrl) return null
    return { version: tag.replace(/^v/, ""), zipUrl, shaUrl: url(`${want}.sha256`) ?? "" }
  } catch {
    return null
  }
}

/** download + checksum-verify + atomically swap the running standalone binary. The
 * new version applies on the next launch (the live process keeps its old inode).
 * Returns the new version, or null. Silent on any failure. */
async function updateBinary(): Promise<string | null> {
  const rel = await latestRelease()
  if (!rel || !isNewer(VERSION, rel.version)) return null
  const exe = process.execPath
  const dir = dirname(exe)
  const stamp = `${process.pid}-${rel.version}`
  const tmpZip = join(dir, `.zadar-update-${stamp}.zip`)
  const tmpDir = join(dir, `.zadar-update-${stamp}`)
  try {
    const res = await fetch(rel.zipUrl)
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (rel.shaUrl) {
      const expected = (await (await fetch(rel.shaUrl)).text()).trim().split(/\s+/)[0]
      const actual = createHash("sha256").update(buf).digest("hex")
      if (expected && expected !== actual) return null // corrupt / tampered → abort
    }
    writeFileSync(tmpZip, buf)
    mkdirSync(tmpDir, { recursive: true })
    if (Bun.spawnSync(["unzip", "-oq", tmpZip, "-d", tmpDir]).exitCode !== 0) return null
    const next = join(tmpDir, "zadar")
    if (!existsSync(next)) return null
    chmodSync(next, 0o755)
    Bun.spawnSync(["xattr", "-d", "com.apple.quarantine", next]) // best-effort, avoids Gatekeeper
    renameSync(next, exe) // atomic on the same fs; the running process keeps the old inode
    return rel.version
  } catch {
    return null
  } finally {
    try {
      rmSync(tmpZip, { force: true })
      rmSync(tmpDir, { recursive: true, force: true })
    } catch {
      /* temp cleanup is best-effort */
    }
  }
}

/** apply an update for how this copy is installed; the new version lands on the next
 * launch. Returns the version applied (`target` for npm) or null. Never throws. */
export async function selfUpdate(channel: UpdateChannel, target?: string): Promise<string | null> {
  try {
    if (channel === "binary") return await updateBinary()
    if (channel === "global-npm") {
      const r = Bun.spawnSync(["bun", "add", "-g", "zadar@latest"], { stdout: "ignore", stderr: "ignore" })
      return r.exitCode === 0 ? (target ?? null) : null
    }
  } catch {
    /* best-effort */
  }
  return null
}

/** remember that `version` is staged for the next launch (so the UI can nudge a restart) */
export function markUpdateApplied(version: string, file = APPLIED): void {
  try {
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, version)
  } catch {
    /* best-effort */
  }
}

/** a downloaded-but-not-yet-running update, if any; clears itself once we're on it */
export function pendingUpdate(current = VERSION, file = APPLIED): string | null {
  try {
    const v = readFileSync(file, "utf8").trim()
    if (v && isNewer(current, v)) return v
    if (v) rmSync(file, { force: true }) // we're already on it (or newer) — drop the marker
  } catch {
    /* no marker */
  }
  return null
}
