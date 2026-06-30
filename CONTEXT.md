# Time Tracker

A desktop-only macOS app that passively observes which application/window is active, persists that observation stream, and derives behavioral insights (focus, distraction, breaks) on top of it. A personal Rize.io-style tracker.

## Language

**Heartbeat**:
A single point-in-time observation of the active context (app, window title, URL) emitted periodically by the tracker. The raw, append-only source of truth. Everything else is derived from heartbeats on read.
_Avoid_: sample, ping, tick, event (too generic)

**Derived (vs. observed)**:
A property is _observed_ if it comes directly from a heartbeat; _derived_ if it is computed from a sequence of heartbeats (e.g. sessions, focus, idle gaps). Heartbeats are observed; everything intelligent is derived.

**Focus Session**:
A derived span where the user spent at least a purity threshold (default 75%) of a rolling window (default 15 min) on Focus-category activity. Both the window length and threshold are tunable parameters recomputed over stored heartbeats, not fixed at write time.
_Avoid_: deep work block, work session (reserve "session" for the generic derived span)

**Focus Quality Score**:
A transparent, deterministic per-day score (0–100, work-hours-scoped) derived from three legible components — **focus ratio** (share of active time that's Focus), **distraction penalty** (Distracting time / Nudges), and **focus continuity** (how much focus came in long uninterrupted Focus Sessions). No ML, no raw context-switch penalty (switching among Focus apps is not punished). The breakdown is always shown alongside the number.
_Avoid_: focus score (use full name), productivity score, the "20 attributes"

**Category**:
A label for _what kind_ of activity a heartbeat represents (Code, Email, Messaging, Design, Social Media). Carries a three-way **Productivity Rating**. Orthogonal to Project.
_Avoid_: type, tag, label (reserve those for generic use)

**Productivity Rating**:
A Category's three-way classification — **Focus** / **Neutral** / **Distracting** — replacing the older binary `is_focus`. Focus counts toward Focus Sessions; Distracting is the only thing that triggers the distraction Nudge and drags down distraction/quality metrics; Neutral (e.g. Email, system, meetings) is real work that is never punished.
_Avoid_: is_focus, productivity score (reserve "score" for computed metrics)

**Project**:
A label for _what_ a heartbeat was in service of (a client, a side-app, job hunt). Orthogonal to Category — the same heartbeat carries both. Answers "what was I working on?"
_Avoid_: client (a client is an attribute of a project, not the project)

**Rule**:
An ordered, user-defined mapping from observed heartbeat facts (app / url / title pattern) to a Category and/or Project. Applied at read time, so editing a rule re-derives all history. The lowest-priority source of categorization.
_Avoid_: filter, matcher

**Override**:
A stored, user-made correction asserting that a specific span is a given Category/Project regardless of what Rules say. Sticky (survives rule edits) and highest priority. The only categorization that is persisted rather than derived.
_Avoid_: manual entry, correction, exception

**Manual Entry**:
A stored, user-authored span (start, end, category, project) for time the tracker could not observe — offline meetings, phone calls, paper notebook work. Unlike an Override it _creates_ time rather than relabeling observed time. Coexists with heartbeats at read time.
_Avoid_: manual event, custom entry

**Discard**:
A user action marking a derived span as not-counted (e.g. falsely-tracked time), excluding it from all metrics without deleting the underlying heartbeats.
_Avoid_: delete, ignore, exclude

**Span**:
A contiguous interval of time with a single attribution (one app/category/project), derived by merging consecutive like heartbeats on read. The generic unit the timeline shows and that Override / Manual Entry / Discard act on.
_Avoid_: interval, block, segment, event

**Idle**:
The observed condition of no keyboard/mouse (HID) input for longer than a threshold (default 5 min). `idle_seconds` is observed on every heartbeat (permission-free); whether idle _becomes a gap_ is derived and category-aware.
_Avoid_: AFK, away, inactive

**Break**:
A derived span where the user stepped away — an Idle gap of roughly 5–60 min (machine awake). Longer idle gaps, or anything spanning system sleep/lock, are discarded entirely (counted as nothing), never a Break. Distinct from **Break Reminder** (the proactive rest notification).
_Avoid_: away time, gap, pause, afk break

**Presence-without-input**:
A configurable set of Categories (default: Video Conferencing, Meetings, Entertainment, Learning) where lack of HID input does NOT imply absence, so Idle is suppressed from becoming a gap. Without this, meeting/video time is wrongly cut.
_Avoid_: passive categories, no-input categories

**App-level-only mode**:
A user-toggleable tracking mode that records app name (and URL where available) but deliberately does NOT read window titles, so the Screen Recording permission is unused. The graceful, privacy-respecting degradation of full tracking — a feature, not just the failure state when the grant lapses.
_Avoid_: private mode, incognito, basic mode

**URL Source**:
The origin of a heartbeat's `url`, in precedence order: the browser **Extension** (primary, all browsers) → **AppleScript** (fallback, AppleScript-capable browsers only) → none (Firefox-based browsers like Zen degrade to app-level when the extension is down).
_Avoid_: tab tracker, browser watcher

**Nudge**:
The interruptive notification fired when ≥75% of a rolling 15-min window (both configurable) is Distracting. Notify-only in v1 (no blocking), with a ~10-min cooldown. Only fires while Work Mode is on.
_Avoid_: alert, reminder, distraction popup

**Break Reminder**:
A proactive, interruptive notification suggesting rest after a configurable block (default **120 min**, ultradian) of accumulated **Focus**-rated _active_ time. Meetings/Neutral/idle never add to the accumulator; an Idle gap ≥5 min resets it to zero. Notify-only, snoozable, gated by Work Mode. Distinct from **Break** (the derived step-away span).
_Avoid_: break (without "Reminder"), rest alert, pomodoro

**Goal**:
A user-set daily target. Two kinds in v1: a **Focus target** (aspirational — accumulated Focus time; one gentle celebration notification on reaching it) and an **Overwork ceiling** (protective — total work-hours active time; the burnout signal, fires one "wrap up?" notification on crossing). Both gated by Work Mode. Category caps and weekly/streak goals are deferred.
_Avoid_: target, quota

**Burnout signal**:
Not a separate detector — it _is_ the Overwork ceiling being crossed. Deterministic, not inferred.
_Avoid_: burnout detection, overwork AI

**Working Hours**:
A per-weekday schedule of one or more time ranges (each day independent; a "copy to all days" convenience exists) during which Work Mode is automatically on. Set once; low-friction backbone for the Nudge.
_Avoid_: work schedule, active hours, office hours

**Work Mode**:
The current effective on/off state that gates judgment (the Nudge and work-hours-scoped distraction metrics) — never tracking. Set automatically by Working Hours and flippable by a single manual Override toggle. A manual flip lasts only until the next scheduled boundary, then Working Hours resumes (self-healing; you can't permanently disable nudges by accident).
_Avoid_: focus mode, do not disturb, work session
