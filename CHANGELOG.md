# Changelog

## 0.4.0

### Added
- **HUD mode** — a compact radar view for narrow, always-on windows. One band fills the pane (`Needs · Sessions · Servers · Projects`), `Tab` switches, each item is a single signal line, `←`/`→` unfolds its detail.
- **Auto-update on launch** — new releases download in the background and apply the next time you open zadar; your running session is never interrupted. Opt out with `ZADAR_NO_AUTO_UPDATE=1`.
- Press `i` to reveal idle sessions.

### Fixed
- **"Review" no longer lingers** — a session clears from *Needs you* as soon as you open it, instead of hanging around for 20 minutes (review window also shortened to 5 min).
- **Permission prompts surface instantly** — an agent asking for access/approval shows up and notifies right away, not after a 2-minute delay.
- **No false "waiting for approval"** — a long build, test run, dev server, or subagent now reads as *working*, not as if it's blocked on you.

### Changed
- Refreshed the monochrome zadar mark.
- Sessions show their branch + current activity, distinct from the *Needs you* framing.

### Upgrading from 0.3.0
Auto-update ships *in* this release, so 0.3.0 won't pull it automatically. Update once by hand — `zadar upgrade` (binary) or `bun add -g zadar@latest` — and every release after this one updates itself.
