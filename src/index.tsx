#!/usr/bin/env bun
import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import { App } from "./App"
import { applyTerminalPalette } from "./theme"
import { collect } from "./collect"
import { loadToday } from "./history"
import { installKind, INSTALLER_URL, VERSION } from "./update"

// A dashboard should never die on a stray async error — keep rendering.
process.on("unhandledRejection", () => {})
process.on("uncaughtException", () => {})

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
      "  upgrade        update zadar in place (binary installs re-run the installer)",
      "",
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
  useMouse: false, // keyboard-driven; lets the terminal keep native mouse/scroll/copy
})

// Match the terminal's own palette (Ghostty theme) instead of hardcoded colors.
try {
  applyTerminalPalette(await renderer.getPalette({ timeout: 500 }))
} catch {
  /* no OSC support / not a tty → keep neutral defaults */
}

createRoot(renderer).render(<App />)
