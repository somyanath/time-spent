import { defineConfig } from 'vitest/config'

// Tests run in plain Node (not Electron), so better-sqlite3 is loaded against
// the Node ABI. The behavioural seams for slice 1 (the migration runner) need
// nothing from Electron.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
  },
})
