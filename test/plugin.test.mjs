/**
 * Unit tests for tw-fade.
 *
 *   npm test            (runs `node --test`)
 *
 * tw-fade is now a pure Tailwind v4 CSS plugin: src/tw-fade.css is the single
 * source of truth, authored with @utility / @theme / --value(). These tests
 * compile that source the same way the shipped dist is built (scripts/build-css
 * → the v4 CLI, utilities-only, isolated) and assert on the REAL emitted CSS.
 * That keeps them honest: they exercise the exact bytes a consumer's <link> gets,
 * not a hand-rolled model of what the plugin "should" produce.
 *
 * They lock in the structural invariants that make the effect correct: the
 * registered custom properties (and the @property computational-independence
 * rule that the "only large fades" bug taught us), the scroll-driven reveal
 * wiring, the multi-layer intersect-composited mask, per-edge isolation, and the
 * 13-stop smoothstep ramp. End-to-end visual behaviour is covered separately by
 * build/verify*.mjs (which drive real Chromium).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compileCss } from '../scripts/build-css.mjs'

const css = compileCss()
const integerClearCss = compileCss({
  classes: 'fade-clear-t-14 fade-clear-b-14 fade-clear-l-14 fade-clear-r-14 fade-clear-y-14 fade-clear-x-14 fade-clear-xy-14',
})

/**
 * Return the balanced-brace body of the first `<selector> {` block — including any
 * nested at-rules (@supports …). A tiny brace scanner beats a regex here because
 * the utility blocks legitimately nest braces.
 */
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

/** Parse an @property registration into { syntax, inherits, initial-value }. */
function property(name) {
  const body = block('@property ' + name)
  if (body == null) return null
  const field = (k) => {
    const m = body.match(new RegExp(`${k}:\\s*([^;]+);`))
    return m ? m[1].trim() : undefined
  }
  return { syntax: field('syntax'), inherits: field('inherits'), 'initial-value': field('initial-value') }
}

/** The value of a single declaration `prop: …;` within a block body. */
function declValue(body, prop) {
  const m = body.match(new RegExp(`${prop}:\\s*([^;]+);`))
  return m ? m[1].trim() : undefined
}

const EDGES = { '.fade-t': 't', '.fade-b': 'b', '.fade-l': 'l', '.fade-r': 'r' }
const ALL = ['.fade-t', '.fade-b', '.fade-l', '.fade-r', '.fade-y', '.fade-x', '.fade-xy']
const MASK_VARS = ['--tw-fade-mask-t', '--tw-fade-mask-b', '--tw-fade-mask-l', '--tw-fade-mask-r']
const SIZE_VARS = ['--tw-fade-size', '--tw-fade-size-y', '--tw-fade-size-x', '--tw-fade-size-t', '--tw-fade-size-b', '--tw-fade-size-l', '--tw-fade-size-r']
const CLEAR_VARS = ['--tw-fade-clear-t', '--tw-fade-clear-b', '--tw-fade-clear-l', '--tw-fade-clear-r']
const SHARED_DEFAULTS_SELECTOR = '.fade-t, .fade-b, .fade-l, .fade-r, .fade-y, .fade-x, .fade-xy'
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
const DEFAULT_SIZE_DECL = 'var(--fade-size-md, calc(var(--spacing, 0.25rem) * 12))'
const DEFAULT_RANGE_DECL = 'var(--fade-range-md, calc(var(--spacing, 0.25rem) * 12))'
const RANGE_ACTIVE_DECL = `var(--tw-fade-range, ${DEFAULT_RANGE_DECL})`
const EDGE_SIZE_DECLS = {
  t: 'var(--tw-fade-size-t, var(--tw-fade-size-y, var(--tw-fade-size, var(--tw-fade-size-default))))',
  b: 'var(--tw-fade-size-b, var(--tw-fade-size-y, var(--tw-fade-size, var(--tw-fade-size-default))))',
  l: 'var(--tw-fade-size-l, var(--tw-fade-size-x, var(--tw-fade-size, var(--tw-fade-size-default))))',
  r: 'var(--tw-fade-size-r, var(--tw-fade-size-x, var(--tw-fade-size, var(--tw-fade-size-default))))',
}
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

