import { describe, expect, test } from "bun:test"
import { attentionQueue, groupByProject, pruneAcks, suppressAcked, turnSig } from "./fleetmap"
import { mockSnapshot } from "./mock"

describe("groupByProject", () => {
  const groups = groupByProject(mockSnapshot)

  test("alphabetical and stable — urgency never reorders the map", () => {
    expect(groups.map((g) => g.key)).toEqual([...groups.map((g) => g.key)].sort())
  })

  test("worktree agents and servers land in their parent repo", () => {
    const webapp = groups.find((g) => g.key === "webapp")!
    expect(webapp.agents.map((a) => a.wt)).toContain("fix-auth")
    expect(webapp.servers.map((s) => s.port)).toContain(3000)
    expect(webapp.worktrees?.total).toBe(2)
  })

  test("a server inside a worktree cwd groups under the repo", () => {
    const api = groups.find((g) => g.key === "api-gateway")!
    expect(api.servers.map((s) => s.port)).toContain(8787) // cwd is .../api-gateway/.claude/worktrees/gone
  })

  test("project rolls up cost and worst status", () => {
    const webapp = groups.find((g) => g.key === "webapp")!
    expect(webapp.worst).toBe("waiting")
    expect(webapp.cost).toBeCloseTo(3.9, 5)
  })
})

describe("attentionQueue", () => {
  const q = attentionQueue(mockSnapshot)

  test("ranked: question > approval > error > server-mem > ready > stale", () => {
    expect(q.map((i) => i.kind)).toEqual(["question", "approval", "error", "server-mem", "ready", "server-stale"])
  })

  test("titles are action sentences with the literal content", () => {
    expect(q[0].title).toContain("Should I overwrite the existing config")
    expect(q[3].title).toBe(":3000 holding 14GB of memory")
    expect(q[4].title).toBe("review +214 −38 across 9 files")
  })

  test("queue items carry their target for direct actions", () => {
    expect(q[0].agent?.pid).toBe(74867)
    expect(q[3].server?.port).toBe(3000)
  })

  test("worktree agents are labelled repo/wt", () => {
    expect(q[1].project).toBe("omnipair/agent-3")
  })

  test("a calm fleet yields an empty queue", () => {
    expect(attentionQueue({ time: "", agents: [], servers: [], worktrees: [] })).toEqual([])
  })
})

describe("seen-acknowledgment for reviews", () => {
  const q = attentionQueue(mockSnapshot)
  const reviewed = q.find((it) => it.kind === "ready")!.agent!
  const now = 1_700_000_000_000
  // ack the review against the turn it finished on
  const seen = new Map([[reviewed.id, turnSig(reviewed, now)]])

  test("suppressAcked drops only the reviewed item; the rest stand", () => {
    const after = suppressAcked(q, seen, now)
    expect(after.some((it) => it.kind === "ready" && it.agent?.id === reviewed.id)).toBe(false)
    expect(after.length).toBe(q.length - 1)
    expect(suppressAcked(q, new Map(), now)).toEqual(q) // no acks → untouched
  })

  test("the ack holds for the same turn, releases on a new turn or a reply", () => {
    // same turn (idleSec unchanged) → still seen
    expect(pruneAcks(seen, mockSnapshot.agents, now).has(reviewed.id)).toBe(true)

    // a NEW finished turn resets idleSec → the signature moves → released + resurfaces,
    // even though the session never left `ready`
    const advanced = mockSnapshot.agents.map((a) => (a.id === reviewed.id ? { ...a, idleSec: 0 } : a))
    expect(pruneAcks(seen, advanced, now).has(reviewed.id)).toBe(false)
    const requeued = suppressAcked(attentionQueue({ ...mockSnapshot, agents: advanced }), seen, now)
    expect(requeued.some((it) => it.kind === "ready" && it.agent?.id === reviewed.id)).toBe(true)

    // a reply moves it off `ready`, or the session disappears → released
    const replied = mockSnapshot.agents.map((a) => (a.id === reviewed.id ? { ...a, status: "working" as const } : a))
    expect(pruneAcks(seen, replied, now).has(reviewed.id)).toBe(false)
    expect(pruneAcks(seen, [], now).size).toBe(0)
  })
})
