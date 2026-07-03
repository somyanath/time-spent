// Compiles the single MV3 extension source into the two loadable bundles
// (#33, ADR-0004): dist/chrome for Chromium browsers (Chrome, Arc, Edge,
// Brave — service-worker background) and dist/firefox for Firefox-based
// browsers (Zen — event-page background). Everything else (shared logic,
// options page, permissions) is identical between the two targets.

import { build } from 'esbuild'
import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = path.dirname(fileURLToPath(import.meta.url))

const SHARED_MANIFEST = {
  manifest_version: 3,
  name: 'Time Tracker URL Capture',
  version: '1.0.0',
  description:
    'Reports the active tab URL to the local Time Tracker app over an authenticated localhost WebSocket. No data ever leaves this machine.',
  options_ui: { page: 'options.html', open_in_tab: false },
  permissions: ['tabs', 'storage'],
  host_permissions: ['http://127.0.0.1/*'],
}

export function buildManifest(target) {
  if (target === 'chrome') {
    return { ...SHARED_MANIFEST, background: { service_worker: 'background.js' } }
  }
  return {
    ...SHARED_MANIFEST,
    background: { scripts: ['background.js'] },
    browser_specific_settings: { gecko: { id: 'url-capture@time-tracker.local' } },
  }
}

async function buildTarget(target) {
  const outDir = path.join(DIR, 'dist', target)
  await rm(outDir, { recursive: true, force: true })
  await mkdir(outDir, { recursive: true })

  await build({
    entryPoints: [path.join(DIR, 'src/background.ts'), path.join(DIR, 'src/options.ts')],
    outdir: outDir,
    bundle: true,
    format: 'iife',
    target: 'es2020',
    logLevel: 'warning',
  })

  await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(buildManifest(target), null, 2))
  await copyFile(path.join(DIR, 'src/options.html'), path.join(outDir, 'options.html'))
}

async function main() {
  await Promise.all([buildTarget('chrome'), buildTarget('firefox')])
  console.log('Built extension/dist/chrome and extension/dist/firefox')
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  await main()
}
