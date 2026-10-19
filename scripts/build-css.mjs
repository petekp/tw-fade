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
// (fade-size-[6rem], fade-travel-[80px], fade-clear-top-[56px]) are intentionally
// absent — those require Tailwind's JIT and belong to the v4 source path, not
// the prebuilt drop-in.
const SCALE = 'xs,sm,md,lg,xl,2xl,3xl,4xl'
const DIRECTIONS = 'x,y,top,bottom,start,end'
const CLASSES = [
  `fade fade-{${DIRECTIONS}}`,
  `fade-blur fade-blur-{${DIRECTIONS}} fade-blur-{sm,md,lg} fade-blur-layer fade-blur-frame`,
  `fade-{always,auto,none} fade-{always,auto,none}-{${DIRECTIONS}}`,
  `fade-blur-{always,auto,none} fade-blur-{always,auto,none}-{${DIRECTIONS}}`,
  `fade-size-{${SCALE}} fade-size-{${DIRECTIONS}}-{${SCALE}}`,
  `fade-travel-{${SCALE}}`,
  `fade-clear-{${SCALE},var} fade-clear-{${DIRECTIONS}}-{${SCALE},var}`,
  'fade-scrollbar-safe-{x,y,xy} fade-scrollbar-width-{sm,md,lg}',
].join(' ')

const OPACITY_DIRECTIONS = ['fade', ...DIRECTIONS.split(',').map((direction) => `fade-${direction}`)]
const BLUR_DIRECTIONS = OPACITY_DIRECTIONS.map((name) => name.replace(/^fade/, 'fade-blur'))

function directionBlock(source, name) {
  const pattern = new RegExp(`^@utility ${name} \\{`, 'gm')
  const matches = [...source.matchAll(pattern)]
  if (matches.length !== 1) throw new Error(`Expected one @utility ${name}, found ${matches.length}`)
  const start = matches[0].index
  let depth = 0
  for (let index = source.indexOf('{', start); index < source.length; index++) {
    if (source[index] === '{') depth++
    else if (source[index] === '}' && --depth === 0) {
      return { start, end: index + 1, text: source.slice(start, index + 1) }
    }
  }
  throw new Error(`Unclosed @utility ${name}`)
}

function sharedPrebuiltSource(source) {
  const blocks = [...OPACITY_DIRECTIONS, ...BLUR_DIRECTIONS]
    .map((name) => ({ name, ...directionBlock(source, name) }))
    .sort((left, right) => left.start - right.start)
  const blurGates = blocks
    .filter(({ name }) => name.startsWith('fade-blur'))
    .map(({ text }) => text.match(/@supports\s+[^{}]+(?=\s*\{)/)?.[0].trim())
  if (blurGates.some((gate) => !gate || gate !== blurGates[0])) {
    throw new Error('Blur direction support gates differ')
  }

  const selector = (names) => `:is(${names.map((name) => `.${name}`).join(', ')})`
  // Share only renderer declarations; each public utility still owns its raw hooks and selection.
  const shared = `@layer utilities {
  ${selector(OPACITY_DIRECTIONS)} { @apply tw-fade-base tw-fade-mask; }
  ${blurGates[0]} {
    ${selector(BLUR_DIRECTIONS)}:where(.fade-blur-frame) { @apply tw-fade-base tw-fade-overlay; }
  }
}
`
  let output = source.slice(0, blocks[0].start) + shared
  let cursor = blocks[0].start
  for (const { name, start, end, text } of blocks) {
    const prefix = name.startsWith('fade-blur')
      ? '@apply tw-fade-base tw-fade-overlay '
      : '@apply tw-fade-base tw-fade-mask '
    if (text.split(prefix).length !== 2) throw new Error(`Shared @apply changed in ${name}`)
    output += source.slice(cursor, start) + text.replace(prefix, '@apply ')
    cursor = end
  }
  return output + source.slice(cursor)
}

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
    let sourcePath = src
    if (classes === CLASSES) {
      sourcePath = path.join(tmp, 'shared-source.css')
      fs.writeFileSync(sourcePath, sharedPrebuiltSource(fs.readFileSync(src, 'utf8')))
    }
    fs.writeFileSync(
      entry,
      `@layer theme, base, components, utilities;\n@import "${utilities}" layer(utilities);\n@import "${sourcePath}";\n@source inline("${classes}");\n`,
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
