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

describe("map view — the attention queue", () => {
  test("queue ranks every actionable item; map lists projects alphabetically", async () => {
    const s = await mount(100, 60) // tall enough that no project card culls out of view
    const f = s.captureCharFrame()
    expect(f).toContain("NEEDS YOU")
    expect(f).toContain('"Should I overwrite the existing config')
    expect(f).toContain("① Overwrite")
    expect(f).toContain(":3000 holding 14.0G of memory")
    expect(f).toContain("review +214 −38 across 9 files")
    expect(f).toContain("PROJECTS")
    expect(f).toContain("api-gateway")
    expect(f).toContain("playground") // the map is the whole world, idle included
  })

  test("Enter on a queue item inspects its full entity in place", async () => {
    const s = await mount(110, 44)
    await press(s, "j", "RETURN")
    let f = s.captureCharFrame()
    expect(f).toContain("~/Code/webapp/.claude/worktrees/fix-auth")
    await press(s, "RETURN")
    f = s.captureCharFrame()
    expect(f).not.toContain("~/Code/webapp/.claude/worktrees/fix-auth")
  })

  test("x on a queue item targets the underlying agent", async () => {
    const s = await mount()
    await press(s, "j", "x")
    expect(s.captureCharFrame()).toContain("kill webapp · pid 74867?")
    await press(s, "n")
  })

  test("Enter on a project card opens its agents, server, and trees", async () => {
    const s = await mount(110, 44)
    // fold the queue, walk to PROJECTS, open the first project (api-gateway)
    await press(s, "RETURN", "j", "j", "RETURN")
    const f = s.captureCharFrame()
    expect(f).toContain("feat/rate-limit") // its agent row (branch shows on agent rows only)
    expect(f).toContain("localhost:8787") // its (stale) server
  })

  test("v toggles to classic and back", async () => {
    const s = await mount()
    await press(s, "v")
    expect(s.captureCharFrame()).toContain("AGENTS")
    await press(s, "v")
    expect(s.captureCharFrame()).toContain("NEEDS YOU")
  })
})

describe("classic view", () => {
  test("urgent rows auto-expand; Enter discloses detail; i reveals idle", async () => {
    const s = await mount()
    await press(s, "v")
    let f = s.captureCharFrame()
    expect(f).toContain('"Should I overwrite the existing config')
    expect(f).not.toContain("playground")
    await press(s, "j", "RETURN")
    f = s.captureCharFrame()
    expect(f).toContain("~/Code/webapp/.claude/worktrees/fix-auth")
    expect(f).toContain("✓ bun test → 42 pass")
    await press(s, "RETURN", "i")
    f = s.captureCharFrame()
    expect(f).not.toContain("~/Code/webapp/.claude/worktrees/fix-auth")
    expect(f).toContain("playground")
  })

  test("x asks before killing; n cancels", async () => {
    const s = await mount()
    await press(s, "v", "j", "x")
    let f = s.captureCharFrame()
    expect(f).toContain("kill webapp · pid 74867?")
    expect(f).toContain("y / n")
    await press(s, "n")
    f = s.captureCharFrame()
    expect(f).not.toContain("y / n")
  })
})

describe("worktree drill-in (classic)", () => {
  test("Enter on a repo lists its trees; p on a dirty tree refuses", async () => {
    const s = await mount()
    // classic → fold agents, walk to worktrees, unfold, drill into the first repo
    await press(s, "v", "RETURN", "j", "j", "RETURN", "j", "RETURN")
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
    await press(s, "v", "RETURN", "j", "j", "RETURN", "j", "RETURN")
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
