/**
 * build-css.mjs — compile the framework-free stylesheet to dist/tw-fade.css.
 *
 *   node scripts/build-css.mjs        # writes dist/tw-fade.css
 *   import { compileCss } from …      # returns the CSS string (used by tests)
 *
 * src/tw-fade.css is the single source of truth, but it's authored for Tailwind
 * v4's CSS-first pipeline (@utility / @theme / --value()), so it can't be dropped
 * into a plain <link> as-is. This script runs the Tailwind v4 CLI over it to emit
 * a self-contained stylesheet for no-build / CDN consumers.
 *
 * Two tricks keep the output clean:
 *   1. We import only `tailwindcss/utilities.css` (NOT the full `tailwindcss`),
 *      so there's no Preflight reset and no theme dump — just the utility engine.
 *   2. We compile in an isolated temp dir and name every class via `@source
 *      inline(...)`. Tailwind's automatic source detection would otherwise scan
 *      the repo and pull in built-in utilities (.flex, .grid, …) it happened to
 *      find; in an empty temp dir it finds nothing, so the inline safelist is the
 *      ONLY thing generated — exactly our fade-* utilities and their foundations.
 *
 * This is a maintainer tool only; it is not shipped and consumers never run it.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

// Invoke the CLI's entry directly (not the .bin symlink, which npm can drop on
// reinstall) with the current node executable.
const cli = path.join(root, 'node_modules', '@tailwindcss', 'cli', 'dist', 'index.mjs')
const utilities = path.join(root, 'node_modules', 'tailwindcss', 'utilities.css')
const src = path.join(root, 'src', 'tw-fade.css')
const outFile = path.join(root, 'dist', 'tw-fade.css')

// Every class the framework-free build should contain. Arbitrary values
// (fade-size-[6rem], fade-ramp-[80px], fade-clear-top-[56px]) are intentionally
// absent — those require Tailwind's JIT and belong to the v4 source path, not
// the prebuilt drop-in.
const SCALE = 'xs,sm,md,lg,xl,2xl,3xl,4xl'
const CLASSES =
  `fade fade-{x,y,top,bottom,start,end} fade-none fade-none-{x,y} fade-always fade-always-{x,y} fade-size-{${SCALE}} fade-size-{x,y,top,bottom,start,end}-{${SCALE}} fade-ramp-{${SCALE}} fade-clear-{${SCALE},var} fade-clear-{x,y,top,bottom,start,end}-{${SCALE},var}`

const BANNER =
  '/*! tw-fade — framework-free build for plain HTML / CDN.\n' +
  ' * Generated from src/tw-fade.css; do not edit by hand. */\n'

/**
 * Compile src/tw-fade.css to a self-contained stylesheet and return it as a
 * string. No files are written — callers (the CLI block below, the test suite)
 * decide what to do with it. Tests can pass a custom class list to cover
 * source-path-only utilities that the prebuilt CSS intentionally omits.
 */
export function compileCss({ classes = CLASSES } = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-fade-build-'))
  try {
    const entry = path.join(tmp, 'entry.css')
    fs.writeFileSync(
      entry,
      `@import "${utilities}";\n@import "${src}";\n@source inline("${classes}");\n`,
    )
    const tmpOut = path.join(tmp, 'out.css')
    execFileSync(process.execPath, [cli, '-i', entry, '-o', tmpOut], {
      cwd: tmp,
      stdio: ['ignore', 'ignore', 'inherit'],
    })

    let css = fs.readFileSync(tmpOut, 'utf8')
    // Replace Tailwind's own banner with ours.
    css = css.replace(/^\/\*![^\n]*\*\/\n?/, '')
    return BANNER + css.trimStart()
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

/** Compile and write dist/tw-fade.css. */
export function build() {
  const out = compileCss()
  fs.mkdirSync(path.dirname(outFile), { recursive: true })
  fs.writeFileSync(outFile, out)
  console.log(`wrote ${path.relative(root, outFile)} (${out.length} bytes)`)
}

// Run the write only when invoked directly (`node scripts/build-css.mjs`), not
// when imported by the tests.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  build()
}
