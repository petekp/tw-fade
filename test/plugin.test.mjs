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
const MASK_VARS = ['--sf-mask-t', '--sf-mask-b', '--sf-mask-l', '--sf-mask-r']
const CLEAR_VARS = ['--sf-clear-t', '--sf-clear-b', '--sf-clear-l', '--sf-clear-r']
const RAMP_MULTIPLIERS = [
  '0.983',
  '0.08333',
  '0.933',
  '0.16667',
  '0.854',
  '0.25',
  '0.75',
  '0.33333',
  '0.629',
  '0.41667',
  '0.5',
  '0.5',
  '0.371',
  '0.58333',
  '0.25',
  '0.66667',
  '0.146',
  '0.75',
  '0.067',
  '0.83333',
  '0.017',
  '0.91667',
]

test('registers the amounts as typed <number> and config/mask layers as universal, non-inheriting', () => {
  for (const amt of ['--sf-t', '--sf-b', '--sf-l', '--sf-r']) {
    const prop = property(amt)
    assert.ok(prop, `missing @property ${amt}`)
    // A typed <number> (not `*`) is what lets scroll-driven animation interpolate
    // the amount SMOOTHLY instead of snapping between keyframes.
    assert.equal(prop.syntax, '"<number>"')
    assert.equal(prop.inherits, 'false')
    // Initial 0 = no fade: the correct base state when the timeline is inactive.
    assert.equal(prop['initial-value'], '0')
  }
  // --sf-size / --sf-range / --sf-clear-* / --sf-mask-* ARE registered, but with the UNIVERSAL
  // syntax and NO initial-value. A typed <length> @property would reject the
  // font-relative (rem) default and silently drop the registration — the "only
  // large fades" bug. The universal syntax sidesteps that rule; the omitted
  // initial-value keeps an unset value guaranteed-invalid, so `var(--sf-size,
  // <rem>)` still falls back to the default. The point of registering at all is
  // `inherits: false`, which stops a nested fade from leaking its parent's
  // size/range/clearance or mask layers.
  for (const v of ['--sf-size', '--sf-range', ...CLEAR_VARS, ...MASK_VARS]) {
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
  assert.match(kf('sf-reveal-t'), /from\s*\{[^}]*--sf-t:\s*0/)
  assert.match(kf('sf-reveal-t'), /to\s*\{[^}]*--sf-t:\s*1/)
  assert.match(kf('sf-reveal-b'), /from\s*\{[^}]*--sf-b:\s*1/)
  assert.match(kf('sf-reveal-b'), /to\s*\{[^}]*--sf-b:\s*0/)
  assert.match(kf('sf-reveal-l'), /from\s*\{[^}]*--sf-l:\s*0/)
  assert.match(kf('sf-reveal-r'), /from\s*\{[^}]*--sf-r:\s*1/)
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
    const mine = `--sf-mask-${edge}`
    for (const v of MASK_VARS) {
      // A real declaration is `--sf-mask-x: …`; a var() reference is `--sf-mask-x, …`.
      // Matching the colon distinguishes the two, so the shared 4-layer fallback
      // (which references all four) doesn't read as "this utility sets all four".
      if (v === mine) assert.ok(declValue(u, v), `${cls} must set ${v}`)
      else assert.equal(declValue(u, v), undefined, `${cls} must NOT set ${v}`)
    }
  }
})

test('axis shorthands set exactly their constituent mask layers', () => {
  const y = block('.fade-y')
  assert.ok(declValue(y, '--sf-mask-t') && declValue(y, '--sf-mask-b'))
  assert.equal(declValue(y, '--sf-mask-l'), undefined)
  const x = block('.fade-x')
  assert.ok(declValue(x, '--sf-mask-l') && declValue(x, '--sf-mask-r'))
  assert.equal(declValue(x, '--sf-mask-t'), undefined)
  const xy = block('.fade-xy')
  for (const v of MASK_VARS) assert.ok(declValue(xy, v), `xy must set ${v}`)
})

