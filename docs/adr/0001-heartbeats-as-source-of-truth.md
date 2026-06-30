# Raw heartbeats are the source of truth; everything is derived on read

## Context

The tracker observes the active app/window/URL on macOS. Every "smart" feature
Rize offers (focus sessions, distraction detection, breaks, categorization,
projects) is a re-slicing of that same underlying observation stream by rules we
expect to tweak constantly. The collection tool itself (`active-win`-style
polling) only ever yields point-in-time snapshots, so sample-based collection is
forced regardless.

## Decision

Persist only **raw, append-only heartbeats** — each a point-in-time observation
of `{app, window title, url, timestamp}` plus permission-free signals (idle).
Heartbeats carry **no derived fields** (no category, no interval, no session).
Intervals, focus/break sessions, distraction flags, and categorization are all
**computed at read/rollup time** from the heartbeat stream.

Categorization specifically is two layers: an ordered **Rule** set applied at
read time (so editing a rule re-derives all history), plus a stored **Override**
layer that is sticky and wins over rules.

## Considered options

- **Write-time intervals + `category_id` stamped on each event** (the shape in the
  original research doc). Rejected: freezes history against the rules in force at
  write time, so every rule edit requires a migration to fix the past — and we
  will be editing rules and focus parameters heavily early on.

## Consequences

- Editing a rule or changing the focus window/threshold recomputes history for
  free; no backfill migrations.
- Reads cost more compute, mitigated by a daily rollup layer.
- Overrides are the *only* categorization that is persisted, not derived.
- More rows on disk than a pre-merged interval store (acceptable; cheap).
- Raw heartbeats are kept **indefinitely** — pruning them would undo the
  recompute-all-history benefit above. The daily rollup is a *cache* for fast
  dashboards, never a replacement for raw. A manual "prune older than X" control
  is deferred to a later version (opt-in, never automatic).
