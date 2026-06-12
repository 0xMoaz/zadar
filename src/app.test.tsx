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

afterEach(async () => {
  await act(async () => {
    current?.renderer.destroy()
  })
  current = null
})

describe("the one view — urgency first", () => {
  test("the queue leads; the world follows", async () => {
    const s = await mount(100, 60)
    const f = s.captureCharFrame()
    expect(f).toContain("Needs you")
    expect(f).toContain('“Should I overwrite the existing config')
    expect(f).toContain("1  Overwrite")
    expect(f).toContain(":3000 holding 14GB of memory")
    expect(f).toContain("review +214 −38 across 9 files")
    expect(f).toContain("Active sessions")
    expect(f).toContain("Servers")
    expect(f).toContain("Projects")
    expect(f).not.toContain("playground") // idle stays hidden in sessions until i
  })

  test("space on a queue item reveals its decision context, not session plumbing", async () => {
    const s = await mount(110, 44)
    // the error item (3rd) only says "failed tool call" on its row — unfolding
    // surfaces the failing action, and keeps the pid/model/cwd plumbing out
    await press(s, "j", "j", "j", " ")
    let f = s.captureCharFrame()
    expect(f).toContain("run bun test") // the failing action — the context you need
    expect(f).not.toContain("~/Code") // no cwd; that lives in Active sessions
    await press(s, " ")
    f = s.captureCharFrame()
    expect(f).not.toContain("run bun test")
  })

  test("x on a queue item targets the underlying agent; n cancels", async () => {
    const s = await mount()
    await press(s, "j", "x")
    let f = s.captureCharFrame()
    expect(f).toContain("kill webapp · pid 74867?")
    expect(f).toContain("y / n")
    await press(s, "n")
    f = s.captureCharFrame()
    expect(f).not.toContain("y / n")
  })

  test("Enter discloses a session's story", async () => {
    const s = await mount()
    // queue is pinned open — walk down past it (6 items) to the Active sessions
    // header (folded at boot while the queue has items), open it, step to the first agent
    await press(s, "j", "j", "j", "j", "j", "j", "j", "RETURN", "j", "RETURN")
    const f = s.captureCharFrame()
    expect(f).toContain("~/Code/webapp/.claude/worktrees/fix-auth")
    expect(f).toContain("task") // labeled story rows, not a tool log
    expect(f).toContain("“fix the auth redirect loop on the marketing pages”")
    expect(f).toContain("opus-4.8 1m") // the model names the engine — no brand mark needed
    expect(f).not.toContain("⬡") // codex rows carry no kind suffix (infra/codex is visible here)
  })

  test("Projects drills into worktrees; p guards dirty, confirms clean", async () => {
    const s = await mount(100, 90)
    // queue is pinned, so G lands on the collapsed Projects header; open it, walk to
    // omnipair-webapp (7th project group, alphabetical), expand its worktrees
    await press(s, "G", "RETURN", "j", "j", "j", "j", "j", "j", "j", "RETURN")
    let f = s.captureCharFrame()
    expect(f).toContain("feat-pairing")
    expect(f).toContain("feat/pairing")
    expect(f).toContain("12 dirty · 1d")
    await press(s, "j", "p")
    f = s.captureCharFrame()
    expect(f).toContain("dirty files — not pruning")
    // items: feat-pairing (dirty), fix-ws-leak (dirty), agent-7 (clean)
    await press(s, "j", "j", "p")
    f = s.captureCharFrame()
    expect(f).toContain("prune omnipair-webapp/agent-7 (clean, 19d)?")
    await press(s, "n") // cancel — never actually prune in tests
  })

  test("G jumps to Projects; opening it shows every repo, idle included", async () => {
    const s = await mount(100, 90)
    await press(s, "G", "RETURN") // G → pinned-queue means last row is Projects; open it
    const f = s.captureCharFrame()
    expect(f).toContain("api-gateway")
    expect(f).toContain("playground")
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