test('registers the amounts as typed <number> and config/mask layers as universal, non-inheriting', () => {
  for (const amt of ['--tw-fade-t', '--tw-fade-b', '--tw-fade-l', '--tw-fade-r']) {
    const prop = property(amt)
    assert.ok(prop, `missing @property ${amt}`)
    // A typed <number> (not `*`) is what lets scroll-driven animation interpolate
    // the amount SMOOTHLY instead of snapping between keyframes.
    assert.equal(prop.syntax, '"<number>"')
    assert.equal(prop.inherits, 'false')
    // Initial 0 = no fade: the correct base state when the timeline is inactive.
    assert.equal(prop['initial-value'], '0')
  }
  // --tw-fade-size* / --tw-fade-range / --tw-fade-clear-* / --tw-fade-mask-* ARE registered, but with the UNIVERSAL
  // syntax and NO initial-value. A typed <length> @property would reject the
  // font-relative (rem) default and silently drop the registration — the "only
  // large fades" bug. The universal syntax sidesteps that rule; the omitted
  // initial-value keeps an unset value guaranteed-invalid, so `var(--tw-fade-size,
  // <rem>)` still falls back to the default. The point of registering at all is
  // `inherits: false`, which stops a nested fade from leaking its parent's
  // size/range/clearance or mask layers.
  for (const v of [...SIZE_VARS, '--tw-fade-range', ...CLEAR_VARS, ...MASK_VARS]) {
    const prop = property(v)
    assert.ok(prop, `missing @property ${v}`)
    assert.equal(prop.syntax, '"*"')
    assert.equal(prop.inherits, 'false')
    assert.equal(prop['initial-value'], undefined)
  }
})

