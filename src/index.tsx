#!/usr/bin/env bun
import { appendFileSync, mkdirSync, renameSync, statSync } from "node:fs"
import { join } from "node:path"
import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import { App } from "./App"
import { ensureMark } from "./mark"
import { applyTerminalPalette } from "./theme"
import { collect } from "./collect"
import { mockSnapshot } from "./mock"
import { loadToday } from "./history"
import { checkForUpdate, installKind, INSTALLER_URL, markUpdateApplied, selfUpdate, updateChannel, VERSION } from "./update"

// A dashboard should never die on a stray async error — keep rendering, but
// leave a trace so "it shows nothing" reports are diagnosable after the fact.
const ERR_LOG = join(process.env.HOME ?? "", ".zadar", "errors.log")
try {
  // rotate at launch so the cap below never silences logging permanently
  if (statSync(ERR_LOG).size > 256 * 1024) renameSync(ERR_LOG, `${ERR_LOG}.1`)
} catch {
  /* nothing to rotate */
}
const logSwallowed = (kind: string) => (e: unknown) => {
  try {
    if (statSync(ERR_LOG).size > 256 * 1024) return // capped until the next launch rotates
  } catch {
    /* not there yet */
  }
  try {
    mkdirSync(join(ERR_LOG, ".."), { recursive: true })
    appendFileSync(ERR_LOG, `${new Date().toISOString()} ${kind}: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}\n`)
  } catch {
    /* logging is best-effort, never fatal */
  }
}
process.on("unhandledRejection", logSwallowed("unhandledRejection"))
process.on("uncaughtException", logSwallowed("uncaughtException"))

const argv = process.argv.slice(2)

if (argv.includes("--version") || argv.includes("-v")) {
  console.log(`zadar v${VERSION}`)
  process.exit(0)
}

if (argv.includes("--help") || argv.includes("-h")) {
  console.log(
    [
      `zadar v${VERSION} — terminal mission control for parallel agents`,
      "",
      "usage:  zadar [options] [command]",
      "",
      "  --api [port]   also serve fleet state as JSON on 127.0.0.1 (default 7433)",
      "  --version      print the version",
      "  upgrade        force an update now (zadar auto-updates on launch by default)",
      "",
      "  auto-update applies on the next launch; ZADAR_NO_AUTO_UPDATE=1 opts out.",
      "keys are documented in-app — press ?",
    ].join("\n"),
  )
  process.exit(0)
}

if (argv[0] === "upgrade") {
  const cmd =
    installKind() === "binary"
      ? ["bash", "-c", `curl -fsSL ${INSTALLER_URL} | bash`]
      : ["bun", "add", "-g", "zadar@latest"]
  console.log(`→ ${cmd.join(" ")}`)
  const r = Bun.spawnSync(cmd, { stdout: "inherit", stderr: "inherit" })
  process.exit(r.exitCode ?? 1)
}

// --api [port]: the same truth as JSON, localhost-only — lets a richer
// surface (web / Readout / menubar) mount fleet's data without owning it.
const apiIdx = argv.indexOf("--api")
if (apiIdx >= 0) {
  const port = parseInt(argv[apiIdx + 1] ?? "", 10) || 7433
  Bun.serve({
    hostname: "127.0.0.1",
    port,
    fetch: async (req) => {
      try {
        const path = new URL(req.url).pathname
        if (path === "/snapshot") return Response.json(await collect())
        if (path === "/events") return Response.json(loadToday(Date.now()))
        return new Response("zadar api · GET /snapshot · GET /events\n", { status: 404 })
      } catch (e) {
        return new Response(String(e), { status: 500 })
      }
    },
  })
}

const renderer = await createCliRenderer({
  exitOnCtrlC: true,
  targetFps: 30,
  useMouse: true, // click navigates: queue items jump to the session, servers open in the browser
})

// Match the terminal's own palette (Ghostty theme) instead of hardcoded colors.
try {
  applyTerminalPalette(await renderer.getPalette({ timeout: 500 }))
} catch {
  /* no OSC support / not a tty → keep neutral defaults */
}

// --demo / --mock: a curated showcase fleet (no real sessions touched), spinners live.
const demo = argv.includes("--demo") || argv.includes("--mock")
const mark = ensureMark()
createRoot(renderer).render(demo ? <App snapshot={mockSnapshot} live={false} demo mark={mark} /> : <App mark={mark} />)

// Auto-update on launch: if a newer release is out, pull it in the background; it
// applies on the NEXT launch (the live session keeps running). Off for dev checkouts
// and bunx, and via ZADAR_NO_AUTO_UPDATE=1. Best-effort — never blocks or crashes launch.
if (!demo && !process.env.ZADAR_NO_AUTO_UPDATE) {
  const channel = updateChannel()
  if (channel !== "none") {
    void (async () => {
      const latest = await checkForUpdate() // daily-cached gate — only act when behind
      if (!latest) return
      const applied = await selfUpdate(channel, latest)
      if (applied) markUpdateApplied(applied)
    })().catch(logSwallowed("autoUpdate"))
  }
}
