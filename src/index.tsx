#!/usr/bin/env bun
import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import { App } from "./App"
import { applyTerminalPalette } from "./theme"

// A dashboard should never die on a stray async error — keep rendering.
process.on("unhandledRejection", () => {})
process.on("uncaughtException", () => {})

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
