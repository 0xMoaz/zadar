#!/usr/bin/env bun
import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import { App } from "./App"
import { applyTerminalPalette } from "./theme"
import { collect } from "./collect"
import { loadToday } from "./history"

// A dashboard should never die on a stray async error — keep rendering.
process.on("unhandledRejection", () => {})
process.on("uncaughtException", () => {})

// --api [port]: the same truth as JSON, localhost-only — lets a richer
// surface (web / Readout / menubar) mount fleet's data without owning it.
const argv = process.argv.slice(2)
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
        return new Response("fleet api · GET /snapshot · GET /events\n", { status: 404 })
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