test('every typed @property has a computationally-independent initial-value', () => {
  // Regression guard for the "only the large panel fades" bug: a registered
  // @property with a TYPED syntax (e.g. <length>) whose initial-value uses a
  // context-relative unit (rem/em/%/vh/cqw/lh/…) is REJECTED by the browser,
  // leaving the variable unset. We assert the REAL invariant — typed syntax pairs
  // with an independent initial — via an ABSOLUTE-unit allowlist (case-
  // insensitive, future-proof against new relative units). The universal syntax
  // (`*`) carries no such rule and legitimately omits initial-value, so it's exempt.
  const ABSOLUTE = /^-?(?:\d+\.?\d*|\.\d+)(px|cm|mm|in|pt|pc|q)?$/i
  const names = [...css.matchAll(/@property\s+(--[\w-]+)\s*\{/g)].map((m) => m[1])
  assert.ok(names.length >= 10, 'expected at least 10 registered properties')
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

test('leading edges reveal 0→1, trailing edges hide 1→0', () => {
  const kf = (n) => block('@keyframes ' + n)
  assert.match(kf('tw-fade-reveal-t'), /from\s*\{[^}]*--tw-fade-t:\s*0/)
  assert.match(kf('tw-fade-reveal-t'), /to\s*\{[^}]*--tw-fade-t:\s*1/)
  assert.match(kf('tw-fade-reveal-b'), /from\s*\{[^}]*--tw-fade-b:\s*1/)
  assert.match(kf('tw-fade-reveal-b'), /to\s*\{[^}]*--tw-fade-b:\s*0/)
  assert.match(kf('tw-fade-reveal-l'), /from\s*\{[^}]*--tw-fade-l:\s*0/)
  assert.match(kf('tw-fade-reveal-r'), /from\s*\{[^}]*--tw-fade-r:\s*1/)
})

test('every edge utility carries the composited multi-layer mask base', () => {
  for (const cls of ALL) {
    const u = block(cls)
    assert.ok(u, `missing ${cls}`)
    // intersect is mandatory: the initial `add` (union) would erase the fade.
    assert.equal(declValue(u, 'mask-composite'), 'intersect')
    assert.equal(declValue(u, 'mask-repeat'), 'no-repeat')
    assert.equal(declValue(u, 'mask-size'), '100% 100%')
    // Four layers, each defaulting to the opaque identity (no-op) gradient.
    const layers = u.split('linear-gradient(#000, #000)').length - 1
    assert.equal(layers, 4, `${cls} should have 4 identity fallbacks`)
  }
})

test('each directional utility sets ONLY its own mask layer', () => {
  for (const [cls, edge] of Object.entries(EDGES)) {
    const u = block(cls)
    const mine = `--tw-fade-mask-${edge}`
    for (const v of MASK_VARS) {
      // A real declaration is `--tw-fade-mask-x: …`; a var() reference is `--tw-fade-mask-x, …`.
      // Matching the colon distinguishes the two, so the shared 4-layer fallback
      // (which references all four) doesn't read as "this utility sets all four".
      if (v === mine) assert.ok(declValue(u, v), `${cls} must set ${v}`)
      else assert.equal(declValue(u, v), undefined, `${cls} must NOT set ${v}`)
    }
  }
})

test('axis shorthands set exactly their constituent mask layers', () => {
  const y = block('.fade-y')
  assert.ok(declValue(y, '--tw-fade-mask-t') && declValue(y, '--tw-fade-mask-b'))
  assert.equal(declValue(y, '--tw-fade-mask-l'), undefined)
  const x = block('.fade-x')
  assert.ok(declValue(x, '--tw-fade-mask-l') && declValue(x, '--tw-fade-mask-r'))
  assert.equal(declValue(x, '--tw-fade-mask-t'), undefined)
  const xy = block('.fade-xy')
  for (const v of MASK_VARS) assert.ok(declValue(xy, v), `xy must set ${v}`)
})

test('mask gradients point the right way and are driven by their amount', () => {
  assert.match(declValue(block('.fade-t'), '--tw-fade-mask-t'), /^linear-gradient\(\s*to bottom/)
  assert.match(declValue(block('.fade-b'), '--tw-fade-mask-b'), /^linear-gradient\(\s*to top/)
  assert.match(declValue(block('.fade-l'), '--tw-fade-mask-l'), /^linear-gradient\(\s*to right/)
  assert.match(declValue(block('.fade-r'), '--tw-fade-mask-r'), /^linear-gradient\(\s*to left/)
  // The amount scales both the gradient alpha (1 - amount * …) and its length
  // (size * amount), so at amount 0 the layer collapses to fully opaque.
  const tBlock = block('.fade-t')
  const t = declValue(tBlock, '--tw-fade-mask-t')
  assert.match(t, /calc\(1 - var\(--tw-fade-t\)\)/)
  // Size is resolved through a shared default alias, then multiplied by the
  // scroll-gated amount. This keeps the gradient readable without weakening the
  // "no size utility still fades" invariant.
  assert.equal(declValue(block(SHARED_DEFAULTS_SELECTOR), '--tw-fade-size-default'), DEFAULT_SIZE_DECL)
  assert.equal(declValue(tBlock, '--tw-fade-edge-size-t'), EDGE_SIZE_DECLS.t)
  assert.equal(declValue(tBlock, '--tw-fade-edge-band-t'), 'calc(var(--tw-fade-edge-size-t) * var(--tw-fade-t))')
  // Clearance is an opaque edge band before the fade ramp. This lets sticky
  // headers/footers stay unmasked while rows beneath still dissolve at the edge.
  assert.equal(declValue(tBlock, '--tw-fade-edge-clear-t'), 'var(--tw-fade-clear-t, 0px)')
  assert.match(t, /#000 0 var\(--tw-fade-edge-clear-t\)/)
  assert.match(t, /rgb\(0 0 0 \/ calc\(1 - var\(--tw-fade-t\)\)\) var\(--tw-fade-edge-clear-t\)/)
})

test('the smoothstep ramp is the 13-stop sigmoid from the reference', () => {
  for (const [cls, edge] of Object.entries(EDGES)) {
    const grad = declValue(block(cls), `--tw-fade-mask-${edge}`)
    const stops = (grad.match(/rgb\(0 0 0 \//g) || []).length
    assert.equal(stops, 13, `${cls} gradient should have 13 colour stops`)
    const alphaMultipliers = [
      ...grad.matchAll(new RegExp(`var\\(--tw-fade-${edge}\\)\\s*\\*\\s*([0-9.]+)`, 'g')),
    ].map((m) => m[1])
    assert.deepEqual(alphaMultipliers, ALPHA_MULTIPLIERS, `${cls} alpha ramp coefficients must stay exact`)
    const positionMultipliers = [
      ...grad.matchAll(new RegExp(`var\\(--tw-fade-edge-band-${edge}\\)\\s*\\*\\s*([0-9.]+)`, 'g')),
    ].map((m) => m[1])
    assert.deepEqual(positionMultipliers, POSITION_MULTIPLIERS, `${cls} position ramp coefficients must stay exact`)
  }
  // The curve endpoints: first stop fully transparent-capable (1 - amount), last
  // stop fully opaque (rgb(0 0 0 / 1)) at the band's far edge, offset after any
  // sticky-item clearance band.
  const t = declValue(block('.fade-t'), '--tw-fade-mask-t')
  assert.match(t, /rgb\(0 0 0 \/ calc\(1 - var\(--tw-fade-t\)\)\) var\(--tw-fade-edge-clear-t\),/)
  assert.match(
    t,
    new RegExp(String.raw`rgb\(0 0 0 \/ 1\) calc\(var\(--tw-fade-edge-clear-t\) \+ var\(--tw-fade-edge-band-t\)\)\s*\)\s*$`),
  )
})

test('every public fade utility uses the shared four-edge reveal setup', () => {
  // Public utilities need the same animation shorthand/longhands so arbitrary
  // combinations like `fade-t fade-r` compose instead of last-declaration-wins.
  // Physical axes (scroll(self y) / scroll(self x)) match the mask gradients.
  const defaults = block(SHARED_DEFAULTS_SELECTOR)
  assert.equal(declValue(defaults, '--tw-fade-range-active'), RANGE_ACTIVE_DECL)
  assert.ok(!css.includes('--tw-fade-range-default'), 'range default should be folded into --tw-fade-range-active')
  for (const cls of ALL) {
    const u = block(cls)
    const s = block('@supports (animation-timeline: scroll())', block(cls))
    assert.ok(s, `${cls} must include the scroll-timeline support block`)
    assert.equal(declValue(s, 'animation').split(',').length, 4, `${cls} must animate all four amounts`)
    assert.match(s, /animation-timeline:\s*scroll\(self y\), scroll\(self y\), scroll\(self x\), scroll\(self x\)/)
    // Leading reveals over the first range; trailing hides over the last. Range
    // is resolved once by the shared defaults rule (same fix as --tw-fade-size).
    assert.equal(declValue(u, '--tw-fade-range-active'), undefined)
    assert.match(
      s,
      new RegExp(
        String.raw`animation-range:\s*0 var\(--tw-fade-range-active\), calc\(100% - var\(--tw-fade-range-active\)\) 100%, 0 var\(--tw-fade-range-active\), calc\(100% - var\(--tw-fade-range-active\)\) 100%`,
      ),
    )
  }
})

test('provides a static fallback when scroll-driven animation is unsupported', () => {
  for (const cls of ALL) {
    const fb = block('@supports not (animation-timeline: scroll())', block(cls))
    assert.ok(fb, `${cls} must include the static fallback block`)
    for (const amt of ['--tw-fade-t', '--tw-fade-b', '--tw-fade-l', '--tw-fade-r']) {
      assert.equal(declValue(fb, amt), '1', `${cls} fallback must pin ${amt}`)
    }
  }
})

test('fade-static forces the fade on, order-independently, and disables the animation', () => {
  const s = block('.fade-static')
  // The amounts are pinned with !important so fade-static wins regardless of where
  // Tailwind sorts it relative to the reveal animation — an important author value
  // outranks a running keyframe animation in the cascade.
  for (const amt of ['--tw-fade-t', '--tw-fade-b', '--tw-fade-l', '--tw-fade-r']) {
    assert.equal(declValue(s, amt), '1 !important', `${amt} must be pinned !important`)
  }
  assert.equal(declValue(s, 'animation-name'), 'none')
})

test('exposes the size and range scales as theme-backed utilities', () => {
  for (const [name] of SCALE) {
    assert.equal(declValue(block(`.fade-size-${name}`), '--tw-fade-size'), `var(--fade-size-${name})`)
    assert.equal(declValue(block(`.fade-size-t-${name}`), '--tw-fade-size-t'), `var(--fade-size-${name})`)
    assert.equal(declValue(block(`.fade-size-b-${name}`), '--tw-fade-size-b'), `var(--fade-size-${name})`)
    assert.equal(declValue(block(`.fade-size-l-${name}`), '--tw-fade-size-l'), `var(--fade-size-${name})`)
    assert.equal(declValue(block(`.fade-size-r-${name}`), '--tw-fade-size-r'), `var(--fade-size-${name})`)
    assert.equal(declValue(block(`.fade-size-y-${name}`), '--tw-fade-size-y'), `var(--fade-size-${name})`)
    assert.equal(declValue(block(`.fade-size-x-${name}`), '--tw-fade-size-x'), `var(--fade-size-${name})`)
    assert.equal(declValue(block(`.fade-range-${name}`), '--tw-fade-range'), `var(--fade-range-${name})`)
  }
  // The theme exposes the actual scale values for consumers to override/extend.
  const root = block(':root, :host')
  for (const [name, units] of SCALE) {
    const expected = `calc(var(--spacing, 0.25rem) * ${units})`
    assert.equal(declValue(root, `--fade-size-${name}`), expected)
    assert.equal(declValue(root, `--fade-range-${name}`), expected)
  }
  // No bare `.fade-size` / `.fade-range` no-op utility leaks out.
  assert.equal(block('.fade-size'), null)
  assert.equal(block('.fade-range'), null)
})

test('each edge resolves size as edge over axis over global over default', () => {
  const defaults = block(SHARED_DEFAULTS_SELECTOR)
  assert.equal(declValue(defaults, '--tw-fade-size-default'), DEFAULT_SIZE_DECL)
  for (const [cls, edge] of Object.entries(EDGES)) {
    const u = block(cls)
    assert.equal(declValue(u, '--tw-fade-size-default'), undefined)
    assert.equal(declValue(u, `--tw-fade-edge-size-${edge}`), EDGE_SIZE_DECLS[edge])
    assert.equal(declValue(u, `--tw-fade-edge-band-${edge}`), `calc(var(--tw-fade-edge-size-${edge}) * var(--tw-fade-${edge}))`)
  }
})

test('exposes edge-clearance utilities for sticky content', () => {
  for (const [name] of SCALE) {
    assert.equal(declValue(block(`.fade-clear-t-${name}`), '--tw-fade-clear-t'), `var(--fade-clear-${name})`)
    assert.equal(declValue(block(`.fade-clear-b-${name}`), '--tw-fade-clear-b'), `var(--fade-clear-${name})`)
    assert.equal(declValue(block(`.fade-clear-l-${name}`), '--tw-fade-clear-l'), `var(--fade-clear-${name})`)
    assert.equal(declValue(block(`.fade-clear-r-${name}`), '--tw-fade-clear-r'), `var(--fade-clear-${name})`)

    const y = block(`.fade-clear-y-${name}`)
    assert.equal(declValue(y, '--tw-fade-clear-t'), `var(--fade-clear-${name})`)
    assert.equal(declValue(y, '--tw-fade-clear-b'), `var(--fade-clear-${name})`)
    assert.equal(declValue(y, '--tw-fade-clear-l'), undefined)

    const x = block(`.fade-clear-x-${name}`)
    assert.equal(declValue(x, '--tw-fade-clear-l'), `var(--fade-clear-${name})`)
    assert.equal(declValue(x, '--tw-fade-clear-r'), `var(--fade-clear-${name})`)
    assert.equal(declValue(x, '--tw-fade-clear-t'), undefined)

    const xy = block(`.fade-clear-xy-${name}`)
    for (const v of CLEAR_VARS) assert.equal(declValue(xy, v), `var(--fade-clear-${name})`, `xy must set ${v}`)
  }

  const root = block(':root, :host')
  for (const [name, units] of SCALE) {
    assert.equal(declValue(root, `--fade-clear-${name}`), `calc(var(--spacing, 0.25rem) * ${units})`)
  }
  assert.equal(block('.fade-clear'), null)
})

test('supports integer spacing values for edge clearance in the Tailwind source path', () => {
  const expected = 'calc(var(--spacing, 0.25rem) * 14)'
  assert.equal(declValue(block('.fade-clear-t-14', integerClearCss), '--tw-fade-clear-t'), expected)
  assert.equal(declValue(block('.fade-clear-b-14', integerClearCss), '--tw-fade-clear-b'), expected)
  assert.equal(declValue(block('.fade-clear-l-14', integerClearCss), '--tw-fade-clear-l'), expected)
  assert.equal(declValue(block('.fade-clear-r-14', integerClearCss), '--tw-fade-clear-r'), expected)

  const y = block('.fade-clear-y-14', integerClearCss)
  assert.equal(declValue(y, '--tw-fade-clear-t'), expected)
  assert.equal(declValue(y, '--tw-fade-clear-b'), expected)
  assert.equal(declValue(y, '--tw-fade-clear-l'), undefined)

  const x = block('.fade-clear-x-14', integerClearCss)
  assert.equal(declValue(x, '--tw-fade-clear-l'), expected)
  assert.equal(declValue(x, '--tw-fade-clear-r'), expected)
  assert.equal(declValue(x, '--tw-fade-clear-t'), undefined)

  const xy = block('.fade-clear-xy-14', integerClearCss)
  for (const v of CLEAR_VARS) assert.equal(declValue(xy, v), expected, `integer xy must set ${v}`)
})

test('exposes public variable utilities for dynamic edge clearance', () => {
  assert.equal(
    declValue(block('.fade-clear-t-var'), '--tw-fade-clear-t'),
    'var(--fade-clear-t, var(--fade-clear-y, var(--fade-clear-xy, 0px)))',
  )
  assert.equal(
    declValue(block('.fade-clear-b-var'), '--tw-fade-clear-b'),
    'var(--fade-clear-b, var(--fade-clear-y, var(--fade-clear-xy, 0px)))',
  )
  assert.equal(
    declValue(block('.fade-clear-l-var'), '--tw-fade-clear-l'),
    'var(--fade-clear-l, var(--fade-clear-x, var(--fade-clear-xy, 0px)))',
  )
  assert.equal(
    declValue(block('.fade-clear-r-var'), '--tw-fade-clear-r'),
    'var(--fade-clear-r, var(--fade-clear-x, var(--fade-clear-xy, 0px)))',
  )

  const y = block('.fade-clear-y-var')
  assert.equal(
    declValue(y, '--tw-fade-clear-t'),
    'var(--fade-clear-t, var(--fade-clear-y, var(--fade-clear-xy, 0px)))',
  )
  assert.equal(
    declValue(y, '--tw-fade-clear-b'),
    'var(--fade-clear-b, var(--fade-clear-y, var(--fade-clear-xy, 0px)))',
  )
  assert.equal(declValue(y, '--tw-fade-clear-l'), undefined)

  const x = block('.fade-clear-x-var')
  assert.equal(
    declValue(x, '--tw-fade-clear-l'),
    'var(--fade-clear-l, var(--fade-clear-x, var(--fade-clear-xy, 0px)))',
  )
  assert.equal(
    declValue(x, '--tw-fade-clear-r'),
    'var(--fade-clear-r, var(--fade-clear-x, var(--fade-clear-xy, 0px)))',
  )
  assert.equal(declValue(x, '--tw-fade-clear-t'), undefined)

  const xy = block('.fade-clear-xy-var')
  assert.equal(
    declValue(xy, '--tw-fade-clear-t'),
    'var(--fade-clear-t, var(--fade-clear-y, var(--fade-clear-xy, 0px)))',
  )
  assert.equal(
    declValue(xy, '--tw-fade-clear-b'),
    'var(--fade-clear-b, var(--fade-clear-y, var(--fade-clear-xy, 0px)))',
  )
  assert.equal(
    declValue(xy, '--tw-fade-clear-l'),
    'var(--fade-clear-l, var(--fade-clear-x, var(--fade-clear-xy, 0px)))',
  )
  assert.equal(
    declValue(xy, '--tw-fade-clear-r'),
    'var(--fade-clear-r, var(--fade-clear-x, var(--fade-clear-xy, 0px)))',
  )
})

test('the framework-free build is real CSS, self-contained, with no Tailwind noise', () => {
  // Source-only constructs must be fully compiled away.
  for (const token of ['@utility', '@theme', '@apply', '--value(']) {
    assert.ok(!css.includes(token), `compiled output must not contain ${token}`)
  }
  // No Preflight / theme-dump leakage from the utilities-only, isolated build.
  // Our own internal namespace is --tw-fade-*; any OTHER --tw-* would be Tailwind
  // core noise, so exclude our prefix from the leak check.
  assert.ok(!/--tw-(?!fade-)/.test(css), 'no Tailwind core --tw-* variables should leak in')
  assert.ok(!/\.flex\s*\{|\.grid\s*\{|\.border\s*\{/.test(css), 'no built-in utilities should leak in')
  assert.equal(block('.tw-fade-mask'), null, 'private tw-fade-mask utility should not be emitted as a public class')
})
