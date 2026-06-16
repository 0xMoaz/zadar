import { describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  assetName,
  checkForUpdate,
  installKind,
  isNewer,
  latestRelease,
  markUpdateApplied,
  pendingUpdate,
  updateChannel,
  upgradeHint,
} from "./update"

describe("installKind", () => {
  test("running through bun → source", () => {
    expect(installKind("/Users/zee/.bun/bin/bun")).toBe("source")
    expect(installKind("/usr/local/bin/bunx")).toBe("source")
    expect(installKind("/opt/homebrew/bin/bun-1.3.10")).toBe("source")
  })
  test("a compiled standalone → binary", () => {
    expect(installKind("/Users/zee/.zadar/bin/zadar")).toBe("binary")
    expect(installKind("/usr/local/bin/zadar")).toBe("binary")
  })
  test("hints match the install", () => {
    expect(upgradeHint("binary")).toBe("zadar upgrade")
    expect(upgradeHint("source")).toBe("bun add -g zadar@latest")
  })
})

describe("isNewer", () => {
  test("compares semver fields numerically", () => {
    expect(isNewer("0.3.0", "0.4.0")).toBe(true)
    expect(isNewer("0.3.0", "0.3.1")).toBe(true)
    expect(isNewer("0.9.0", "0.10.0")).toBe(true) // numeric, not lexical
    expect(isNewer("1.0.0", "0.9.9")).toBe(false)
    expect(isNewer("0.3.0", "0.3.0")).toBe(false)
  })
})

describe("checkForUpdate", () => {
  const file = () => join(mkdtempSync(join(tmpdir(), "zf-up-")), "update.json")
  const fetcher = (version: string) => async () => ({ json: async () => ({ version }) })

  test("returns the latest version when behind, and caches it", async () => {
    const f = file()
    const latest = await checkForUpdate({ current: "0.3.0", file: f, fetcher: fetcher("0.4.0"), now: 1000 })
    expect(latest).toBe("0.4.0")
    expect(JSON.parse(readFileSync(f, "utf8"))).toEqual({ latest: "0.4.0", t: 1000 })
  })

  test("returns null when current is up to date", async () => {
    expect(await checkForUpdate({ current: "0.4.0", file: file(), fetcher: fetcher("0.4.0") })).toBeNull()
  })

  test("serves the cache without refetching inside the TTL", async () => {
    const f = file()
    await checkForUpdate({ current: "0.3.0", file: f, fetcher: fetcher("0.4.0"), now: 0 })
    let fetched = false
    const spy = async () => {
      fetched = true
      return { json: async () => ({ version: "0.5.0" }) }
    }
    const latest = await checkForUpdate({ current: "0.3.0", file: f, fetcher: spy, now: 1000 })
    expect(fetched).toBe(false)
    expect(latest).toBe("0.4.0")
  })

  test("network failure is silent — falls back to cache", async () => {
    const f = file()
    await checkForUpdate({ current: "0.3.0", file: f, fetcher: fetcher("0.4.0"), now: 0 })
    const boom = async () => {
      throw new Error("offline")
    }
    const latest = await checkForUpdate({ current: "0.3.0", file: f, fetcher: boom, now: 10 * 24 * 3600_000 })
    expect(latest).toBe("0.4.0") // stale cache, not a crash
  })

  test("no cache + network failure → null, never throws", async () => {
    expect(await checkForUpdate({ current: "0.3.0", file: file(), fetcher: async () => { throw new Error("x") } })).toBeNull()
  })
})

describe("updateChannel", () => {
  const bun = "/Users/zee/.bun/bin/bun"

  test("a compiled standalone → binary (regardless of root)", () => {
    expect(updateChannel("/Users/zee/.zadar/bin/zadar", "/anywhere")).toBe("binary")
  })

  test("a dev checkout (a .git ancestor) → none — never self-updates", () => {
    expect(updateChannel(bun, join(import.meta.dir, ".."))).toBe("none") // this repo, has .git
  })

  test("a global install (node_modules, no .git) → global-npm", () => {
    const root = join(mkdtempSync(join(tmpdir(), "zf-g-")), ".bun", "install", "global", "node_modules", "zadar")
    mkdirSync(root, { recursive: true })
    expect(updateChannel(bun, root)).toBe("global-npm")
  })

  test("a bunx cache run → none (ephemeral, leave it)", () => {
    const root = join(mkdtempSync(join(tmpdir(), "zf-c-")), ".bun", "install", "cache", "zadar@0.4.0", "node_modules", "zadar")
    mkdirSync(root, { recursive: true })
    expect(updateChannel(bun, root)).toBe("none")
  })
})

describe("assetName", () => {
  test("names this platform's release zip", () => {
    expect(assetName("arm64")).toBe("zadar-darwin-arm64.zip")
    expect(assetName("x64")).toBe("zadar-darwin-x64.zip")
    expect(assetName("ia32")).toBe("zadar-darwin-x64.zip") // anything non-arm → x64
  })
})

describe("latestRelease", () => {
  const ok = () => ({
    json: async () => ({
      tag_name: "v0.5.0",
      assets: [
        { name: assetName(), browser_download_url: "https://x/zip" },
        { name: `${assetName()}.sha256`, browser_download_url: "https://x/sha" },
      ],
    }),
  })

  test("picks this platform's zip + checksum from the latest release", async () => {
    expect(await latestRelease(async () => ok())).toEqual({
      version: "0.5.0",
      zipUrl: "https://x/zip",
      shaUrl: "https://x/sha",
    })
  })

  test("no matching asset, no tag, or a thrown fetch → null (never crashes launch)", async () => {
    expect(await latestRelease(async () => ({ json: async () => ({ tag_name: "v0.5.0", assets: [] }) }))).toBeNull()
    expect(await latestRelease(async () => ({ json: async () => ({}) }))).toBeNull()
    expect(await latestRelease(async () => { throw new Error("offline") })).toBeNull()
  })
})

describe("pendingUpdate / markUpdateApplied", () => {
  test("a staged newer version shows until you're running it, then clears", () => {
    const f = join(mkdtempSync(join(tmpdir(), "zf-m-")), "applied")
    markUpdateApplied("0.5.0", f)
    expect(pendingUpdate("0.4.0", f)).toBe("0.5.0") // downloaded, awaiting restart
    expect(pendingUpdate("0.5.0", f)).toBeNull() // now running it → marker dropped
    expect(pendingUpdate("0.4.0", f)).toBeNull() // and stays gone
  })

  test("no marker → null", () => {
    expect(pendingUpdate("0.4.0", join(tmpdir(), "zf-absent-marker"))).toBeNull()
  })
})