test('mask gradients point the right way and are driven by their amount', () => {
  assert.match(declValue(block('.fade-t'), '--sf-mask-t'), /^linear-gradient\(\s*to bottom/)
  assert.match(declValue(block('.fade-b'), '--sf-mask-b'), /^linear-gradient\(\s*to top/)
  assert.match(declValue(block('.fade-l'), '--sf-mask-l'), /^linear-gradient\(\s*to right/)
  assert.match(declValue(block('.fade-r'), '--sf-mask-r'), /^linear-gradient\(\s*to left/)
  // The amount scales both the gradient alpha (1 - amount * …) and its length
  // (size * amount), so at amount 0 the layer collapses to fully opaque.
  const t = declValue(block('.fade-t'), '--sf-mask-t')
  assert.match(t, /calc\(1 - var\(--sf-t\)\)/)
  // Size is read with a fallback default (the md scale) so a panel WITHOUT a
  // fade-size-* utility still gets a real band — the bug was an unset --sf-size.
  assert.match(t, /var\(--sf-size, 3\.125rem\) \* var\(--sf-t\)/)
  // Clearance is an opaque edge band before the fade ramp. This lets sticky
  // headers/footers stay unmasked while rows beneath still dissolve at the edge.
  assert.match(t, /#000 0 var\(--sf-clear-t, 0px\)/)
  assert.match(t, /rgb\(0 0 0 \/ calc\(1 - var\(--sf-t\)\)\) var\(--sf-clear-t, 0px\)/)
})

test('the smoothstep ramp is the 13-stop sigmoid from the reference', () => {
  for (const [cls, edge] of Object.entries(EDGES)) {
    const grad = declValue(block(cls), `--sf-mask-${edge}`)
    const stops = (grad.match(/rgb\(0 0 0 \//g) || []).length
    assert.equal(stops, 13, `${cls} gradient should have 13 colour stops`)
    const multipliers = [
      ...grad.matchAll(new RegExp(`var\\(--sf-${edge}\\)\\s*\\*\\s*([0-9.]+)`, 'g')),
    ].map((m) => m[1])
    assert.deepEqual(multipliers, RAMP_MULTIPLIERS, `${cls} ramp coefficients must stay exact`)
  }
  // The curve endpoints: first stop fully transparent-capable (1 - amount), last
  // stop fully opaque (rgb(0 0 0 / 1)) at the band's far edge, offset after any
  // sticky-item clearance band.
  const t = declValue(block('.fade-t'), '--sf-mask-t')
  assert.match(t, /rgb\(0 0 0 \/ calc\(1 - var\(--sf-t\)\)\) var\(--sf-clear-t, 0px\),/)
  assert.match(t, /rgb\(0 0 0 \/ 1\) calc\(var\(--sf-clear-t, 0px\) \+ var\(--sf-size, 3\.125rem\) \* var\(--sf-t\)\)\s*\)\s*$/)
})

test('every public fade utility uses the shared four-edge reveal setup', () => {
  // Public utilities need the same animation shorthand/longhands so arbitrary
  // combinations like `fade-t fade-r` compose instead of last-declaration-wins.
  // Physical axes (scroll(self y) / scroll(self x)) match the mask gradients.
  for (const cls of ALL) {
    const s = block('@supports (animation-timeline: scroll())', block(cls))
    assert.ok(s, `${cls} must include the scroll-timeline support block`)
    assert.equal(declValue(s, 'animation').split(',').length, 4, `${cls} must animate all four amounts`)
    assert.match(s, /animation-timeline:\s*scroll\(self y\), scroll\(self y\), scroll\(self x\), scroll\(self x\)/)
    // Leading reveals over the first range; trailing hides over the last. Range is
    // read with a fallback default (same fix as --sf-size).
    assert.match(
      s,
      /animation-range:\s*0 var\(--sf-range, 50px\), calc\(100% - var\(--sf-range, 50px\)\) 100%, 0 var\(--sf-range, 50px\), calc\(100% - var\(--sf-range, 50px\)\) 100%/,
    )
  }
})

test('provides a static fallback when scroll-driven animation is unsupported', () => {
  for (const cls of ALL) {
    const fb = block('@supports not (animation-timeline: scroll())', block(cls))
    assert.ok(fb, `${cls} must include the static fallback block`)
    for (const amt of ['--sf-t', '--sf-b', '--sf-l', '--sf-r']) {
      assert.equal(declValue(fb, amt), '1', `${cls} fallback must pin ${amt}`)
    }
  }
})

test('fade-static forces the fade on, order-independently, and disables the animation', () => {
  const s = block('.fade-static')
  // The amounts are pinned with !important so fade-static wins regardless of where
  // Tailwind sorts it relative to the reveal animation — an important author value
  // outranks a running keyframe animation in the cascade.
  for (const amt of ['--sf-t', '--sf-b', '--sf-l', '--sf-r']) {
    assert.equal(declValue(s, amt), '1 !important', `${amt} must be pinned !important`)
  }
  assert.equal(declValue(s, 'animation-name'), 'none')
})

test('exposes the size and range scales as theme-backed utilities', () => {
  assert.equal(declValue(block('.fade-size-sm'), '--sf-size'), 'var(--fade-size-sm)')
  assert.equal(declValue(block('.fade-size-lg'), '--sf-size'), 'var(--fade-size-lg)')
  assert.equal(declValue(block('.fade-range-lg'), '--sf-range'), 'var(--fade-range-lg)')
  // The theme exposes the actual scale values for consumers to override/extend.
  const root = block(':root, :host')
  assert.equal(declValue(root, '--fade-size-sm'), '2.5rem')
  assert.equal(declValue(root, '--fade-size-lg'), '4.375rem')
  assert.equal(declValue(root, '--fade-range-lg'), '96px')
  // No bare `.fade-size` / `.fade-range` no-op utility leaks out.
  assert.equal(block('.fade-size'), null)
  assert.equal(block('.fade-range'), null)
})

test('exposes edge-clearance utilities for sticky content', () => {
  assert.equal(declValue(block('.fade-clear-t-sm'), '--sf-clear-t'), 'var(--fade-clear-sm)')
  assert.equal(declValue(block('.fade-clear-b-md'), '--sf-clear-b'), 'var(--fade-clear-md)')
  assert.equal(declValue(block('.fade-clear-l-lg'), '--sf-clear-l'), 'var(--fade-clear-lg)')
  assert.equal(declValue(block('.fade-clear-r-sm'), '--sf-clear-r'), 'var(--fade-clear-sm)')

  const y = block('.fade-clear-y-md')
  assert.equal(declValue(y, '--sf-clear-t'), 'var(--fade-clear-md)')
  assert.equal(declValue(y, '--sf-clear-b'), 'var(--fade-clear-md)')
  assert.equal(declValue(y, '--sf-clear-l'), undefined)

  const x = block('.fade-clear-x-lg')
  assert.equal(declValue(x, '--sf-clear-l'), 'var(--fade-clear-lg)')
  assert.equal(declValue(x, '--sf-clear-r'), 'var(--fade-clear-lg)')
  assert.equal(declValue(x, '--sf-clear-t'), undefined)

  const xy = block('.fade-clear-xy-sm')
  for (const v of CLEAR_VARS) assert.equal(declValue(xy, v), 'var(--fade-clear-sm)', `xy must set ${v}`)

  const root = block(':root, :host')
  assert.equal(declValue(root, '--fade-clear-sm'), '1.5rem')
  assert.equal(declValue(root, '--fade-clear-md'), '2rem')
  assert.equal(declValue(root, '--fade-clear-lg'), '3rem')
  assert.equal(block('.fade-clear'), null)
})

test('exposes public variable utilities for dynamic edge clearance', () => {
  assert.equal(
    declValue(block('.fade-clear-t-var'), '--sf-clear-t'),
    'var(--fade-clear-t, var(--fade-clear-y, var(--fade-clear-xy, 0px)))',
  )
  assert.equal(
    declValue(block('.fade-clear-b-var'), '--sf-clear-b'),
    'var(--fade-clear-b, var(--fade-clear-y, var(--fade-clear-xy, 0px)))',
  )
  assert.equal(
    declValue(block('.fade-clear-l-var'), '--sf-clear-l'),
    'var(--fade-clear-l, var(--fade-clear-x, var(--fade-clear-xy, 0px)))',
  )
  assert.equal(
    declValue(block('.fade-clear-r-var'), '--sf-clear-r'),
    'var(--fade-clear-r, var(--fade-clear-x, var(--fade-clear-xy, 0px)))',
  )

  const y = block('.fade-clear-y-var')
  assert.equal(
    declValue(y, '--sf-clear-t'),
    'var(--fade-clear-t, var(--fade-clear-y, var(--fade-clear-xy, 0px)))',
  )
  assert.equal(
    declValue(y, '--sf-clear-b'),
    'var(--fade-clear-b, var(--fade-clear-y, var(--fade-clear-xy, 0px)))',
  )
  assert.equal(declValue(y, '--sf-clear-l'), undefined)

  const x = block('.fade-clear-x-var')
  assert.equal(
    declValue(x, '--sf-clear-l'),
    'var(--fade-clear-l, var(--fade-clear-x, var(--fade-clear-xy, 0px)))',
  )
  assert.equal(
    declValue(x, '--sf-clear-r'),
    'var(--fade-clear-r, var(--fade-clear-x, var(--fade-clear-xy, 0px)))',
  )
  assert.equal(declValue(x, '--sf-clear-t'), undefined)

  const xy = block('.fade-clear-xy-var')
  assert.equal(
    declValue(xy, '--sf-clear-t'),
    'var(--fade-clear-t, var(--fade-clear-y, var(--fade-clear-xy, 0px)))',
  )
  assert.equal(
    declValue(xy, '--sf-clear-b'),
    'var(--fade-clear-b, var(--fade-clear-y, var(--fade-clear-xy, 0px)))',
  )
  assert.equal(
    declValue(xy, '--sf-clear-l'),
    'var(--fade-clear-l, var(--fade-clear-x, var(--fade-clear-xy, 0px)))',
  )
  assert.equal(
    declValue(xy, '--sf-clear-r'),
    'var(--fade-clear-r, var(--fade-clear-x, var(--fade-clear-xy, 0px)))',
  )
})

test('the framework-free build is real CSS, self-contained, with no Tailwind noise', () => {
  // Source-only constructs must be fully compiled away.
  for (const token of ['@utility', '@theme', '@apply', '--value(']) {
    assert.ok(!css.includes(token), `compiled output must not contain ${token}`)
  }
  // No Preflight / theme-dump leakage from the utilities-only, isolated build.
  assert.ok(!/--tw-/.test(css), 'no --tw-* variables should leak in')
  assert.ok(!/\.flex\s*\{|\.grid\s*\{|\.border\s*\{/.test(css), 'no built-in utilities should leak in')
})
