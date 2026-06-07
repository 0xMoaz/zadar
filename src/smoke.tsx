#!/usr/bin/env bun
/**
 * Headless render of the rich mock at a few widths / states.
 *   bun run smoke
 */
import { act } from "react"
import { testRender } from "@opentui/react/test-utils"
import { App } from "./App"
import { mockSnapshot } from "./mock"

async function shot(label: string, width: number, height: number, pressIdle = false) {
  const setup = await testRender(<App snapshot={mockSnapshot} live={false} />, { width, height })
  await setup.renderOnce()
  if (pressIdle) {
    await act(async () => {
      await setup.mockInput.pressKey("i")
    })
    await setup.renderOnce()
  }
  console.log(`\n──────── ${label} ────────`)
  console.log(setup.captureCharFrame())
  setup.renderer.destroy()
}

await shot("DEFAULT — active only (100×36)", 100, 36)
await shot("SHOW ALL — i pressed, idle revealed (100×40)", 100, 40, true)
await shot("NARROW (72×40)", 72, 40)

process.exit(0)
