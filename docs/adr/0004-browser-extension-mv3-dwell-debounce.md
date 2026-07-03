# Browser extension is one MV3 source (dual-built for Chromium + Firefox), reporting URLs on a 30-second dwell

## Context

ADR-0002 made a browser extension the primary URL source for **all** browsers.
The extension that shipped in Slice 7 is a **Manifest V2** WebExtension
(persistent background page, `browser_specific_settings.gecko`), which only
actually loads in Firefox-based browsers — the user's **Zen**. Current Chromium
browsers (Chrome, Arc) have removed MV2 support and require **Manifest V3**, so
ADR-0002's "all browsers" promise is unmet for the Chromium half. The user runs
Chromium browsers too and wants them covered.

Separately, the MV2 extension reports the active tab URL on *every* tab
activation over a persistent socket. On Chromium MV3 there is no persistent
background page — a service worker is terminated after ~30 s idle — so a
long-lived socket cannot survive, and per-switch reporting is both noisy for a
passive tracker and awkward under that lifecycle.

## Decision

One **Manifest V3** source, built into two dist bundles by a small build step:

- `dist/chrome/` — Chromium (Chrome, Arc, Edge, Brave).
- `dist/firefox/` — Firefox-based (Zen).

Shared logic uses `webextension-polyfill` so `browser.*` works on both; the only
per-target differences are the manifest's background declaration and the timer
mechanism. **MV2 is dropped entirely** (Firefox runs MV3).

The extension reports on a **30-second dwell**. On any active-URL change (tab
activated, window focus, in-tab navigation) it compares the new URL to the last
*committed* URL: if equal, it cancels any pending report; otherwise it (re)starts
a 30 s timer. On the timer it opens a short-lived authenticated `127.0.0.1`
WebSocket, sends the URL, and closes. A pending report is cancelled when the
browser loses focus. There is **no persistent socket** — commits are ≥30 s
apart, so reconnect-per-commit is cheap.

The 30 s timer is `chrome.alarms` on Chromium (the sanctioned way to wake a
service worker; `setTimeout` is unreliable there) and a plain `setTimeout` on
Firefox (its event-page background holds a timer fine, and it has neither
`alarms` sub-minute support nor an offscreen API).

## Considered options

- **15 s dwell via a Chromium Offscreen Document** (an invisible page holding a
  real `setTimeout` + the socket): rejected — managing the offscreen document's
  lifecycle is complexity spent only to win 15 s of precision, and it diverges
  the two builds further (offscreen on Chromium vs `setTimeout` on Firefox). 30 s
  fits `chrome.alarms` directly and keeps the two builds near-identical.
- **Two hand-maintained folders (MV2 + MV3):** rejected — ~80% of the code
  (options page, token handling, URL reporting) is identical and would drift; and
  Firefox runs MV3, so a separate MV2 build is unnecessary.
- **Persistent socket + report-on-every-switch:** rejected — chatty for a passive
  tracker, and a persistent socket cannot survive a Chromium MV3 service worker
  without an offscreen document.
- **Dwell filtering in the app, not the extension:** rejected for v1 — it keeps
  the extension dumb but forces a persistent socket (→ offscreen on Chromium
  anyway) and moves a browser-shaped decision server-side; the dwell belongs
  where the tab events are.

## Consequences

- The extension now genuinely loads in Chromium (Chrome, Arc) as well as Zen,
  making ADR-0002's "all browsers" real.
- A build step and a `webextension-polyfill` dependency enter the extension
  (previously build-less); loading becomes "Load unpacked `dist/chrome/`" /
  "Load Temporary Add-on from `dist/firefox/`" rather than the raw folder.
- **The first ~30 s of every genuine tab visit is attributed to the previously
  committed URL, and visits shorter than 30 s leave no URL** — the intended
  dwell-filter semantics. The app still knows the browser was frontmost during
  those moments via active-win; it simply lacks a URL for them.
- The app's localhost WS server must tolerate frequent short-lived connections
  (one per committed report) instead of a single long-lived one.
- URL granularity is coarser (30 s). Sub-30 s precision is available only via the
  rejected offscreen-document path, revisitable if it ever matters.
