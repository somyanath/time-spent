# Building a Desktop-Only macOS Time Tracker (a Rize.io Alternative): Research Document

**Prepared for:** Somyanath (Senior Frontend Engineer — React/TypeScript/Next.js, prior Electron activity-monitor experience)
**Target machine:** Intel-based MacBook (x86_64)
**Scope:** Desktop-only macOS v1; iOS explicitly out of scope but not architecturally foreclosed
**Date:** June 27, 2026
**Purpose:** Foundational research artifact to hand to Claude Code (which will produce architecture docs, context docs, a PRD, and issues). This is RESEARCH ONLY — not a PRD.

---

## TL;DR

- **Build it with Tauri 2.x (Rust core + React/TypeScript frontend), not Electron or pure Swift.** You keep your React strengths for the dashboard, get roughly an order-of-magnitude smaller bundles and far lower idle memory than Electron (decisive for an always-on background tracker), and you access the gated macOS APIs through a thin Rust/Swift sidecar. Electron is the safe fallback if Rust friction stalls you; pure Swift/SwiftUI is the "right" native answer but throws away your entire skill set.
- **The single riskiest technical fact: on current macOS, reading another app's window *title* requires the Screen Recording permission; reading the browser *URL* requires Accessibility/Automation. The frontmost app *name* requires neither.** Design the permission UX around this split, and note that macOS Sequoia (15) and later re-prompt for Screen Recording roughly monthly.
- **Use local SQLite, an event-sourced schema (raw samples → sessions → daily rollups), and keep all data on-device with zero telemetry.** Target macOS Sequoia 15 / Tahoe 26 on your Intel Mac (Tahoe 26 is the last macOS to support Intel), ad-hoc/locally sign for personal use, and structure the tracker as a separate "watcher" component from the UI so a future iOS port or sync layer stays possible.

---

## Key Findings

1. **Rize is an Electron app** — confirmed directly by co-founder/CEO Macgill Davis in an AppSumo Q&A (May 15, 2024): *"We've built our macOS app with Electron.js and have heard generally great things from users. I personally have loved using the framework and don't find it to be gimmicky or non-working."* It reads only window *metadata* — app name, window title, and URL — never screenshots or keystrokes. It even maintains its own public fork of the window-detection library, `@rize-io/active-win`.
2. **Rize's "intelligence" is mostly rules + thresholds, not magic.** Focus time uses a documented **75%-of-a-15-minute-window** rule (Rize docs: *"Focus Sessions are created automatically if you spend approximately 75% of your time on Focus category activities within any timeframe of 15-minute or longer"*); idle/break detection auto-creates a gap after **more than 5 minutes** of inactivity or sleep, with category-aware exceptions. These are entirely reproducible.
3. **The macOS permission model is the hard part, and it splits cleanly:** app name (free) → window title (Screen Recording) → browser URL (Accessibility + Automation/Apple Events). TCC prompts, the "quit and relaunch" requirement, and Sequoia's monthly re-authorization are the main UX hazards.
4. **Idle detection is easy and permission-free** via `CGEventSourceSecondsSinceLastEventType` or IOKit `HIDIdleTime`.
5. **Tauri is mature enough in 2026** for this use case, with first-party SQL (SQLite) and notification plugins, and Rust access to native macOS APIs via the `objc2` crate family. Its main cost is Rust learning curve and slower compiles.
6. **Excellent open-source references exist** — ActivityWatch (MPL-2.0), Tockler (GPL-2.0), and the `get-windows`/`active-win` libraries (MIT) — covering watcher architecture, sampling, idle detection, and SQLite schemas you can learn from directly.
7. **Intel is fine for now but is a sunset platform:** Apple confirmed at WWDC 2025 (June 9, 2025) that Tahoe 26 (released Sept 15, 2025) is the final Intel-supporting macOS; macOS 27 ("Golden Gate," announced June 8, 2026, shipping fall 2026) is Apple Silicon only.

---

## Details

### 1. How Rize.io Works (Feature Set + Likely Architecture)

**Confirmed architecture.** Rize's co-founder Macgill Davis stated publicly (AppSumo, 2024): *"We've built our macOS app with Electron.js."* Rize maintains a GitHub org (`github.com/rize-io`) whose most relevant public repo is a fork of Sindre Sorhus's window-metadata library (`get-windows`, formerly `active-win`), published on npm as **`@rize-io/active-win`**. This is essentially the same building block ActivityWatch and Tockler use. The takeaway: **Rize is a "thin native data collection + heavy web UI" app** — exactly the shape a frontend engineer can replicate.

