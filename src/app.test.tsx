import { afterEach, describe, expect, test } from "bun:test"
import { act } from "react"
import { testRender } from "@opentui/react/test-utils"
import { App } from "./App"
import { mockSnapshot } from "./mock"

type Setup = Awaited<ReturnType<typeof testRender>>
let current: Setup | null = null

async function mount(width = 100, height = 40): Promise<Setup> {
  const setup = await testRender(<App snapshot={mockSnapshot} live={false} />, { width, height })
  await setup.renderOnce()
  current = setup
  return setup
}

async function press(setup: Setup, ...keys: string[]) {
  for (const k of keys) {
    await act(async () => {
      await setup.mockInput.pressKey(k as any)
    })
    await act(async () => {
      await setup.renderOnce()
    })
  }
}

afterEach(() => {
  current?.renderer.destroy()
  current = null
})

describe("disclosure", () => {
  test("urgent rows auto-expand their question and chips at rest", async () => {
    const s = await mount()
    const f = s.captureCharFrame()
    expect(f).toContain('"Should I overwrite the existing config')
    expect(f).toContain("① Overwrite")
    expect(f).toContain("run terraform apply -auto-approve")
    // calm agents stay one line: no detail content visible
    expect(f).not.toContain("~/Code/webapp/.claude/worktrees/fix-auth")
  })

  test("Enter discloses detail; Enter again collapses", async () => {
    const s = await mount()
    await press(s, "j", "RETURN")
    let f = s.captureCharFrame()
    expect(f).toContain("~/Code/webapp/.claude/worktrees/fix-auth")
    expect(f).toContain("✓ bun test → 42 pass")
    await press(s, "RETURN")
    f = s.captureCharFrame()
    expect(f).not.toContain("~/Code/webapp/.claude/worktrees/fix-auth")
  })

  test("i reveals idle sessions", async () => {
    const s = await mount()
    expect(s.captureCharFrame()).not.toContain("playground")
    await press(s, "i")
    expect(s.captureCharFrame()).toContain("playground")
  })
})

describe("kill flow", () => {
  test("x asks before killing; n cancels", async () => {
    const s = await mount()
    await press(s, "j", "x")
    let f = s.captureCharFrame()
    expect(f).toContain("kill webapp · pid 74867?")
    expect(f).toContain("y / n")
    await press(s, "n")
    f = s.captureCharFrame()
    expect(f).not.toContain("y / n")
  })
})

describe("worktree drill-in", () => {
  test("Enter on a repo lists its trees; p on a dirty tree refuses", async () => {
    const s = await mount()
    // fold agents, walk to worktrees, unfold, drill into the first repo
    await press(s, "RETURN", "j", "j", "RETURN", "j", "RETURN")
    let f = s.captureCharFrame()
    expect(f).toContain("feat-pairing · feat/pairing")
    expect(f).toContain("12 dirty · 1d")
    // select the dirty tree and try to prune
    await press(s, "j", "p")
    f = s.captureCharFrame()
    expect(f).toContain("has 12 dirty files — not pruning")
  })

  test("p on a clean tree asks for confirmation", async () => {
    const s = await mount()
    await press(s, "RETURN", "j", "j", "RETURN", "j", "RETURN")
    // items: feat-pairing (dirty), fix-ws-leak (dirty), agent-7 (clean)
    await press(s, "j", "j", "j", "p")
    const f = s.captureCharFrame()
    expect(f).toContain("prune omnipair-webapp/agent-7 (clean, 19d)?")
    await press(s, "n") // cancel — never actually prune in tests
  })
})

describe("overlays", () => {
  test("? opens help with the full keymap", async () => {
    const s = await mount()
    await press(s, "?")
    const f = s.captureCharFrame()
    expect(f).toContain("prune a clean worktree")
    expect(f).toContain("toggle desktop notifications")
    await press(s, "?")
    expect(s.captureCharFrame()).not.toContain("toggle desktop notifications")
  })

  test("t opens the activity log (empty until something flips)", async () => {
    const s = await mount()
    await press(s, "t")
    expect(s.captureCharFrame()).toContain("no transitions yet")
    await press(s, "t") // toggle closed (bare ESC is buffered by the headless parser)
    expect(s.captureCharFrame()).not.toContain("no transitions yet")
  })
})

describe("header beacon", () => {
  test("counts every state and the fleet burn", async () => {
    const s = await mount()
    const f = s.captureCharFrame()
    expect(f).toContain("▲2")
    expect(f).toContain("✕1")
    expect(f).toContain("◆1")
    expect(f).toContain("$7.3/h")
  })
})
