#!/usr/bin/env bun
/** End-to-end check: collect a REAL snapshot, render it headlessly, print frames. */
import { testRender } from "@opentui/react/test-utils"
import { App } from "./App"
import { collect } from "./collect"

const snap = await collect()

const sizes = [
  { label: "WIDE (120×32)", width: 120, height: 32 },
  { label: "NARROW (76×28)", width: 76, height: 28 },
]

for (const { label, width, height } of sizes) {
  const setup = await testRender(<App snapshot={snap} live={false} />, { width, height })
  await setup.renderOnce()
  console.log(`\n──────── ${label} ────────`)
  console.log(setup.captureCharFrame())
  setup.renderer.destroy()
}

process.exit(0)
