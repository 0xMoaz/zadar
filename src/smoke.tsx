#!/usr/bin/env bun
/**
 * Headless render of the rich mock at a few widths / states.
 *   bun run smoke
 */
import { act } from "react"
import { testRender } from "@opentui/react/test-utils"
import { App } from "./App"
import { mockSnapshot } from "./mock"

async function shot(label: string, width: number, height: number, keys: string[] = []) {
  const setup = await testRender(<App snapshot={mockSnapshot} live={false} />, { width, height })
  await setup.renderOnce()
  for (const k of keys) {
    await act(async () => {
      await setup.mockInput.pressKey(k)
    })
    await act(async () => {
      await setup.renderOnce()
    })
  }
  console.log(`\n──────── ${label} ────────`)
  console.log(setup.captureCharFrame())
  setup.renderer.destroy()
}

await shot("DEFAULT — active only (100×34)", 100, 34)
await shot("DETAILS — first agent expanded (100×36)", 100, 36, ["j", "RETURN"])
await shot("SHOW ALL — idle revealed (100×38)", 100, 38, ["i"])
await shot("NARROW (72×36)", 72, 36)
await shot("DENSE SPLIT (84×18)", 84, 18)
await shot("WORKTREES — drilled into a repo (90×30)", 90, 30, ["RETURN", "j", "j", "RETURN", "j", "RETURN"])

process.exit(0)
