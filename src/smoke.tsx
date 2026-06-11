#!/usr/bin/env bun
/**
 * Headless render of the rich mock at a few widths / states.
 *   bun run smoke
 */
import { act } from "react"
import { testRender } from "@opentui/react/test-utils"
import { App } from "./App"
import { mockSnapshot } from "./mock"
import type { Snapshot } from "./types"

// a calm fleet: everyone working or idle, servers healthy → the queue is clear
const calmSnapshot: Snapshot = {
  ...mockSnapshot,
  agents: mockSnapshot.agents.filter((a) => a.status === "working" && a.contextPct < 90),
  servers: mockSnapshot.servers.filter((s) => !s.stale && s.memKB < 4 * 1024 * 1024),
}

async function shot(label: string, width: number, height: number, keys: string[] = [], snapshot = mockSnapshot) {
  const setup = await testRender(<App snapshot={snapshot} live={false} />, { width, height })
  await setup.renderOnce()
  for (const k of keys) {
    await act(async () => {
      await setup.mockInput.pressKey(k as any)
    })
    await act(async () => {
      await setup.renderOnce()
    })
  }
  console.log(`\n──────── ${label} ────────`)
  console.log(setup.captureCharFrame())
  await act(async () => {
    setup.renderer.destroy()
  })
}

await shot("THE VIEW — queue first (100×42)", 100, 42)
await shot("SERENE — queue clear (90×24)", 90, 24, [], calmSnapshot)
await shot("PROJECTS DRILLED (100×50)", 100, 50, [
  "RETURN", "j", "RETURN", "j", "j", "RETURN", "j", "j", "j", "j", "j", "j", "j", "RETURN",
])
await shot("NARROW (72×36)", 72, 36)
await shot("DENSE SPLIT (84×18)", 84, 18)

process.exit(0)