**What Rize tracks (its data primitives):**
- The **frontmost application** (app name, bundle id).
- The **active window title**.
- The **active browser tab URL** (via browser extensions for Chrome/Firefox, plus native reads where possible).
- Timestamps; only one active window across all monitors at any instant.
- **Explicitly NOT:** screenshots, screen content, or keystrokes (privacy positioning: *"It only reads window metadata — app name, window title, and URL — to categorize your time"*).

**Feature inventory (reverse-engineered from docs/reviews):**

| Feature | How it works | v1 priority |
|---|---|---|
| Automatic time tracking | Samples frontmost app/window/URL in background, no timers | **Essential** |
| Category assignment | Rule/keyword mapping of apps+URLs → categories (Code, Messaging, etc.); AI categorization on top | **Essential** (rules); AI later |
| Project/client/task tagging | Manual + keyword rules; assign sessions to projects | **Essential** (basic) |
| Focus time | **75% of a ≥15-min window spent in Focus categories ⇒ whole window counts as focus** | **Essential** |
| Focus Quality Score | Score from 20+ attributes (context-switching freq, distractions, time in focus categories) | Nice-to-have |
| Distraction detection/blocker | Flags rapid app-switching + flagged sites; pop-up or notification; "urge surfing" delay | Nice-to-have |
| Break reminders | "Smart" breaks after N minutes of *focused* work (meetings/idle don't count); also Pomodoro 25/5/15 | Nice-to-have (Pomodoro easy) |
| Idle / AFK detection | Auto-creates a gap after **>5 min** inactivity or sleep; gaps of 5–60 min become a Break session; **category-aware** | **Essential** |
| Daily/weekly reports | Focus time, distraction frequency, top apps/sites, trends; daily email | **Essential** (in-app) |
| Manual entry/editing | Add entry via "+", edit categories/projects | **Essential** |
| Goals & sessions | Daily work-hour goal + burnout notification; session/work-block timer | Nice-to-have |
| Calendar integration | Google Calendar meeting detection | Later |
| Browser URL tracking | Chrome/Firefox extensions + native reads | Nice-to-have v1 |

**Recommended v1 essentials:** automatic app/window sampling, idle detection, rule-based categorization, projects, the 75%/15-min focus metric, manual editing, and a daily/weekly dashboard. Everything else (AI categorization, distraction blocker, focus score, calendar, browser extensions) is post-v1.

---

### 2. macOS Activity-Tracking APIs & Permissions (the technical core)

This is the riskiest area, so it's covered in depth. **The governing principle: three escalating data tiers, each with a different permission gate.**

#### 2a. Frontmost application (NO special permission)
- `NSWorkspace.shared.frontmostApplication` returns the `NSRunningApplication` receiving key events (`localizedName`, `bundleIdentifier`, `processIdentifier`).
- **Event-driven (preferred):** subscribe to `NSWorkspace.shared.notificationCenter` for `didActivateApplicationNotification` (and deactivate). This avoids polling and is how you should detect app switches. A naive `while true` poll without a runloop will both miss updates and spike CPU (a documented pitfall — Activity Monitor showing ~96% CPU when polling running-apps 3×/second).
- This tier requires **no TCC permission** — app name and bundle id are not gated.

#### 2b. Active window title (requires SCREEN RECORDING permission)
This is the most commonly misunderstood point, and it is now firmly established:

- **`CGWindowListCopyWindowInfo(.optionOnScreenOnly, kCGNullWindowID)`** returns an array of window dictionaries. The window **title** lives in `kCGWindowName`. **On macOS 10.15+ that key is gated by the Screen Recording permission** — without it, `kCGWindowName` is absent/empty while owner name, PID, and bounds still come through. An Apple DTS engineer (Quinn "The Eskimo!") confirmed on the Developer Forums: *"kCGWindowName string seems to be gated by the Screen Recording user data protection. Once I got that, I received window names just fine on 10.15."*
- This is corroborated by the `get-windows`/`@rize-io/active-win` README itself, which states that disabling the screen-recording check means *"The title property in the result will always be set to an empty string."*
- **Crucially, `CGWindowListCopyWindowInfo` does NOT trigger a permission prompt** — it silently returns degraded data. You must detect the missing permission heuristically (check whether any non-self, non-WindowServer window has a `kCGWindowName`) and then guide the user to System Settings.
- **Alternative path — Accessibility API:** reading a window's title via `AXUIElement` (`kAXTitleAttribute` / `AXMain` window) is gated by the **Accessibility** permission instead of Screen Recording. ActivityWatch's AppleScript strategy uses exactly this (`System Events` → frontmost process → `AXTitle`). Trade-off: AX/AppleScript is slower, more permission-fragile, and breaks on some apps, but it can avoid the heavier Screen Recording grant. Most production trackers (and `active-win`) use the CGWindowList + Screen Recording route for reliability.

**Sequoia/Tahoe wrinkle:** Since macOS 15 Sequoia, Screen Recording permission is no longer set-and-forget. Apple added a recurring re-authorization prompt — initially every ~30 days via an *"Allow For One Month"* dialog (*"[App Name] is requesting to bypass the system private window picker and directly access your screen and audio"*); 15.1 reduced the frequency for regularly-used apps. For an always-on tracker this means the title-reading capability can lapse and re-prompt — plan the UX for it.

#### 2c. Active browser tab URL (requires ACCESSIBILITY + AUTOMATION / Apple Events)
- Two approaches:
  1. **Apple Events / AppleScript automation:** `tell application "Safari" to return URL of current tab of front window` (and the Chrome equivalent `URL of active tab of front window`). Requires `NSAppleEventsUsageDescription` in Info.plist, the `com.apple.security.automation.apple-events` entitlement under Hardened Runtime, and a **per-target-app Automation** TCC grant (the first attempt errors with `-1743 errAEEventNotPermitted` until the user approves). Firefox has **no** AppleScript URL support.
  2. **Accessibility API:** walk the AX tree for `kAXURLAttribute`. Requires Accessibility permission.
- **Rize's own library maps these precisely:** disabling the accessibility check means *"The url property won't be retrieved."*
- **Recommendation:** treat URL capture as a v1.x enhancement. For v1, app + window title gives most of the value. (Rize itself leans on browser extensions for robust URL capture — a cleaner long-term path than fragile per-browser AppleScript.)

#### 2d. Idle / AFK detection (NO special permission)
- **`CGEventSourceSecondsSinceLastEventType(.combinedSessionState, …)`** returns seconds since the last HID event — simplest in Swift.
- **IOKit `HIDIdleTime`** (read from `IOHIDSystem` via `IORegistryEntryCreateCFProperties`, value in nanoseconds) is the lower-level equivalent; the `ioreg -c IOHIDSystem | grep HIDIdleTime` shell form is the quick prototype. Note: macOS's notion of "idle" via `HIDIdleTime` measures only time since the last HID input event (predictable), unlike the OS's fuzzier internal "idle" used for sleep/screensaver.
- Neither requires TCC permission. Match Rize's **5-minute** idle threshold (configurable), and make idle handling **category-aware** so video calls/entertainment don't get falsely paused (Rize disables idle detection by default for Entertainment, In-Person Meetings, Messaging, Learning, Sales, Shopping, and Video Conferencing).

#### 2e. Permission model summary (TCC)

| Data needed | Permission (TCC) | Prompts automatically? | Entitlement / Info.plist |
|---|---|---|---|
| Frontmost app name/bundle | None | — | — |
| Window title | **Screen Recording** ("Screen & System Audio Recording") | **No** — silent degradation; detect + guide | — (request via API/`node-mac-permissions`) |
| Browser URL (AppleScript) | **Automation/Apple Events** (per target app) + sometimes Accessibility | Yes, on first event (error until granted) | `NSAppleEventsUsageDescription`, `com.apple.security.automation.apple-events` |
| Browser URL / window title (AX route) | **Accessibility** | Prompts via `AXIsProcessTrustedWithOptions` | — |
| Idle time | None | — | — |

- **TCC = Transparency, Consent, and Control.** Grants are per-(app-bundle-identity), stored per-user. Changing Screen Recording requires **quitting and relaunching** the app (a notorious confusion point — toggling the switch in System Settings does not take effect until a full `Cmd-Q` and relaunch). Permissions can only be *reset* from the CLI (`tccutil reset ScreenCapture <bundleId>`), never granted from CLI.
- A **stable code-signing identity** matters: if the bundle's signature changes between launches (common with ad-hoc re-signs and auto-updates), macOS may treat it as a new app and re-prompt / drop grants.

#### 2f. Background / menu-bar agent + launch at login
- **Menu-bar (`LSUIElement`/agent) app**: set `LSUIElement = true` (Info.plist) or `NSApp.setActivationPolicy(.accessory)` so it runs without a Dock icon. This is the natural form factor.
- **Launch at login:** use **`SMAppService`** (ServiceManagement, macOS 13+) — `SMAppService.mainApp.register()` for the app, or `SMAppService.agent(plistName:)` / `.daemon` for a bundled helper. This replaced the old `SMLoginItemSetEnabled`/`SMJobBless`. Read live status from `SMAppService.mainApp.status` rather than caching it (the user can disable it in System Settings). Per Apple's review guidelines, make it an explicit opt-in toggle, default off.
- For v1 you do **not** need a privileged daemon (root). A login **agent** (runs as the user) is sufficient and far simpler — none of your tracking needs root.

#### 2g. Notarization, signing, Gatekeeper (for personal use)
- **Good news for a personal project:** apps you **build locally are not quarantined**, so Gatekeeper lets them run with only an **ad-hoc signature** (Xcode's "Sign to Run Locally"). On Apple Silicon all code must be at least ad-hoc signed; the linker does this automatically. You do **not** need a paid Apple Developer account, Developer ID, or notarization to run your own app on your own Mac. (Per The Eclectic Light Company: *"All modern build systems such as Xcode and its tools now apply an ad-hoc signature to the app or command tool, but their products aren't put into quarantine."*)
- **Caveat:** transferring the built app via AirDrop/download adds the quarantine attribute and triggers Gatekeeper. For personal use, run from your local build output, or strip quarantine (`xattr -d com.apple.quarantine`).
- **Stability tip:** even for local use, using a **free "Personal Team" Apple ID signing** identity gives a more stable code-signing identity than pure ad-hoc, which keeps TCC permission grants sticky across rebuilds. Apple's DTS recommends this: *"If you're not a paid member of the Apple Developer Program, you can use any Apple ID as a free … Personal Team … there are a bunch of subsystems within macOS that behave weirdly if your code doesn't have a stable code signing identity."* This materially reduces permission re-prompts during development.
- **Only if you later distribute** to others do you need Developer ID signing + notarization (`xcrun notarytool` + `xcrun stapler`) + Hardened Runtime.

#### 2h. Intel-specific considerations
- **Target macOS Sequoia 15 / Tahoe 26.** Tahoe 26 (released Sept 15, 2025) is the **last macOS version to support Intel Macs** (the only four supported Intel models are the 2019 Mac Pro, 2019 16-inch MacBook Pro, 2020 13-inch MacBook Pro with four Thunderbolt 3 ports, and 2020 27-inch iMac); macOS 27 "Golden Gate" (fall 2026) is Apple Silicon only. Sequoia 15 will receive security updates ~through autumn 2027.
- All the APIs above are identical on x86_64 vs arm64. The only Intel gotchas are in tooling: some Node native modules historically shipped Intel-only binaries (e.g., `mac-screen-capture-permissions` forced Rosetta on M-series in Kap) — not your problem on Intel, but build/architecture flags matter if you ever go universal.
- For Tauri, build for `x86_64-apple-darwin`. For Electron, ensure native modules (`better-sqlite3`, `active-win`) are rebuilt for your Electron ABI and x64.
- **Reasonable floor:** macOS 13 Ventura (for `SMAppService`); **recommended target:** macOS 14–15, tested on your Intel machine.

---

### 3. Framework Comparison (Electron vs Swift vs Tauri)

#### (a) Electron — what Rize uses
- **Pros:** Your exact comfort zone; you've shipped an Electron activity monitor before. Richest ecosystem for this *specific* problem — `@rize-io/active-win`/`get-windows` (MIT), `node-mac-permissions` (request/check Accessibility, Screen Recording, Automation, etc.), `better-sqlite3` (fast synchronous SQLite). Native access via Node N-API addons, `koffi`/FFI, or shelling to a Swift helper. Mature signing/notarization/auto-update tooling. Proven: Tockler is Electron.
- **Cons:** **Heavy for an always-on tracker** — bundles ~80–150 MB, idle memory commonly ~150–300 MB (each window ≈ a Chromium tab). For a process that runs every waking hour in the background, this is the worst fit on resource grounds, and it matters more on an older Intel laptop (fan noise, battery).
- **Native access for our APIs:** `node-mac-permissions` covers the TCC prompts; `active-win` covers app/title/URL; idle via a tiny addon or `active-win`'s data. All battle-tested.

#### (b) Native Swift / SwiftUI / AppKit
- **Pros:** Direct, first-class access to **every** API above (`NSWorkspace`, `CGWindowListCopyWindowInfo`, `AXUIElement`, `CGEventSource`, `SMAppService`) with zero FFI. Lowest memory/CPU/battery — ideal for a background agent. Best-in-class menu-bar patterns (`MenuBarExtra` in SwiftUI). SwiftData/GRDB for storage.
- **Cons:** **Throws away your entire React/TS skill set.** Steepest learning curve; the rich reporting/dashboard UI (your strength) would be rebuilt in SwiftUI/Charts. Slowest path to a working v1 for *you specifically*. Also the most likely to **close the cross-platform door** (though it keeps the iOS door wide open).
- **Verdict:** technically the "correct" native answer and the one a Mac specialist would pick, but the wrong velocity trade-off for a React-strong developer doing a personal project.

#### (c) Tauri 2.x (Rust core + web frontend) — RECOMMENDED
- **Pros:** **Keeps your React/TypeScript frontend** for the dashboard (where you're fastest and where the app's value shows). Dramatically lighter than Electron — multiple independent 2026 benchmarks put Tauri installers under ~10 MB and idle memory around **30–50 MB** vs Electron's 80–150 MB installers / 150–300 MB memory; Hoppscotch's real-world Electron→Tauri migration cut its bundle from 165 MB to 8 MB with a ~70% memory reduction. This footprint is the decisive advantage for an always-on tracker. First-party **SQL plugin** (SQLite via `sqlx`) and **notification** plugin. Native macOS access from Rust via the **`objc2` / `objc2-app-kit` / `objc2-foundation`** crates (actively maintained, memory-safe bindings) or the older `cocoa` crate. Tauri 2 also keeps a *theoretical* mobile path open (iOS/Android), aligning with your "don't foreclose iOS" goal.
- **Cons:** **Rust learning curve** for the native/tracker layer (you'll write the window/idle/permission code in Rust or call a Swift sidecar). Slower compile times. Smaller ecosystem than Electron for these exact niche APIs — you may port logic from `active-win`'s Swift source yourself, or use the `active-win-pos-rs` crate (note: it returns an **empty title without Screen Recording permission**, same gate as everywhere). Uses the system WebView (WKWebView) so you must test rendering there rather than bundled Chromium.
- **How to access the gated APIs in Tauri:** Two clean options — (1) write a small **Swift sidecar binary** that does the `NSWorkspace`/`CGWindowList`/idle reads and emits JSON, invoked from Rust (mirrors ActivityWatch's "swift strategy," which is its *preferred* macOS strategy); or (2) call the APIs directly from Rust via `objc2-app-kit` + `core-graphics`. Option 1 is the pragmatic starting point and isolates the trickiest native code in a language with first-class Apple-API support.

#### Recommendation & reasoning
**Choose Tauri 2.x.** For a JS/React-strong developer building a *personal, always-on* tracker, it's the best balance:
- **Developer velocity:** you build the entire dashboard/reporting UI in React/TS — your strongest area and the bulk of the app's surface.
- **Performance:** an always-running background process *must* be light; Tauri's memory/bundle/battery profile is the right call on an Intel laptop, and is where Electron is genuinely a poor fit.
- **System-access ease:** the gated APIs are the same difficulty in any framework (the OS gates them, not the framework). Tauri lets you quarantine that native complexity in a small Rust module or Swift sidecar while keeping the 80% that's UI in your wheelhouse.

**Fallback trigger:** if Rust + native FFI friction blocks you for more than ~1–2 weeks and threatens the project, **drop to Electron** — you already know it, and `node-mac-permissions` + `@rize-io/active-win` + `better-sqlite3` give you a working tracker fast, at the cost of resource footprint. The realistic trade-off on the Screen-Recording-gated title data is *identical* across all three frameworks: you must request Screen Recording, detect silent degradation, and handle Sequoia's monthly re-prompt regardless of stack.

---

### 4. Data Architecture (Local-First, Desktop-Only)

#### Database choice
- **SQLite is the obvious and correct choice** — embedded, zero-config, fast, perfect for high-frequency local event logging, and used by Tockler (local SQLite, now with Drizzle) and ActivityWatch (via peewee).
- **Per framework:**
  - **Tauri:** `tauri-plugin-sql` (SQLite via `sqlx`, with migrations) for frontend-driven access; or **`rusqlite`** for synchronous backend-side access (the SQL plugin historically *cannot be called from the Rust backend* — a known limitation — so `rusqlite` is better if the *tracker* writes directly). Recommendation: **`rusqlite` in the Rust tracker for writes**, SQL plugin or Tauri commands for the React UI's reads.
  - **Electron:** `better-sqlite3` (synchronous, fast, ideal for batch inserts).
  - **Swift:** GRDB (recommended) or SwiftData/Core Data.

#### Schema (event-sourced: raw → sessions → rollups)

```sql
-- Raw activity samples (high frequency, append-only)
CREATE TABLE activity_event (
  id            INTEGER PRIMARY KEY,
  start_ts      INTEGER NOT NULL,        -- unix ms (UTC)
  end_ts        INTEGER NOT NULL,
  app_name      TEXT NOT NULL,
  bundle_id     TEXT,
  window_title  TEXT,                    -- may be NULL if no Screen Recording perm
  url           TEXT,                    -- may be NULL
  category_id   INTEGER REFERENCES category(id),
  is_idle       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_event_start ON activity_event(start_ts);

CREATE TABLE category (
  id        INTEGER PRIMARY KEY,
  name      TEXT NOT NULL,
  is_focus  INTEGER NOT NULL DEFAULT 0,  -- counts toward focus time
  color     TEXT
);

-- Rules: map app/url patterns to categories (and projects)
CREATE TABLE rule (
  id          INTEGER PRIMARY KEY,
  match_type  TEXT NOT NULL,             -- 'app' | 'url' | 'title'
  pattern     TEXT NOT NULL,             -- keyword/glob/regex
  category_id INTEGER REFERENCES category(id),
  project_id  INTEGER REFERENCES project(id),
  priority    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE project (
  id      INTEGER PRIMARY KEY,
  name    TEXT NOT NULL,
  client  TEXT,
  color   TEXT,
  archived INTEGER NOT NULL DEFAULT 0
);

-- Derived focus/work/break sessions
CREATE TABLE session (
  id         INTEGER PRIMARY KEY,
  type       TEXT NOT NULL,              -- 'focus' | 'break' | 'work'
  start_ts   INTEGER NOT NULL,
  end_ts     INTEGER NOT NULL,
  project_id INTEGER REFERENCES project(id),
  focus_score REAL
);

CREATE TABLE goal (
  id        INTEGER PRIMARY KEY,
  kind      TEXT NOT NULL,               -- 'daily_focus_minutes' etc.
  target    INTEGER NOT NULL,
  category_id INTEGER
);

-- Pre-aggregated daily stats for fast dashboards
CREATE TABLE daily_rollup (
  day            TEXT NOT NULL,          -- 'YYYY-MM-DD'
  category_id    INTEGER,
  project_id     INTEGER,
  total_seconds  INTEGER NOT NULL,
  focus_seconds  INTEGER NOT NULL,
  PRIMARY KEY (day, category_id, project_id)
);
```

#### Sampling strategy
- **Hybrid event-driven + polling:** subscribe to `NSWorkspace` app-activation notifications for the *primary* switch signal (cheap, instant), and run a **low-frequency poll (every ~2–5 s)** to catch in-app window-title/URL changes (which don't fire app-activation events). ActivityWatch polls on the order of seconds; this keeps CPU negligible. (Note: the `x-win`/active-win family polls as often as every 100 ms — far more than you need; 2–5 s is ample for time tracking.)
- **Debounce rapid switches:** ignore activations shorter than a threshold (e.g., <~2 s) or coalesce them so alt-tabbing through windows doesn't create dozens of micro-events. Attribute time to a sample only when it persists.
- **Batch writes:** buffer samples in memory and flush to SQLite in a transaction every N seconds (or on app switch). Synchronous drivers (`better-sqlite3`, `rusqlite`) handle this efficiently; wrap inserts in a single transaction.
- **Idle handling:** when idle > threshold, close the current event and emit an `is_idle` event/break; on return, optionally prompt to keep/discard the gap (Rize auto-creates a break for gaps of 5–60 minutes).

#### Aggregation / analytics
- Roll raw `activity_event` rows into `daily_rollup` on a schedule (e.g., every few minutes and at midnight) so the dashboard queries pre-aggregated data, not millions of raw rows.
- Compute **focus time with the 75%/15-min rule**: bucket the day into 15-minute windows; if ≥75% of a window is in `is_focus` categories, count the whole window as focus.
- Weekly/trend views aggregate `daily_rollup`.

#### Future iOS / sync foresight (DO NOT build now)
- **Keep the schema portable and the data layer isolated** behind a repository interface so storage can later be swapped/synced.
- Use **stable, semantic IDs and UTC timestamps**; avoid framework-specific column types. This keeps a future **CloudKit** or local-first sync (e.g., a CRDT/log-shipping layer, or SQLite sync) feasible without rework.
- Because iOS cannot do desktop-style window tracking anyway, the realistic future iOS role is a **read-only viewer of synced data** — which only requires that the *data* be portable, not the tracker. A clean schema is all the foresight you need now.

#### Privacy
- **All data local, zero telemetry, no network calls by default.** No screenshots, no keystrokes (match Rize's stance). Store the DB under `~/Library/Application Support/<app>/`. Offer CSV export (like Tockler) and a one-click "delete all data."

---

### 5. Key Implementation Challenges & Patterns

- **Low-CPU sampling:** event-driven app-switch detection + a 2–5 s poll for title/URL; never a tight `while` loop. Cache the last sample and only write on change.
- **Debouncing app switches:** coalesce/ignore sub-2-second activations; attribute time on dwell, not on every focus change.
- **Attributing time to apps/projects:** apply ordered `rule` matches (title/url/app, by priority) at sample time or rollup time; allow manual override that persists as a rule.
- **Sleep/wake & lid-close:** subscribe to `NSWorkspace.willSleepNotification`/`didWakeNotification` (and screen-lock notifications). On sleep, close the open event; on wake, start fresh — never count sleep as activity. This is a common source of inflated time if ignored, and Rize explicitly treats sleep gaps like idle gaps.
- **First-launch permission UX:** present a guided onboarding that (1) explains *why* each permission is needed, (2) requests Accessibility/Screen Recording in order, (3) **detects silent Screen-Recording degradation** (empty titles) and shows a "Open System Settings → Screen Recording" deep link, and (4) reminds the user to **quit & relaunch**. Re-check status on focus (Sequoia monthly re-prompt).
- **Menu-bar UI:** `LSUIElement` agent + menu-bar icon with quick stats, a "tracking on/off" toggle (Rize has a power icon for this), and "Open Dashboard." In Tauri use the tray APIs; the dashboard opens a WebView window.
- **Reporting/dashboard (your strength):** React + a charting lib (Recharts/visx/ECharts) for timeline, category sunburst/pie, daily/weekly trends. This is where the web frontend decisively beats native.
- **Packaging for personal use:** ad-hoc or free Personal-Team signing; run from local build; no notarization needed. Keep a stable bundle id and signing identity to preserve TCC grants.

---

### 6. Existing Open-Source References

| Project | License | Stack | What to learn / borrow |
|---|---|---|---|
| **ActivityWatch** (`aw-watcher-window`, `aw-watcher-afk`, `aw-server-rust`) | MPL-2.0 | Python watchers + Rust server | The canonical **watcher architecture**: separate window-watcher and AFK-watcher, "heartbeat" event model, **three macOS strategies (Swift / JXA / AppleScript)** with Swift preferred, accessibility-permission prompting, bucket/event data model. The single best reference. |
| **Tockler** | GPL-2.0 | Electron + TypeScript + SQLite (Drizzle) | A working **Electron** tracker: active-window + idle monitoring, **local SQLite** schema, timeline/pie charts, online/idle/offline states, CSV export. Closest in spirit to your goal. (GPL — learn from, don't copy code into closed source.) |
| **`get-windows` / `sindresorhus/active-win`** | MIT | Swift core + Node | The reference implementation for reading **app/title/url** on macOS and the **exact permission mapping** (title→Screen Recording, url→Accessibility). MIT = safe to adapt. |
| **`@rize-io/active-win`** | MIT | Swift + C++/N-API + Node | Rize's own fork — directly shows how the app you're cloning collects data (title, id, bounds, owner{name, processId, bundleId, path}, url, memoryUsage). |
| **`active-win-pos-rs`** | MIT | Rust | Window info from **Rust** (for the Tauri path); same Screen-Recording title gate (*"title property will always return an empty string unless you Enable Screen Recording permission"*). |
| **Selfspy** | GPL-3.0 | Python | Older keystroke/window logger; useful for idle/activity concepts, but more invasive than you want (skip keystroke logging). |
| **`node-mac-permissions` / `mac-screen-capture-permissions`** | MIT | Node addon | If you go Electron: check/request Accessibility, Screen Recording, Automation; reset semantics via `tccutil`. |
| **`objc2` crate family** | MIT/Apache | Rust | If you go Tauri-native: memory-safe AppKit/Foundation/CoreGraphics bindings. |

RescueTime and Rize themselves are closed-source; treat them as feature references only.

---

### 7. Recommended Architecture & Tech Stack (v1)

**Stack:**
- **Framework:** Tauri 2.x
- **Frontend:** React + TypeScript + Vite; charts via Recharts/ECharts; your existing component muscle memory
- **Backend/core:** Rust
- **Native data collection:** a small **Swift sidecar** (compiled binary) emitting JSON for frontmost app + window title + idle seconds (mirrors ActivityWatch's swift strategy), invoked from Rust — *or* direct `objc2-app-kit`/`core-graphics` calls from Rust. Start with the sidecar.
- **DB:** SQLite via **`rusqlite`** (tracker writes) + Tauri commands/SQL plugin (UI reads)
- **Launch at login:** `SMAppService` (opt-in)
- **Process structure:** **two logical components in one app** — (1) a lightweight **Tracker/watcher** (Rust + Swift sidecar) that samples and writes events, runs as a menu-bar agent; (2) a **UI/dashboard** (React WebView window) opened on demand. Keep them decoupled via the SQLite DB + a repository layer so the tracker can run headless.

**Process / data flow:**
```
[Swift sidecar] --JSON--> [Rust tracker loop] --batch txn--> [SQLite]
   (NSWorkspace,             (debounce, rules,                  |
    CGWindowList,             idle handling,                    | reads via
    CGEventSource)            rollups)                          v Tauri commands
                                                          [React dashboard]
[NSWorkspace sleep/wake notifications] -> tracker
[menu-bar tray] <-> tracker (toggle, quick stats)
```

**Phased roadmap:**
- **v1 (essentials):** menu-bar agent; frontmost-app + window-title sampling (Screen Recording onboarding); idle detection (5-min, category-aware); rule-based categories + projects; SQLite event store + daily rollups; 75%/15-min focus metric; manual entry/edit; React dashboard (timeline, category breakdown, daily/weekly); sleep/wake handling; launch-at-login; ad-hoc signing.
- **v1.x:** browser URL capture (AppleScript for Safari/Chrome, then a browser extension); Pomodoro + smart break reminders; daily goal + burnout notification; CSV export; focus score.
- **v2:** distraction detection/blocker; AI/auto-categorization; calendar integration; richer trends.
- **Future (not now, just don't foreclose):** portable schema + repository layer enabling a sync path (CloudKit/local-first) and a read-only iOS viewer.

**Permissions the app will require, and when to request them:**

| Permission | Needed for | When to request |
|---|---|---|
| **Screen Recording** | Window titles (`kCGWindowName`) | During onboarding, *before* first tracking; detect silent degradation; re-check on Sequoia monthly re-prompt; remind to quit & relaunch |
| **Accessibility** | AX-based title/URL reads; AppleScript UI scripting | Onboarding, only if using the AX route (request via `AXIsProcessTrustedWithOptions`) |
| **Automation / Apple Events** (per browser) | Browser tab URL via AppleScript | Lazily, the first time URL capture runs for that browser (v1.x) |
| **(none)** | Frontmost app name, idle time | Never — not gated |
| **Login item** (`SMAppService`) | Launch at login | Opt-in toggle in settings, default off |

---

## Recommendations

1. **Start with Tauri 2.x + React/TS + a Swift sidecar for native reads.** Build the watcher first (app name + idle — both permission-free) end-to-end into SQLite, *then* add the Screen-Recording-gated window title. This sequences the hard permission work after you have a working pipeline.
2. **Nail the permission UX early.** It's the #1 reason similar apps feel broken. Implement silent-degradation detection for Screen Recording, deep links to System Settings, the quit-&-relaunch reminder, and on-focus re-checks for Sequoia's monthly prompt.
3. **Sign with a free Personal-Team identity, not pure ad-hoc,** to keep TCC grants stable across rebuilds during development. You need no paid account or notarization for personal use.
4. **Model data as raw events → sessions → daily rollups from day one,** and query rollups in the UI. This keeps the dashboard fast and the focus-metric logic clean.
5. **Borrow architecture from ActivityWatch (watcher split, swift strategy, AFK watcher) and Tockler (Electron+SQLite schema, charts).** Respect licenses: MPL-2.0/MIT are safe to learn from and adapt; GPL code should inform design, not be copied into a closed codebase.
6. **Defer browser URL capture, AI categorization, distraction blocking, and calendar to post-v1.** App + title + idle + rules delivers most of Rize's daily value.
7. **Keep the schema portable and storage behind a repository interface** so a future sync/iOS-viewer path stays open — but build none of it now.

**Benchmarks that would change the recommendation:**
- If **Rust/FFI friction blocks you >1–2 weeks** → switch to **Electron** (you know it; ecosystem is ready) and accept the heavier footprint.
- If you discover you actually want **deep, reliable native integration and are willing to learn Swift** (or you decide iOS is a near-term priority) → reconsider **pure Swift/SwiftUI**.
- If **idle CPU/memory of your Tauri build exceeds, say, ~80–100 MB or shows measurable battery drain** on your Intel Mac → profile the poll interval and sidecar invocation before adding features.

---

## Caveats

- **Screen Recording for window titles is the load-bearing risk.** It degrades silently (no prompt), and **Sequoia 15+ re-prompts ~monthly** — both are UX hazards you must handle explicitly. If you skip Screen Recording entirely, you still get app-level tracking (no titles), which may be an acceptable privacy-friendly v1 mode.
- **Browser URL capture is fragile** via AppleScript (per-browser Automation grants, no Firefox support, `-1743` errors) — extensions are the robust path but more work. Treat as enhancement.
- **Tauri's native ecosystem for these niche APIs is thinner than Electron's;** you will likely write/port some Swift or Rust yourself. Budget for it. (Note also Tauri's SQL plugin can't currently be invoked from the Rust backend — use `rusqlite` for tracker-side writes.)
- **Intel is a sunset platform.** Everything works today on Tahoe 26 (the last Intel macOS), but macOS 27+ is Apple Silicon only — long-term, the app's home is an Apple Silicon Mac.
- **Some figures are directional, not exact:** Tauri vs Electron memory/bundle numbers come from third-party 2026 benchmarks and a real migration case (Hoppscotch 165 MB→8 MB) and vary by app; measure your own vertical slice before treating them as final. Rize's internal implementation beyond the confirmed Electron + `active-win` facts is **inferred** from public docs/reviews, not from source.
- **"AI categorization" in Rize is partly marketing for keyword/rule learning + ML;** you can reproduce the 80% that matters with deterministic rules and defer real ML.