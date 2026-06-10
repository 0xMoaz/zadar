import { describe, expect, test } from "bun:test"
import { inferStatus, lastSaidOf, lastToolOf, taskOf, ACTIVE_SEC, APPROVAL_SEC, READY_SEC } from "./status"

const asst = (content: any[], stop: string | null = null) => ({
  type: "assistant",
  message: { stop_reason: stop, content },
})
const toolUse = (id: string, name: string, input: any = {}) => ({ type: "tool_use", id, name, input })
const toolResult = (id: string, isError = false) => ({
  type: "user",
  message: { content: [{ type: "tool_result", tool_use_id: id, is_error: isError }] },
})
const userText = (text: string) => ({ type: "user", message: { content: [{ type: "text", text }] } })

describe("waiting on a question", () => {
  const ask = asst([
    toolUse("t1", "AskUserQuestion", {
      questions: [{ question: "Overwrite config?", options: [{ label: "Overwrite" }, { label: "Merge" }] }],
    }),
  ])

  test("unanswered AskUserQuestion → waiting, with the literal question and options", () => {
    const r = inferStatus([ask], 5)
    expect(r.status).toBe("waiting")
    expect(r.waitKind).toBe("question")
    expect(r.question).toBe("Overwrite config?")
    expect(r.options).toEqual(["Overwrite", "Merge"])
  })

  test("waiting persists no matter how long it sits", () => {
    expect(inferStatus([ask], 3600).status).toBe("waiting")
  })

  test("an answered question is no longer waiting", () => {
    const r = inferStatus([ask, toolResult("t1")], 5)
    expect(r.status).toBe("working")
  })
})

describe("pending tool calls", () => {
  const pendingBash = asst([toolUse("t2", "Bash", { command: "bun test" })], "tool_use")

  test("young pending tool → working (long tool legitimately running)", () => {
    expect(inferStatus([pendingBash], APPROVAL_SEC - 10).status).toBe("working")
  })

  test("old pending tool → waiting(approval) with the tool label", () => {
    const r = inferStatus([pendingBash], APPROVAL_SEC + 10)
    expect(r.status).toBe("waiting")
    expect(r.waitKind).toBe("approval")
    expect(r.question).toBe("run bun test")
  })

  test("a resolved tool call is not pending", () => {
    const r = inferStatus([pendingBash, toolResult("t2")], APPROVAL_SEC + 10)
    expect(r.status).not.toBe("waiting")
  })
})

describe("ready / idle lifecycle", () => {
  const done = asst([{ type: "text", text: "All set." }], "end_turn")

  test("finished turn → ready immediately", () => {
    expect(inferStatus([done], 2).status).toBe("ready")
  })

  test("finished turn stays ready inside the review window", () => {
    expect(inferStatus([done], READY_SEC - 60).status).toBe("ready")
  })

  test("finished turn fades to idle past the window", () => {
    expect(inferStatus([done], READY_SEC + 60).status).toBe("idle")
  })

  test("a new user prompt after end_turn → working again", () => {
    expect(inferStatus([done, userText("next task please")], 5).status).toBe("working")
  })

  test("bookkeeping events after end_turn don't break ready", () => {
    const r = inferStatus([done, { type: "file-history-snapshot" }, { type: "summary" }], 60)
    expect(r.status).toBe("ready")
  })
})

describe("error detection", () => {
  const failed = [asst([toolUse("t3", "Bash", { command: "bun build" })]), toolResult("t3", true)]

  test("turn that died on a failed tool → error once quiet", () => {
    expect(inferStatus(failed, ACTIVE_SEC + 30).status).toBe("error")
  })

  test("a fresh failed tool result is still working (agent about to react)", () => {
    expect(inferStatus(failed, 5).status).toBe("working")
  })
})

describe("taskOf — the user's last typed prompt", () => {
  const typed = (text: string, extra: any = {}) => ({ type: "user", message: { content: text }, ...extra })

  test("finds the last typed prompt, skipping tool results", () => {
    const tail = [typed("fix the auth redirect loop"), toolResult("t1"), asst([{ type: "text", text: "done" }])]
    expect(taskOf(tail)).toBe("fix the auth redirect loop")
  })

  test("skips harness injections, interrupts, sidechains, and meta", () => {
    const tail = [
      typed("the real task"),
      typed("<system-reminder>noise</system-reminder>"),
      typed("[Request interrupted by user]"),
      typed("subagent chatter", { isSidechain: true }),
      typed("meta", { isMeta: true }),
    ]
    expect(taskOf(tail)).toBe("the real task")
  })

  test("squishes whitespace and clips long prompts", () => {
    const t = taskOf([typed("fix\n  the   thing " + "x".repeat(200))], 40)!
    expect(t.length).toBe(40)
    expect(t.endsWith("…")).toBe(true)
    expect(t).toContain("fix the thing")
  })

  test("no typed prompt in the tail → undefined", () => {
    expect(taskOf([toolResult("t1")])).toBeUndefined()
  })

  test("prompts with attachments (image+text arrays) still count", () => {
    const withImage = {
      type: "user",
      message: { content: [{ type: "image", source: {} }, { type: "text", text: "is that how it should look?" }] },
    }
    expect(taskOf([withImage])).toBe("is that how it should look?")
  })
})

describe("lastSaidOf — the agent's last words", () => {
  test("finds the most recent assistant text block", () => {
    const tail = [
      asst([{ type: "text", text: "first thought" }]),
      asst([{ type: "tool_use", id: "t1", name: "Bash", input: {} }]),
      asst([{ type: "text", text: "All green — shipping it." }], "end_turn"),
    ]
    expect(lastSaidOf(tail)).toBe("All green — shipping it.")
  })

  test("agents speak markdown; the card speaks prose", () => {
    const tail = [
      asst([{ type: "text", text: "Shipped ([`1bb8909`](https://github.com/x/y/commit/1bb8909)) — **100 tests** green." }]),
    ]
    expect(lastSaidOf(tail)).toBe("Shipped (1bb8909) — 100 tests green.")
  })

  test("tool-only turns → undefined", () => {
    expect(lastSaidOf([asst([{ type: "tool_use", id: "t1", name: "Read", input: {} }])])).toBeUndefined()
  })
})

describe("lastToolOf — the agent's last action", () => {
  test("finds the most recent tool call across events", () => {
    const tail = [
      asst([{ type: "tool_use", id: "t1", name: "Bash", input: { command: "bun test" } }]),
      asst([{ type: "text", text: "done" }], "end_turn"),
    ]
    expect(lastToolOf(tail)).toBe("run bun test")
  })

  test("no tools yet → undefined", () => {
    expect(lastToolOf([asst([{ type: "text", text: "thinking" }])])).toBeUndefined()
  })
})

describe("recency fallback", () => {
  test("streaming text mid-turn → working", () => {
    expect(inferStatus([asst([{ type: "text", text: "thinking…" }], null)], 10).status).toBe("working")
  })

  test("quiet with no end_turn → idle (interrupted / stalled)", () => {
    expect(inferStatus([asst([{ type: "text", text: "…" }], null)], ACTIVE_SEC + 30).status).toBe("idle")
  })

  test("empty tail follows recency", () => {
    expect(inferStatus([], 10).status).toBe("working")
    expect(inferStatus([], ACTIVE_SEC + 30).status).toBe("idle")
  })
})
