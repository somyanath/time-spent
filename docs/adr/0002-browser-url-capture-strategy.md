# Browser URL capture is in v1, extension-primary with AppleScript fallback

## Context

The three-way Productivity Rating (Focus/Neutral/Distracting) drives focus
sessions, the distraction Nudge, and quality metrics. The browser is the one app
that spans all three ratings at once (GitHub vs Gmail vs Twitter are all "the
browser"), so without the active tab's URL the rating is wrong for a large share
of a frontend engineer's day. The research doc deferred URL capture to v1.x; the
full-Rize goal forces it into v1. The user's primary browser is **Zen**
(Firefox-based), which exposes **no AppleScript URL interface**.

## Decision

URL capture ships in **v1** with a layered source model:

- **Primary (all browsers, incl. Zen):** a browser extension reports the active
  tab URL to the app. Zen is Firefox-based, so a standard Firefox WebExtension
  works.
- **Fallback (AppleScript-capable browsers only — Safari, Chrome, Edge, Brave,
  Arc):** AppleScript / Apple Events, lazily permissioned.
- **Firefox-based browsers (Zen):** no automated fallback. When the extension is
  absent/down, Zen degrades to **app-level only** (no URL) until the extension
  is back.

## Considered options

- **AppleScript-only (doc's v1.x path):** rejected — no Firefox/Zen support, and
  Zen is the user's main browser.
- **Accessibility-API address-bar read as the Firefox fallback:** rejected —
  fragile across browser UI updates and adds an Accessibility TCC grant for
  marginal value, given a personal app where the user controls the extension
  install and downtime is rare.

## Consequences

- A second codebase (the extension) is part of v1.
- Avoids needing the Accessibility permission for URLs; heavy TCC grants reduce
  to Screen Recording (window titles) + Automation (AppleScript fallback).
- Browser time in Zen is blind to URL only during the rare window when the
  extension is not running.
