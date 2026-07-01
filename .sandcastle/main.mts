import { run, claudeCode } from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";

// Simple loop: an agent that picks open issues one by one and closes them.
// Run this with: npx tsx .sandcastle/main.mts
// Or add to package.json scripts: "sandcastle": "npx tsx .sandcastle/main.mts"

await run({
  // A name for this run, shown as a prefix in log output.
  name: "worker",

  // Sandbox provider — runs the agent inside an isolated container.
  sandbox: docker(),

  // The agent provider. Pass a model string to claudeCode() — sonnet balances
  // capability and speed for most tasks. Switch to claude-opus-4-8 for harder
  // problems, or claude-haiku-4-5-20251001 for speed.
  agent: claudeCode("claude-sonnet-5"),

  // Path to the prompt file. Shell expressions inside are evaluated inside the
  // sandbox at the start of each iteration, so the agent always sees fresh data.
  promptFile: "./.sandcastle/prompt.md",

  // Maximum number of iterations (agent invocations) to run in a session.
  // Each iteration works on a single issue. Increase this to process more issues
  // per run, or set it to 1 for a single-shot mode.
  maxIterations: 3,

  // Branch strategy — merge-to-head creates a temporary branch for the agent
  // to work on, then merges the result back to HEAD when the run completes.
  // This is required when using copyToWorktree, since head mode bind-mounts
  // the host directory directly (no worktree to copy into).
  branchStrategy: { type: "merge-to-head" },

  // IMPORTANT: do NOT copy the host node_modules into the sandbox. This is a
  // pnpm project on a macOS (darwin) host, but the sandbox runs Linux. The host
  // node_modules is a pnpm symlink farm full of darwin-native binaries
  // (better-sqlite3, electron, esbuild) that break under Linux. Leave this empty
  // and let a clean pnpm install inside the sandbox build correct Linux binaries.
  copyToWorktree: [],

  // Lifecycle hooks — commands grouped by where they run (host or sandbox).
  hooks: {
    sandbox: {
      // onSandboxReady runs once after the sandbox is initialised and the repo is
      // synced in, before the agent starts. This is a pnpm project, so install
      // with pnpm — NOT npm. CI=true keeps pnpm non-interactive (otherwise it can
      // abort with ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY).
      onSandboxReady: [{ command: "CI=true pnpm install --frozen-lockfile" }],
    },
  },
});
