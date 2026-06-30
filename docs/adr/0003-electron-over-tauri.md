# Electron for v1, not Tauri (deliberate reversal of the research doc)

## Context

The research doc recommends Tauri 2.x, primarily for its lighter idle
memory/battery footprint on an always-on tracker running on an Intel MacBook.
That footprint argument is real. Against it: the developer is a React/TypeScript
senior frontend engineer with **prior Electron activity-monitor experience** and
no Rust background, and this is a **personal project where the main risk is not
finishing it.** The hard native pieces (window titles, idle, NSWorkspace events,
AppleScript, SQLite) are mature in Electron's ecosystem
(`@rize-io/active-win` / `get-windows`, `node-mac-permissions`, `better-sqlite3`)
and comparatively DIY in Tauri's Rust ecosystem.

## Decision

Build v1 on **Electron**. Optimize for shipping velocity and the developer's
existing strengths over runtime footprint.

## Considered options

- **Tauri 2.x (doc's recommendation):** rejected for v1 — the Rust learning
  curve is friction this personal project can't afford, and footprint is
  tolerable for a single-user tool. Remains a candidate for a future v2 rewrite
  if idle footprint on Intel becomes genuinely annoying.

## Consequences

- Heavier idle memory/bundle than Tauri (acceptable for personal use; revisit if
  it bothers the user on Intel).
- Native data collection uses Node native modules directly, **no Swift sidecar
  in v1**: `@rize-io/active-win` polled ~3s for app/title/url, Electron
  `powerMonitor` for idle seconds + sleep/wake/lock events, `node-mac-permissions`
  for TCC. A sidecar stays a back-pocket v1.x option only if 3s polling proves
  too coarse or an unexposed API is needed.
- SQLite via `better-sqlite3` (synchronous, good for batched heartbeat writes).
- Mature signing/permission tooling available immediately.
