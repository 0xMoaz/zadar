import { afterEach, describe, expect, test } from "bun:test"
import { act } from "react"
import { testRender } from "@opentui/react/test-utils"
import { App } from "./App"
import { mockSnapshot } from "./mock"

type Setup = Awaited<ReturnType<typeof testRender>>
let current: Setup | null = null

async function mount(width = 100, height = 40, snapshot = mockSnapshot): Promise<Setup> {
  const setup = await testRender(<App snapshot={snapshot} live={false} />, { width, height })
  await setup.renderOnce()
  current = setup
  return setup
}

// a calm fleet: everyone working, servers healthy → the queue is clear, so the
// compact view opens on Active sessions with the rest as distilled summaries
const calmSnapshot = {
  ...mockSnapshot,
  agents: mockSnapshot.agents.filter((a) => a.status === "working" && a.contextPct < 90),
  servers: mockSnapshot.servers.filter((s) => !s.stale && s.memKB < 4 * 1024 * 1024),
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
    expect(f).not.toContain("Code/webapp") // no cwd; that lives in Active sessions
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
    expect(f).toContain("Code/webapp/.claude/worktrees/fix-auth") // suffix — ~ collapse depends on $HOME
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

describe("compact form-factor — the radar scope", () => {
  test("signal lines, not prose, under a band tab bar", async () => {
    const s = await mount(44, 26)
    const f = s.captureCharFrame()
    expect(f).not.toContain("$7.3/h") // burn dropped from the beacon
    expect(f).toContain("asks") // type word — what the ask needs from you
    expect(f).toContain("review") // the ready item's type word
    expect(f).toContain("switch") // the Tab band-switch hint (key reads "tab")
    for (const t of ["Needs", "Sessions", "Servers", "Projects"]) expect(f).toContain(t) // every band is a tab
    expect(f).not.toContain("⠋") // no working-session blips in the Needs band
  })

  test("Tab switches to the Sessions roster — branch + activity, not Needs framing", async () => {
    const s = await mount(64, 34) // tall + wide enough for the two-line context to fit
    await press(s, "TAB")
    const f = s.captureCharFrame()
    expect(f).toContain("⠋") // a working session's live braille blip
    expect(f).toContain("feat/rate-limit") // the roster leads with where the session lives
    expect(f).toContain("run bun test") // and what it's doing — both on the card
    expect(f).not.toContain("review") // the Needs-style type-word is gone from the roster
    expect(f).not.toContain("holding") // the Needs-only server-mem item is absent
  })

  test("⏎ discloses an item's detail in place (fold)", async () => {
    const s = await mount(44, 30)
    await press(s, "TAB", "RETURN") // Sessions band, disclose the first session
    const f = s.captureCharFrame()
    expect(f).toContain("tok") // the disclosed vitals line (model · tokens · cost)
  })

  test("← / → (h/l) expand and collapse a signal's detail, same as the full view", async () => {
    const s = await mount(44, 30)
    await press(s, "TAB", "l") // Sessions band, open the first session's detail
    expect(s.captureCharFrame()).toContain("tok")
    await press(s, "h") // and fold it back
    expect(s.captureCharFrame()).not.toContain("tok")
  })

  test("opens on the Sessions lens when the queue is clear", async () => {
    const s = await mount(44, 24, calmSnapshot)
    const f = s.captureCharFrame()
    expect(f).toContain("zadar")
    expect(f).not.toContain("▲") // calm fleet — no escalation counts on the beacon
    expect(f).toContain("edit components") // a working session's activity fills the lens
  })

  test("a tall window gives Needs items a full second context line", async () => {
    const s = await mount(64, 34)
    // the question wraps onto its own line instead of being clipped onto the signal
    expect(s.captureCharFrame()).toContain("merge the new keys into it")
  })

  test("a short window collapses back to single signal lines", async () => {
    const s = await mount(64, 18)
    // no room for two-line blocks — context clips back onto one line
    expect(s.captureCharFrame()).not.toContain("merge the new keys into it")
  })

  test("i reveals the dormant session in the roster, and hides it again", async () => {
    const s = await mount(44, 30)
    await press(s, "TAB") // Sessions band
    expect(s.captureCharFrame()).not.toContain("playground") // idle 52m — hidden past STALE_SEC
    await press(s, "i")
    expect(s.captureCharFrame()).toContain("playground") // brought back on demand
    await press(s, "i")
    expect(s.captureCharFrame()).not.toContain("playground") // toggles off again
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
    expect(f).not.toContain("") // mark stays off unless its font is known-installed
  })

  test("wears the zadar mark when the font is available", async () => {
    const setup = await testRender(<App snapshot={mockSnapshot} live={false} mark />, { width: 100, height: 40 })
    await setup.renderOnce()
    current = setup
    expect(setup.captureCharFrame()).toContain(" zadar")
  })
})
