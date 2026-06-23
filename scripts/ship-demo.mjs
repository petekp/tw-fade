#!/usr/bin/env node
// One command to put the current demo live at pete.design/tw-fade.
//
// pete.design is a separate Next.js app (petekp/pete-2025) deployed on Vercel.
// It serves /tw-fade from a *vendored snapshot* in its public/tw-fade/ folder —
// pushing tw-fade alone changes nothing. This script closes that gap: rebuild
// the demo CSS, export the static demo, copy it into the site repo, then
// commit + push the site so Vercel deploys. See memory/deploy-architecture.md.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  exportDemoStatic,
  demoStaticFiles,
  defaultDemoBasePath,
} from '../build/demo-static.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

function hasFlag(name) {
  return process.argv.includes(`--${name}`)
}
function readOption(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  if (i === -1) return fallback
  const value = process.argv[i + 1]
  if (!value || value.startsWith('--')) throw new Error(`--${name} requires a value`)
  return value
}

// The site repo: sibling ../pete-2025 by default, override with --site or env.
const siteDir = path.resolve(
  readOption('site', process.env.TW_FADE_SITE_DIR ?? path.join(rootDir, '..', 'pete-2025')),
)
const publicTarget = path.join(siteDir, 'public', 'tw-fade')
const skipBuild = hasFlag('no-build')
const skipPush = hasFlag('no-push')

const log = (msg) => console.log(`\x1b[36m▸\x1b[0m ${msg}`)
const git = (cwd, args, opts = {}) => {
  // With stdio: 'inherit' execFileSync returns null (nothing captured), so only
  // trim when we actually got output back.
  const out = execFileSync('git', args, { cwd, encoding: 'utf8', ...opts })
  return typeof out === 'string' ? out.trim() : ''
}

async function exists(p) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

// 0. Sanity: is the site repo actually there?
if (!(await exists(path.join(siteDir, '.git')))) {
  console.error(
    `\x1b[31m✗\x1b[0m Site repo not found at ${siteDir}\n` +
      `  Pass --site <path> or set TW_FADE_SITE_DIR to your pete-2025 checkout.`,
  )
  process.exit(1)
}

// 1. Rebuild the demo CSS so shipped styles match the demo's current classes.
if (skipBuild) {
  log('Skipping demo CSS rebuild (--no-build)')
} else {
  log('Rebuilding demo CSS (npm run build:demo)…')
  execFileSync('npm', ['run', 'build:demo'], { cwd: rootDir, stdio: 'inherit' })
}

// 2. Export the static demo (base-path /tw-fade) to a scratch dir.
log('Exporting static demo…')
const outDir = path.join(rootDir, '.tmp', 'demo-static')
const { targetDir } = await exportDemoStatic({ outDir, basePath: defaultDemoBasePath })

// 3. Mirror the exported files into the site's public/tw-fade/.
log(`Syncing ${demoStaticFiles.length} files → ${path.relative(rootDir, publicTarget) || publicTarget}`)
await fs.mkdir(publicTarget, { recursive: true })
for (const fileName of demoStaticFiles) {
  await fs.copyFile(path.join(targetDir, fileName), path.join(publicTarget, fileName))
}

// 4. Stage and check for a real change before committing.
git(siteDir, ['add', 'public/tw-fade'])
const pending = git(siteDir, ['status', '--porcelain', 'public/tw-fade'])
if (!pending) {
  log('Demo already up to date in the site repo — nothing to deploy. ✓')
  process.exit(0)
}

// 5. Commit, tagging the tw-fade source revision for traceability.
const sourceRev = git(rootDir, ['rev-parse', '--short', 'HEAD'])
const branch = git(siteDir, ['rev-parse', '--abbrev-ref', 'HEAD'])
git(siteDir, ['commit', '-m', `Sync tw-fade demo (${sourceRev})`])
log(`Committed demo sync to ${branch} in the site repo.`)

// 6. Push so Vercel deploys (production only from main).
if (skipPush) {
  log('Skipping push (--no-push). Run `git -C ' + siteDir + ' push` when ready.')
  process.exit(0)
}
log(`Pushing ${branch} → origin…`)
git(siteDir, ['push', 'origin', branch], { stdio: 'inherit' })
if (branch === 'main') {
  log('Pushed to main — Vercel is deploying pete.design/tw-fade. ✓')
} else {
  log(`Pushed ${branch} (a preview branch). Merge to main for production.`)
}
