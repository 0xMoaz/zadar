import { $ } from "bun"

/** Copy text to the macOS clipboard via pbcopy. */
export async function copyText(text: string): Promise<void> {
  try {
    const p = Bun.spawn(["pbcopy"], { stdin: "pipe" })
    p.stdin.write(text)
    await p.stdin.end()
    await p.exited
  } catch {
    /* clipboard unavailable — non-fatal */
  }
}

export const resumeCommand = (id: string) => `claude --resume ${id}`

export async function copyResume(id: string): Promise<void> {
  await copyText(resumeCommand(id))
}

/**
 * Kill a process and report whether it actually died — the toast must not lie.
 * Works in the user's real terminal (the Bash-tool sandbox drops signals).
 */
export async function killProcess(pid: number): Promise<boolean> {
  await $`kill ${pid}`.nothrow().quiet()
  await Bun.sleep(200)
  const probe = await $`kill -0 ${pid}`.nothrow().quiet()
  return probe.exitCode !== 0
}

/** Prune a git worktree (guarded — caller confirms; never on a dirty tree). */
export async function pruneWorktree(repo: string, path: string): Promise<boolean> {
  const r = await $`git -C ${repo} worktree remove ${path}`.nothrow().quiet()
  return r.exitCode === 0
}

/**
 * Desktop notification + sound via osascript — it bypasses the TTY entirely,
 * so the renderer's frame is never corrupted by escape sequences.
 */
export async function notify(title: string, body: string): Promise<void> {
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
  await $`osascript -e ${`display notification "${esc(body)}" with title "${esc(title)}" sound name "Glass"`}`
    .nothrow()
    .quiet()
}

export async function openServer(port: number): Promise<void> {
  await $`open ${"http://localhost:" + port}`.nothrow().quiet()
}

/**
 * Jump toward the session: try the claude:// deep link (scheme is registered
 * by the desktop app), then bring the app forward regardless.
 */
export async function focusClaude(sessionId?: string): Promise<void> {
  if (sessionId && /^[0-9a-f-]{8,}$/i.test(sessionId)) {
    await $`open ${"claude://resume/" + sessionId}`.nothrow().quiet()
  }
  await $`open -a Claude`.nothrow().quiet()
}

/**
 * The .app bundle that owns a pid — found by walking its ancestry. A CLI
 * session's chain ends at its terminal (Ghostty, iTerm, Terminal, VS Code…);
 * a desktop session's at Claude.app.
 */
async function hostAppOf(pid: number): Promise<{ path: string; name: string } | undefined> {
  let p = pid
  for (let i = 0; i < 25 && p > 1; i++) {
    const out = await $`ps -o ppid=,comm= -p ${p}`.nothrow().quiet().text()
    const m = out.trim().match(/^(\d+)\s+(.+)$/)
    if (!m) return undefined
    p = Number(m[1])
    // only real installed apps — the CLI's own binary hides inside an inner
    // claude.app bundle under Application Support, which is not a destination
    const bundle = m[2].match(/^((?:\/System)?\/Applications\/.*?\.app)\//)
    if (bundle) {
      const path = bundle[1]
      const name = path.split("/").pop()!.replace(/\.app$/, "")
      return { path, name }
    }
  }
  return undefined
}

/**
 * Go to a session wherever it lives: Claude desktop sessions deep-link into
 * the app; CLI sessions (claude or codex) bring their terminal forward.
 * Returns the destination's name for the toast, or undefined if unlocatable.
 */
export async function focusSession(agent: {
  pid: number
  kind: "claude" | "codex"
  id: string
}): Promise<string | undefined> {
  const host = await hostAppOf(agent.pid)
  if (host?.name === "Claude") {
    await focusClaude(agent.kind === "claude" ? agent.id : undefined)
    return "Claude"
  }
  if (host) {
    await $`open ${host.path}`.nothrow().quiet()
    return host.name
  }
  if (agent.kind === "claude") {
    await focusClaude(agent.id)
    return "Claude"
  }
  return undefined
}
