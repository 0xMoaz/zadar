# zadar — features

zadar answers one question — *who needs you right now?* — and keeps every
other signal ambient until it matters. This is the full tour.

## The queue — "Needs you"

The top of the screen is a ranked queue of everything actually blocked on you:

- **Questions** — an agent hit a fork and asked. The literal question floats to
  the top with its answer options rendered as `① ②` chips.
- **Pending tools** — an agent has been waiting on a tool approval for more
  than two minutes.
- **Errors** — a turn ended on a failed tool call; unfolding shows the exact
  failing action.
- **Reviews** — a session finished and parked its diff (`+214 −38 across
  9 files`), waiting for your read.
- **Sick servers** — a dev server eating too much memory, or one whose
  worktree is gone and is safe to kill.

When nothing needs you, the queue says so and gets out of the way.

## Sessions

Every live Claude Code and Codex session, status-sorted:

- **Truthful states** — `▲` waiting on you · `✕` error · `◆` ready for review ·
  `●` working · `○` idle. The working spinner only spins while the transcript
  is actually advancing — a stalled session freezes. Motion never lies.
- **Context meter** — how much of the model's window is used, with
  auto-compaction shown as a ghost mark (`⟳`) when occupancy suddenly drops.
- **Cost** — per-session spend, fleet burn rate (`$/h`) in the header, and
  Codex plan-quota burn (`plan 45%`) read straight from the session file.
- **The story** — unfold any session to see its task, what it last did, what
  it last said, and what it built (diff), plus model · tokens · uptime · pid.
- **Activity rhythm** — a small EKG sparkline of transcript cadence: dense
  means cranking, flat means stalled.

Data comes from the agents' own transcript files (`~/.claude/projects`,
`~/.codex/sessions`) — no wrappers, no instrumentation, nothing to configure
in your agents.

## Servers & projects

- **Dev servers** — every bound port with its project, memory, and uptime;
  stale servers (worktree deleted) are flagged and one keypress from gone.
- **Projects** — each repo as one entity: its agents by state, server ports,
  worktrees, dirty counts, and cost. Worktree pruning is guarded — dirty
  trees refuse, clean ones confirm first.

## Acting without leaving

- `⏎` / click — jump to the session's app, or open a server in the browser
- `␣` — inspect a queue item's decision context
- `c` — copy a resume command or server URL
- `x` — kill an agent or server (with confirm)
- `p` — prune a clean worktree
- `t` — activity log of today's status flips
- `n` — desktop notifications when an agent starts needing you
- `?` — full keymap · `q` — quit

## Ambient by design

- One calm view, urgency first; everything else folds away.
- The header wordmark tints to the worst state in the fleet and counts every
  state — readable from across the room.
- Idle sessions fade with age; nothing flashes for attention it hasn't earned.
- Polls at 1–2 Hz with mtime-cached parsing — effectively zero footprint.

## Fits your window

zadar reflows to whatever pane you give it — automatically, no flags.

- **Roomy (≥ 75 cols)** — the full view: every section at once, each session's
  vitals on the right, the state legend, and fleet burn in the header.
- **Sticky / narrow (< 75 cols)** — a *radar scope* built for an always-on
  peripheral pane (pin it across your workspaces). One **band** fills the pane;
  the rest are tabs along the bottom — `Needs · Sessions · Servers · Projects`,
  switched with `Tab`. Every item is one **signal line**: a colour-coded blip
  for its state (pulsing while live), what it needs from you, and a clip of
  context — press `←`/`→` (or `h`/`l`) to unfold its full detail in place, and
  `o` (or `⏎`) to jump to the live session or server. The header keeps the
  beacon + counts; the noise drops away.
- **Tall windows breathe** — Needs and Sessions give each item a second line
  with the full question or what it's working on right now; short windows
  tighten back to one line each and scroll.

## Local data API

`zadar --api [port]` serves the same truth as JSON on `127.0.0.1:7433`:

- `GET /snapshot` — the full fleet state
- `GET /events` — today's status transitions

Build whatever surface you like on top; zadar stays a terminal.

## Self-maintaining

- `zadar upgrade` updates in place, using whichever way you installed.
- A faint `↑version` appears in the header when you're behind (checked
  ambiently once a day, never blocking).
- State lives in `~/.zadar`. The header logo is a one-glyph font installed
  to `~/Library/Fonts/ZadarMark.ttf` on first run; terminals opened after
  that render it, and without it the header is plain text.
