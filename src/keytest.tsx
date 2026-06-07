#!/usr/bin/env bun
/** Headless interaction test: drive keys via mockInput, assert the UI reacts. */
import { act } from "react"
import { testRender } from "@opentui/react/test-utils"
import { App } from "./App"
import { mockSnapshot } from "./mock"

const setup = await testRender(<App snapshot={mockSnapshot} live={false} />, { width: 100, height: 26 })
await setup.renderOnce()

const frame = () => setup.captureCharFrame()
const checks: string[] = []

// press x on the selected agent → confirm prompt appears
await act(async () => {
  await setup.mockInput.pressKey("x")
})
await setup.renderOnce()
checks.push(`x → kill confirm: ${frame().includes("kill") && frame().includes("y / n")}`)

// press n → confirm dismissed, footer hints back
await act(async () => {
  await setup.mockInput.pressKey("n")
})
await setup.renderOnce()
const f2 = frame()
checks.push(`n → dismissed: ${f2.includes("resume") && !f2.includes("y / n")}`)

// move down then back up works without crash
await act(async () => {
  await setup.mockInput.pressArrow("down")
  await setup.mockInput.pressArrow("up")
})
await setup.renderOnce()
checks.push(`nav ok: ${frame().includes("agents")}`)

console.log(checks.join("\n"))
const pass = checks.every((c) => c.endsWith("true"))
setup.renderer.destroy()
console.log(pass ? "ALL PASS" : "FAIL")
process.exit(pass ? 0 : 1)
