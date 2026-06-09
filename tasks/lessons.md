# Lessons — zefleet

## Claude Code project-dir encoding (caused "zee.gg shows idle/$0")
The transcript folder under `~/.claude/projects/` encodes the cwd by replacing
**every non-alphanumeric char** with `-`, not just `/`. So `/Users/zee/Code/zee.gg`
→ `-Users-zee-Code-zee-gg` (the `.` → `-`), and `…/x/.claude/worktrees/y` →
`…-x--claude-worktrees-y` (`/.` → `--`). Use `cwd.replace(/[^a-zA-Z0-9]/g, "-")`.
Any project with `.`, `_`, or other special chars in its path silently failed to
find its session → defaulted to idle / 0% / $0.

## Agent "working" status must be recency-first, not stop_reason-first
Marking `end_turn` as idle is wrong when the file was just written (mid next turn,
or tool loop). Robust order: AskUserQuestion→waiting; recent mtime (≤~45-60s)→working;
last event is `tool_use` with no result→working (long tool, no writes while running);
else idle. mtime age is the most reliable "actively generating" signal.

## Don't hide recently-finished sessions as "stale"
User runs many parallel sessions; an agent that finished a turn 3 min ago is NOT
stale — it's awaiting their next message. Filter "stale" by TIME (idle > ~20 min),
not by "not currently generating." Hiding between-turns agents reads as "fleet
doesn't show my agents."

## `fleet` on PATH is the OLD bash script
`~/.local/bin/fleet` is the bash dashboard (SYSTEM/TOP MEMORY, one-shot, exits).
The OpenTUI app is `bun ~/Code/zefleet/src/index.tsx`. Repointing `fleet` needs the
user's explicit OK (blocked by auto-mode classifier otherwise).

## Colors: OpenTUI composites in RGB, can't pass ANSI through
To match the terminal (Ghostty) theme, detect the palette at startup via
`renderer.getPalette()` and build RGBA from the returned hex. `RGBA.fromIndex(n)`
alone resolves to STANDARD xterm RGB (teal/olive), not the user's palette.

## OpenTUI flexbox: scrolling list needs minHeight:0 + flexBasis:0
A `<scrollbox flexGrow={1}>` defaults to content-size minHeight → it overruns and
overlaps siblings (garbled footer). Add `minHeight={0} flexBasis={0}`, and group the
fixed bottom section in its own `flexShrink={0}` box so the middle can't push it off.

## OpenTUI mock input wants KeyCodes names, not key names
`mockInput.pressKey("return")` types the literal letters r-e-t-u-r-n. Special
keys use the KeyCodes constants: `pressKey("RETURN")`, `pressKey("ESCAPE")`.
Also: a bare ESC byte is buffered by the headless parser (escape-sequence
disambiguation) — toggle overlays closed with their own key in tests.

## Shifted letters arrive as lowercase + shift flag
`useKeyboard` delivers shift+G as `{name: "g", shift: true}` — matching
`key.name === "G"` silently never fires. v1's jump-to-last was dead code
for this reason; headless interaction tests caught it.
