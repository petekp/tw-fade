/**
 * Unit tests for tw-fade.
 *
 * These tests compile src/tw-fade.css through the same Tailwind v4 path used by
 * scripts/build-css.mjs, then assert on the emitted CSS bytes. Browser-level
 * behavior is covered by build/verify*.mjs.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { compileCss } from '../scripts/build-css.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const css = compileCss()
const customCss = compileCss({
  classes:
    'fade-size-[15%] fade-size-top-[56px] fade-travel-[80px] fade-clear-14 fade-clear-y-14 fade-clear-x-14 fade-clear-top-14 fade-clear-bottom-14 fade-clear-start-14 fade-clear-end-14',
})

function block(selector, source = css) {
  const at = source.indexOf(selector + ' {')
  if (at === -1) return null
  const open = source.indexOf('{', at)
  let depth = 0
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++
    else if (source[i] === '}' && --depth === 0) return source.slice(open + 1, i)
  }
  return null
}

function property(name) {
  const body = block('@property ' + name)
  if (body == null) return null
  const field = (k) => {
    const m = body.match(new RegExp(`${k}:\\s*([^;]+);`))
    return m ? m[1].trim() : undefined
  }
  return { syntax: field('syntax'), inherits: field('inherits'), 'initial-value': field('initial-value') }
}

function declValue(body, prop) {
  const m = body?.match(new RegExp(`${prop}:\\s*([^;]+);`))
  return m ? m[1].trim() : undefined
}

function compact(value) {
  return value?.replace(/\s+/g, ' ')
}

function classSelectors(source = css) {
  return new Set(
    [...source.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)]
      .map((m) => m[1])
      .filter((name) => name === 'fade' || name.startsWith('fade-')),
  )
}

const SCALE = [
  ['xs', 6],
  ['sm', 8],
  ['md', 12],
  ['lg', 16],
  ['xl', 20],
  ['2xl', 24],
  ['3xl', 32],
  ['4xl', 40],
]

const PUBLIC_DIRECTIONS = ['fade', 'fade-y', 'fade-top', 'fade-bottom', 'fade-x', 'fade-start', 'fade-end']
// Classes that must NOT compile, both groups intentional:
//  - the old physical API removed in 0.7.0 (fade-t/b/l/r, fade-xy, fade-static, fade-left/right);
//  - the fully-logical block/inline aliases from an earlier draft. The shipped API deliberately
//    uses plain directions (physical top/bottom, direction-aware start/end) instead of
//    fade-inline-start / fade-block-* — see "Why Plain Directions" in MIGRATING.md. Re-adding
//    any of these should be a conscious decision, not an accidental regression.
const REJECTED_CLASSES = [
  'fade-t',
  'fade-b',
  'fade-l',
  'fade-r',
  'fade-xy',
  'fade-left',
  'fade-right',
  'fade-block',
  'fade-block-start',
  'fade-block-end',
  'fade-inline',
  'fade-inline-start',
  'fade-inline-end',
  'fade-range-sm',
  'fade-ramp-sm',
  'fade-static',
]
const SHARED_SELECTOR = '.fade, .fade-y, .fade-top, .fade-bottom, .fade-x, .fade-start, .fade-end'
const RTL_SELECTOR =
  '.fade:where(:dir(rtl)), .fade-y:where(:dir(rtl)), .fade-top:where(:dir(rtl)), .fade-bottom:where(:dir(rtl)), .fade-x:where(:dir(rtl)), .fade-start:where(:dir(rtl)), .fade-end:where(:dir(rtl))'
const TOP_SELECTOR = '.fade, .fade-y, .fade-top'
const BOTTOM_SELECTOR = '.fade, .fade-y, .fade-bottom'
const START_SELECTOR = '.fade, .fade-x, .fade-start'
const END_SELECTOR = '.fade, .fade-x, .fade-end'
const MASK_VARS = ['--tw-fade-mask-t', '--tw-fade-mask-b', '--tw-fade-mask-l', '--tw-fade-mask-r']
const SIZE_VARS = [
  '--tw-fade-size',
  '--tw-fade-size-y',
  '--tw-fade-size-x',
  '--tw-fade-size-top',
  '--tw-fade-size-bottom',
  '--tw-fade-size-start',
  '--tw-fade-size-end',
]
const CLEAR_VARS = [
  '--tw-fade-clear',
  '--tw-fade-clear-y',
  '--tw-fade-clear-x',
  '--tw-fade-clear-top',
  '--tw-fade-clear-bottom',
  '--tw-fade-clear-start',
  '--tw-fade-clear-end',
]
const ROUTING_VARS = [
  '--tw-fade-ltr-start-layer',
  '--tw-fade-ltr-end-layer',
  '--tw-fade-rtl-start-layer',
  '--tw-fade-rtl-end-layer',
  '--tw-fade-ltr-start-animation',
  '--tw-fade-ltr-end-animation',
  '--tw-fade-rtl-start-animation',
  '--tw-fade-rtl-end-animation',
  '--tw-fade-ltr-start-timeline',
  '--tw-fade-ltr-end-timeline',
  '--tw-fade-rtl-start-timeline',
  '--tw-fade-rtl-end-timeline',
  '--tw-fade-ltr-start-animation-range',
  '--tw-fade-ltr-end-animation-range',
  '--tw-fade-rtl-start-animation-range',
  '--tw-fade-rtl-end-animation-range',
]
const ALPHA_MULTIPLIERS = [
  '0.983',
  '0.933',
  '0.854',
  '0.75',
  '0.629',
  '0.5',
  '0.371',
  '0.25',
  '0.146',
  '0.067',
  '0.017',
]
const POSITION_MULTIPLIERS = [
  '0.08333',
  '0.16667',
  '0.25',
  '0.33333',
  '0.41667',
  '0.5',
  '0.58333',
  '0.66667',
  '0.75',
  '0.83333',
  '0.91667',
]

test('registers amounts as typed numbers and config/routing vars as universal non-inheriting', () => {
  for (const amt of ['--tw-fade-t', '--tw-fade-b', '--tw-fade-l', '--tw-fade-r']) {
    const prop = property(amt)
    assert.ok(prop, `missing @property ${amt}`)
    assert.equal(prop.syntax, '"<number>"')
    assert.equal(prop.inherits, 'false')
    assert.equal(prop['initial-value'], '0')
  }

  for (const v of [...SIZE_VARS, '--tw-fade-travel', ...CLEAR_VARS, ...MASK_VARS, ...ROUTING_VARS]) {
    const prop = property(v)
    assert.ok(prop, `missing @property ${v}`)
    assert.equal(prop.syntax, '"*"')
    assert.equal(prop.inherits, 'false')
    assert.equal(prop['initial-value'], undefined)
  }
})

test('every typed @property has a computationally-independent initial-value', () => {
  const ABSOLUTE = /^-?(?:\d+\.?\d*|\.\d+)(px|cm|mm|in|pt|pc|q)?$/i
  const names = [...css.matchAll(/@property\s+(--[\w-]+)\s*\{/g)].map((m) => m[1])
  assert.ok(names.length >= 20, 'expected registered properties')
  for (const name of names) {
    const decl = property(name)
    if (decl.syntax === '"*"') {
      assert.equal(decl['initial-value'], undefined, `${name} (universal) should omit initial-value`)
      continue
    }
    const initial = decl['initial-value']
    assert.ok(initial !== undefined, `typed ${name} must declare an initial-value`)
    for (const token of String(initial).split(/[\s,()]+/).filter(Boolean)) {
      if (!/\d/.test(token)) continue
      assert.match(token, ABSOLUTE, `typed ${name} initial token "${token}" must be unitless or absolute`)
    }
  }
})

test('direction inventory matches the plain public API and stays within budget', () => {
  const selectors = classSelectors()
  for (const name of PUBLIC_DIRECTIONS) assert.ok(selectors.has(name), `missing .${name}`)
  for (const name of REJECTED_CLASSES) assert.equal(selectors.has(name), false, `must not emit .${name}`)
  assert.ok(selectors.size <= 150, `selector budget exceeded: ${selectors.size}`)
  assert.ok(css.length <= 55_000, `byte budget exceeded: ${css.length}`)
})

test('prebuilt dist is generated from the current default compile output', () => {
  const dist = fs.readFileSync(path.join(root, 'dist', 'tw-fade.css'), 'utf8')
  assert.equal(dist, css)
})

// Guards against a dormant retired utility name surviving in the shipped CSS.
// The REJECTED_CLASSES checks only prove the *default* compile omits a name; a
// stray @utility / @property / @keyframes / theme token for a retired name
// ("range" -> "ramp" -> "travel", and the never-shipped intermediate "reveal")
// could still ship undetected. Scan the source and prebuilt artifacts on disk.
// Scoped to the CSS files only — README/MIGRATING/CHANGELOG legitimately
// reference the old names when documenting the rename. Token-specific patterns,
// so the English nouns "reveal"/"ramp" in prose/comments are never matched.
test('shipped CSS carries no retired reveal/range/ramp token names', () => {
  const retired = [
    /fade-reveal/,
    /fade-range/,
    /fade-ramp/,
    /--fade-reveal/,
    /--fade-range/,
    /--fade-ramp/,
    /--tw-fade-reveal/,
    /--tw-fade-range/,
    /--tw-fade-ramp/,
    /tw-fade-reveal/,
    /tw-fade-range/,
    /tw-fade-ramp/,
  ]
  for (const file of ['src/tw-fade.css', 'dist/tw-fade.css']) {
    const source = fs.readFileSync(path.join(root, file), 'utf8')
    for (const pattern of retired) {
      assert.equal(pattern.test(source), false, `${file} still contains retired token ${pattern}`)
    }
  }
})

test('leading and trailing keyframes include RTL horizontal variants', () => {
  const kf = (n) => block('@keyframes ' + n)
  assert.match(kf('tw-fade-travel-t'), /from\s*\{[^}]*--tw-fade-t:\s*0/)
  assert.match(kf('tw-fade-travel-t'), /to\s*\{[^}]*--tw-fade-t:\s*1/)
  assert.match(kf('tw-fade-travel-b'), /from\s*\{[^}]*--tw-fade-b:\s*1/)
  assert.match(kf('tw-fade-travel-b'), /to\s*\{[^}]*--tw-fade-b:\s*0/)
  assert.match(kf('tw-fade-travel-l'), /from\s*\{[^}]*--tw-fade-l:\s*0/)
  assert.match(kf('tw-fade-travel-r'), /from\s*\{[^}]*--tw-fade-r:\s*1/)
  assert.match(kf('tw-fade-travel-r-leading'), /from\s*\{[^}]*--tw-fade-r:\s*0/)
  assert.match(kf('tw-fade-travel-r-leading'), /to\s*\{[^}]*--tw-fade-r:\s*1/)
  assert.match(kf('tw-fade-travel-l-trailing'), /from\s*\{[^}]*--tw-fade-l:\s*1/)
  assert.match(kf('tw-fade-travel-l-trailing'), /to\s*\{[^}]*--tw-fade-l:\s*0/)
})

test('the shared mask setup owns four physical layers and scroll animation wiring', () => {
  const shared = block(SHARED_SELECTOR)
  assert.ok(shared, 'missing shared direction block')
  assert.equal(declValue(shared, 'mask-composite'), 'intersect')
  assert.equal(declValue(shared, 'mask-repeat'), 'no-repeat')
  assert.equal(declValue(shared, 'mask-size'), '100% 100%')
  const maskImage = declValue(shared, 'mask-image')
  for (const v of MASK_VARS) assert.match(maskImage, new RegExp(`var\\(${v.replaceAll('-', '\\-')}`), `${v} in mask-image`)

  const supports = block('@supports (animation-timeline: scroll())')
  const animated = block(SHARED_SELECTOR, supports)
  assert.ok(animated, 'missing animation support block')
  assert.equal((declValue(animated, 'animation').match(/auto linear both/g) || []).length, 4)
  assert.equal((declValue(animated, 'animation-timeline').match(/var\(--tw-fade-timeline-/g) || []).length, 4)
  assert.equal((declValue(animated, 'animation-range').match(/var\(--tw-fade-animation-range-/g) || []).length, 4)
})

test('direction classes select the expected layers and central RTL routing', () => {
  const shared = block(SHARED_SELECTOR)
  assert.equal(declValue(shared, '--tw-fade-scroll-epsilon'), '0.1px')

  const top = block(TOP_SELECTOR)
  assert.equal(declValue(top, '--tw-fade-mask-t'), 'var(--tw-fade-gradient-t)')
  assert.equal(declValue(top, '--tw-fade-animation-t'), 'tw-fade-travel-t')
  assert.equal(declValue(top, '--tw-fade-timeline-t'), 'scroll(self y)')
  assert.equal(
    compact(declValue(top, '--tw-fade-animation-range-t')),
    'var(--tw-fade-scroll-epsilon) max(var(--tw-fade-scroll-epsilon), var(--tw-fade-travel-active))',
  )

  const bottom = block(BOTTOM_SELECTOR)
  assert.equal(declValue(bottom, '--tw-fade-mask-b'), 'var(--tw-fade-gradient-b)')
  assert.equal(declValue(bottom, '--tw-fade-animation-b'), 'tw-fade-travel-b')
  assert.equal(declValue(bottom, '--tw-fade-timeline-b'), 'scroll(self y)')
  assert.equal(
    compact(declValue(bottom, '--tw-fade-animation-range-b')),
    'min( calc(100% - var(--tw-fade-travel-active)), calc(100% - var(--tw-fade-scroll-epsilon)) ) calc(100% - var(--tw-fade-scroll-epsilon))',
  )

  const start = block(START_SELECTOR)
  assert.equal(declValue(start, '--tw-fade-ltr-start-layer'), 'var(--tw-fade-gradient-l)')
  assert.equal(declValue(start, '--tw-fade-rtl-start-layer'), 'var(--tw-fade-gradient-r)')
  assert.equal(declValue(start, '--tw-fade-ltr-start-animation'), 'tw-fade-travel-l')
  assert.equal(declValue(start, '--tw-fade-rtl-start-animation'), 'tw-fade-travel-r-leading')
  assert.equal(declValue(start, '--tw-fade-ltr-start-timeline'), 'scroll(self inline)')
  assert.equal(declValue(start, '--tw-fade-rtl-start-timeline'), 'scroll(self inline)')
  assert.equal(
    compact(declValue(start, '--tw-fade-ltr-start-animation-range')),
    'var(--tw-fade-scroll-epsilon) max(var(--tw-fade-scroll-epsilon), var(--tw-fade-travel-active))',
  )
  assert.equal(
    compact(declValue(start, '--tw-fade-rtl-start-animation-range')),
    'var(--tw-fade-scroll-epsilon) max(var(--tw-fade-scroll-epsilon), var(--tw-fade-travel-active))',
  )

  const end = block(END_SELECTOR)
  assert.equal(declValue(end, '--tw-fade-ltr-end-layer'), 'var(--tw-fade-gradient-r)')
  assert.equal(declValue(end, '--tw-fade-rtl-end-layer'), 'var(--tw-fade-gradient-l)')
  assert.equal(declValue(end, '--tw-fade-ltr-end-animation'), 'tw-fade-travel-r')
  assert.equal(declValue(end, '--tw-fade-rtl-end-animation'), 'tw-fade-travel-l-trailing')
  assert.equal(
    compact(declValue(end, '--tw-fade-ltr-end-animation-range')),
    'min( calc(100% - var(--tw-fade-travel-active)), calc(100% - var(--tw-fade-scroll-epsilon)) ) calc(100% - var(--tw-fade-scroll-epsilon))',
  )
  assert.equal(
    compact(declValue(end, '--tw-fade-rtl-end-animation-range')),
    'min( calc(100% - var(--tw-fade-travel-active)), calc(100% - var(--tw-fade-scroll-epsilon)) ) calc(100% - var(--tw-fade-scroll-epsilon))',
  )

  const rtl = block(RTL_SELECTOR)
  assert.ok(rtl, 'missing central RTL routing block')
  assert.equal(declValue(rtl, '--tw-fade-mask-l'), 'var(--tw-fade-rtl-end-layer, var(--tw-fade-identity-mask))')
  assert.equal(declValue(rtl, '--tw-fade-mask-r'), 'var(--tw-fade-rtl-start-layer, var(--tw-fade-identity-mask))')
  assert.equal(declValue(rtl, '--tw-fade-animation-l'), 'var(--tw-fade-rtl-end-animation, none)')
  assert.equal(declValue(rtl, '--tw-fade-animation-r'), 'var(--tw-fade-rtl-start-animation, none)')
  assert.equal(declValue(rtl, '--tw-fade-edge-size-l'), 'var(--tw-fade-size-end, var(--tw-fade-size-x, var(--tw-fade-size, var(--tw-fade-size-default))))')
  assert.equal(declValue(rtl, '--tw-fade-edge-size-r'), 'var(--tw-fade-size-start, var(--tw-fade-size-x, var(--tw-fade-size, var(--tw-fade-size-default))))')
})

test('the smoothstep ramp is the 13-stop sigmoid from the reference', () => {
  const shared = block(SHARED_SELECTOR)
  const edges = { t: '--tw-fade-gradient-t', b: '--tw-fade-gradient-b', l: '--tw-fade-gradient-l', r: '--tw-fade-gradient-r' }
  for (const [edge, prop] of Object.entries(edges)) {
    const grad = declValue(shared, prop)
    assert.ok(grad, `missing ${prop}`)
    const stops = (grad.match(/rgb\(0 0 0 \//g) || []).length
    assert.equal(stops, 13, `${prop} should have 13 colour stops`)
    const alphaMultipliers = [
      ...grad.matchAll(new RegExp(`var\\(--tw-fade-alpha-${edge}\\)\\s*\\*\\s*([0-9.]+)`, 'g')),
    ].map((m) => m[1])
    assert.deepEqual(alphaMultipliers, ALPHA_MULTIPLIERS, `${prop} alpha ramp coefficients must stay exact`)
    const positionMultipliers = [
      ...grad.matchAll(new RegExp(`var\\(--tw-fade-edge-band-${edge}\\)\\s*\\*\\s*([0-9.]+)`, 'g')),
    ].map((m) => m[1])
    assert.deepEqual(positionMultipliers, POSITION_MULTIPLIERS, `${prop} position ramp coefficients must stay exact`)
  }
  assert.match(declValue(shared, '--tw-fade-gradient-t'), /^linear-gradient\(\s*to bottom/)
  assert.match(declValue(shared, '--tw-fade-gradient-b'), /^linear-gradient\(\s*to top/)
  assert.match(declValue(shared, '--tw-fade-gradient-l'), /^linear-gradient\(\s*to right/)
  assert.match(declValue(shared, '--tw-fade-gradient-r'), /^linear-gradient\(\s*to left/)
})

test('edge alpha is decoupled from band growth so the clip is covered before the band finishes widening', () => {
  const shared = block(SHARED_SELECTOR)
  assert.ok(shared, 'missing shared block')

  // The onset constant sets how fast the edge reaches full transparency relative
  // to the travel: full coverage by travel/onset of scroll, independent of band width.
  assert.equal(declValue(shared, '--tw-fade-onset'), '8')

  for (const edge of ['t', 'b', 'l', 'r']) {
    // alpha-* is a saturated copy of raw scroll progress (clamped at 1). This is
    // what drives edge transparency, so the clip is covered almost immediately.
    assert.equal(
      declValue(shared, `--tw-fade-alpha-${edge}`),
      `min(1, calc(var(--tw-fade-${edge}) * var(--tw-fade-onset)))`,
      `--tw-fade-alpha-${edge} must saturate raw progress`,
    )
    // Band WIDTH stays keyed to raw progress, so it still eases open over the
    // full travel distance (cosmetic widening) while the edge is already covered.
    assert.equal(
      declValue(shared, `--tw-fade-edge-band-${edge}`),
      `calc(var(--tw-fade-edge-size-${edge}) * var(--tw-fade-${edge}))`,
      `band size for ${edge} must stay on raw --tw-fade-${edge}`,
    )
    const grad = declValue(shared, `--tw-fade-gradient-${edge}`)
    // Every alpha stop reads the saturated alpha var...
    assert.match(
      grad,
      new RegExp(`calc\\(1 - var\\(--tw-fade-alpha-${edge}\\)`),
      `${edge} gradient alpha must read the saturated alpha var`,
    )
    // ...and never raw progress, or the clip would re-couple to the full travel.
    assert.doesNotMatch(
      grad,
      new RegExp(`calc\\(1 - var\\(--tw-fade-${edge}\\)`),
      `${edge} gradient alpha must not key off raw --tw-fade-${edge}`,
    )
  }
})

test('static fallback pins selected fades on when scroll-driven animation is unsupported', () => {
  const fallback = block('@supports not (animation-timeline: scroll())')
  const shared = block(SHARED_SELECTOR, fallback)
  assert.ok(shared, 'missing fallback block')
  for (const amt of ['--tw-fade-t', '--tw-fade-b', '--tw-fade-l', '--tw-fade-r']) {
    assert.equal(declValue(shared, amt), '1')
  }
})

test('exposes the size and travel scales as theme-backed utilities', () => {
  for (const [name] of SCALE) {
    assert.equal(declValue(block(`.fade-size-${name}`), '--tw-fade-size'), `var(--fade-size-${name})`)
    assert.equal(declValue(block(`.fade-size-y-${name}`), '--tw-fade-size-y'), `var(--fade-size-${name})`)
    assert.equal(declValue(block(`.fade-size-x-${name}`), '--tw-fade-size-x'), `var(--fade-size-${name})`)
    assert.equal(declValue(block(`.fade-size-top-${name}`), '--tw-fade-size-top'), `var(--fade-size-${name})`)
    assert.equal(declValue(block(`.fade-size-bottom-${name}`), '--tw-fade-size-bottom'), `var(--fade-size-${name})`)
    assert.equal(declValue(block(`.fade-size-start-${name}`), '--tw-fade-size-start'), `var(--fade-size-${name})`)
    assert.equal(declValue(block(`.fade-size-end-${name}`), '--tw-fade-size-end'), `var(--fade-size-${name})`)
    assert.equal(declValue(block(`.fade-travel-${name}`), '--tw-fade-travel'), `var(--fade-travel-${name})`)
  }
  const rootBlock = block(':root, :host')
  for (const [name, units] of SCALE) {
    const expected = `calc(var(--spacing, 0.25rem) * ${units})`
    assert.equal(declValue(rootBlock, `--fade-size-${name}`), expected)
    assert.equal(declValue(rootBlock, `--fade-travel-${name}`), expected)
  }
  assert.equal(block('.fade-range-sm'), null)
  assert.equal(block('.fade-size-left-sm'), null)
})

test('size resolves as edge over axis over global over capped default', () => {
  const shared = block(SHARED_SELECTOR)
  assert.equal(declValue(shared, '--tw-fade-size-default'), 'min(12%, var(--fade-size-md, calc(var(--spacing, 0.25rem) * 12)))')
  assert.equal(
    declValue(shared, '--tw-fade-edge-size-t'),
    'var(--tw-fade-size-top, var(--tw-fade-size-y, var(--tw-fade-size, var(--tw-fade-size-default))))',
  )
  assert.equal(
    declValue(shared, '--tw-fade-edge-size-b'),
    'var(--tw-fade-size-bottom, var(--tw-fade-size-y, var(--tw-fade-size, var(--tw-fade-size-default))))',
  )
  assert.equal(
    declValue(shared, '--tw-fade-edge-size-l'),
    'var(--tw-fade-size-start, var(--tw-fade-size-x, var(--tw-fade-size, var(--tw-fade-size-default))))',
  )
  assert.equal(
    declValue(shared, '--tw-fade-edge-size-r'),
    'var(--tw-fade-size-end, var(--tw-fade-size-x, var(--tw-fade-size, var(--tw-fade-size-default))))',
  )
})

test('arbitrary size and travel utilities compile only through the source path', () => {
  assert.equal(declValue(block('.fade-size-\\[15\\%\\]', customCss), '--tw-fade-size'), '15%')
  assert.equal(declValue(block('.fade-size-top-\\[56px\\]', customCss), '--tw-fade-size-top'), '56px')
  assert.equal(declValue(block('.fade-travel-\\[80px\\]', customCss), '--tw-fade-travel'), '80px')
  assert.equal(block('.fade-size-\\[15\\%\\]'), null)
  assert.equal(block('.fade-travel-\\[80px\\]'), null)
})

test('exposes directional clear utilities and source-path integer clear values', () => {
  for (const [name] of SCALE) {
    assert.equal(declValue(block(`.fade-clear-${name}`), '--tw-fade-clear'), `var(--fade-clear-${name})`)
    assert.equal(declValue(block(`.fade-clear-y-${name}`), '--tw-fade-clear-y'), `var(--fade-clear-${name})`)
    assert.equal(declValue(block(`.fade-clear-x-${name}`), '--tw-fade-clear-x'), `var(--fade-clear-${name})`)
    assert.equal(declValue(block(`.fade-clear-top-${name}`), '--tw-fade-clear-top'), `var(--fade-clear-${name})`)
    assert.equal(declValue(block(`.fade-clear-bottom-${name}`), '--tw-fade-clear-bottom'), `var(--fade-clear-${name})`)
    assert.equal(declValue(block(`.fade-clear-start-${name}`), '--tw-fade-clear-start'), `var(--fade-clear-${name})`)
    assert.equal(declValue(block(`.fade-clear-end-${name}`), '--tw-fade-clear-end'), `var(--fade-clear-${name})`)
  }
  const expected = 'calc(var(--spacing, 0.25rem) * 14)'
  assert.equal(declValue(block('.fade-clear-14', customCss), '--tw-fade-clear'), expected)
  assert.equal(declValue(block('.fade-clear-top-14', customCss), '--tw-fade-clear-top'), expected)
  assert.equal(declValue(block('.fade-clear-start-14', customCss), '--tw-fade-clear-start'), expected)
  assert.equal(block('.fade-clear-left-sm'), null)
  assert.equal(block('.fade-clear-xy-sm'), null)
})

test('dynamic clear variables follow edge to axis to global precedence', () => {
  assert.equal(declValue(block('.fade-clear-var'), '--tw-fade-clear'), 'var(--fade-clear, 0px)')
  assert.equal(declValue(block('.fade-clear-y-var'), '--tw-fade-clear-y'), 'var(--fade-clear-y, var(--fade-clear, 0px))')
  assert.equal(declValue(block('.fade-clear-x-var'), '--tw-fade-clear-x'), 'var(--fade-clear-x, var(--fade-clear, 0px))')
  assert.equal(
    declValue(block('.fade-clear-top-var'), '--tw-fade-clear-top'),
    'var(--fade-clear-top, var(--fade-clear-y, var(--fade-clear, 0px)))',
  )
  assert.equal(
    declValue(block('.fade-clear-bottom-var'), '--tw-fade-clear-bottom'),
    'var(--fade-clear-bottom, var(--fade-clear-y, var(--fade-clear, 0px)))',
  )
  assert.equal(
    declValue(block('.fade-clear-start-var'), '--tw-fade-clear-start'),
    'var(--fade-clear-start, var(--fade-clear-x, var(--fade-clear, 0px)))',
  )
  assert.equal(
    declValue(block('.fade-clear-end-var'), '--tw-fade-clear-end'),
    'var(--fade-clear-end, var(--fade-clear-x, var(--fade-clear, 0px)))',
  )
})

test('fade-none and fade-always pin amounts without disabling shared animations', () => {
  const none = block('.fade-none')
  for (const amt of ['--tw-fade-t', '--tw-fade-b', '--tw-fade-l', '--tw-fade-r']) {
    assert.equal(declValue(none, amt), '0 !important')
  }
  const noneY = block('.fade-none-y')
  assert.equal(declValue(noneY, '--tw-fade-t'), '0 !important')
  assert.equal(declValue(noneY, '--tw-fade-b'), '0 !important')
  assert.equal(declValue(noneY, '--tw-fade-l'), undefined)

  const noneX = block('.fade-none-x')
  assert.equal(declValue(noneX, '--tw-fade-l'), '0 !important')
  assert.equal(declValue(noneX, '--tw-fade-r'), '0 !important')
  assert.equal(declValue(noneX, '--tw-fade-t'), undefined)

  const always = block('.fade-always')
  for (const amt of ['--tw-fade-t', '--tw-fade-b', '--tw-fade-l', '--tw-fade-r']) {
    assert.equal(declValue(always, amt), '1 !important')
  }
  assert.ok(!/animation-name:\s*none/.test(css), 'always utilities must not disable shared animations')
  assert.ok(css.indexOf('.fade-none') < css.indexOf('.fade-always'), 'fade-always should be the emitted source-order winner')
})

test('the framework-free build is real CSS, self-contained, with no Tailwind noise', () => {
  for (const token of ['@utility', '@theme', '@apply', '--value(']) {
    assert.ok(!css.includes(token), `compiled output must not contain ${token}`)
  }
  assert.ok(!/--tw-(?!fade-)/.test(css), 'no Tailwind core --tw-* variables should leak in')
  assert.ok(!/\.flex\s*\{|\.grid\s*\{|\.border\s*\{/.test(css), 'no built-in utilities should leak in')
})
