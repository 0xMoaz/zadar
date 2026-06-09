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
export async function pruneWorktree(repo: string, path: string): Promise<void> {
  await $`git -C ${repo} worktree remove ${path}`.nothrow().quiet()
}
