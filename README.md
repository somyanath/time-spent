# Time Tracker

A private, local, macOS menu-bar app that passively observes which app/window/URL
is active and derives focus insights from an append-only **Heartbeat** stream.
See [`CONTEXT.md`](./CONTEXT.md) for the domain language, [`docs/adr`](./docs/adr)
for the architecture decisions, and issue #1 for the full v1 PRD.

## Status — Slice 1 (walking skeleton)

The process model is alive end to end, with no tracking or derivation yet:

- Electron **menu-bar agent** — no Dock icon: `app.dock.hide()` in dev, and the
  real `LSUIElement` plist key via `electron-builder` (`pnpm package`).
- Tray menu with **Open Dashboard**, which opens the React/TypeScript renderer.
- Renderer shows the empty **Today** surface (the default landing view).
- `better-sqlite3` opens/creates the DB under
  `~/Library/Application Support/time-tracker/` with a **migration runner** that
  applies versioned migrations idempotently on startup (WAL, foreign keys on).
  The schema starts empty — tables arrive with the slices that need them.

## Stack

Electron + React + TypeScript, bundled with [electron-vite](https://electron-vite.org);
SQLite via `better-sqlite3`; tests with Vitest.

- `src/main` — main process (lifecycle, tray, window, DB + migrations)
- `src/preload` — the context-isolated bridge (`window.timeTracker`)
- `src/renderer` — the React dashboard
- `src/shared` — types shared across processes

## Develop

```sh
pnpm install
pnpm rebuild:electron   # build better-sqlite3 for Electron's ABI (see below)
pnpm dev                # launch the app with HMR
```

### The native-module ABI gotcha

`better-sqlite3` is a native addon and must match the ABI of whoever loads it —
**Electron** when running the app, **Node** when running Vitest. They differ, so
switch with:

```sh
pnpm rebuild:electron   # before: pnpm dev / pnpm build / packaging
pnpm rebuild:node       # before: pnpm test
```

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Run the app (electron-vite, HMR). Needs the **Electron** ABI. |
| `pnpm build` | Bundle main + preload + renderer into `out/`. |
| `pnpm typecheck` | Type-check the Node and web projects. |
| `pnpm test` | Run the Vitest suite. Needs the **Node** ABI. |
| `pnpm package` | Build an unpacked `.app` under `release/` (sets `LSUIElement`). |
| `pnpm gen:icon` | Regenerate the tray template icon in `resources/`. |
