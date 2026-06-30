# Deferred Scope

Decisions made during design to keep features OUT of v1, with where they land.
Not a backlog — just the explicit "not now" list so intent isn't lost.

## v2 (explicitly planned)

- **AI-written insights** — narrative coaching/summaries over the tracked data.
  Requested for v2. (Until then, all metrics are deterministic and transparent.)
- **Manual "prune data older than X"** control — opt-in storage reclaim / forget.
  Raw heartbeats are kept indefinitely in v1.

## Deferred (revisit when needed, no committed version)

- **Browser extension hardening** — extension is the primary URL source in v1;
  cross-browser polish/store distribution can mature later. (AppleScript fallback
  already covers AppleScript-capable browsers; Zen degrades to app-level.)
- **Per-focus-session Focus Quality Score** — v1 scores per-day only.
- **Task level** below Project — v1 is Project + client attribute only.
- **Category caps** (e.g. max 30 min social/day) — overlaps the distraction Nudge.
- **Weekly / streak goals** — v1 goals are daily (Focus target + Overwork ceiling).
- **Pomodoro** — dropped; conflicts with the 120-min ultradian Break Reminder.
- **Merge / split** of timeline spans — Overrides + rollups cover most needs.
- **Dedicated per-project report screen** — Trends view can group by project.
- **Swift sidecar** for native reads — only if 3s Node polling proves too coarse.
- **Tauri rewrite** — only if Electron's idle footprint becomes annoying on Intel.

## Out of scope (per research doc, not now)

- Calendar integration (Google Calendar meeting detection).
- Distraction blocking / "urge surfing" delay (v1 Nudge is notify-only).
- iOS app (keep schema portable; do not build).
