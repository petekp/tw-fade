/**
 * Unit tests for tw-fade.
 *
 *   npm test            (runs `node --test`)
 *
 * These are fast, browser-free assertions on the CSS the plugin emits. They lock
 * in the structural invariants that make the effect correct: the registered
 * custom properties, the scroll-driven reveal wiring, the multi-layer
 * intersect-composited mask, and the per-edge isolation. The end-to-end visual
 * behaviour is covered separately by build/verify.mjs and build/verify-dist.mjs
 * (which drive real Chromium).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { collect, compileCss } from '../scripts/compile.mjs'

const requireCjs = createRequire(import.meta.url)
const plugin = requireCjs('../src/index.js')

const { base, utilities } = collect()
const css = compileCss()

const MASK_VARS = ['--sf-mask-t', '--sf-mask-b', '--sf-mask-l', '--sf-mask-r']

test('registers the amounts as typed <number> and size/range as universal, non-inheriting', () => {
  for (const amt of ['--sf-t', '--sf-b', '--sf-l', '--sf-r']) {
    const prop = base[`@property ${amt}`]
    assert.ok(prop, `missing @property ${amt}`)
    // A typed <number> (not `*`) is what lets scroll-driven animation interpolate
    // the amount SMOOTHLY instead of snapping between keyframes.
    assert.equal(prop.syntax, '"<number>"')
    assert.equal(prop.inherits, 'false')
    // Initial 0 = no fade: the correct base state when the timeline is inactive.
    assert.equal(prop['initial-value'], '0')
  }
  // --sf-size / --sf-range ARE registered, but with the UNIVERSAL syntax and NO
  // initial-value. A typed <length> @property would reject the font-relative (rem)
  // default and silently drop the registration — the "only large fades" bug. The
  // universal syntax sidesteps that rule; the omitted initial-value keeps an unset
  // value guaranteed-invalid, so `var(--sf-size, <rem>)` still falls back to the
  // default. The point of registering at all is `inherits: false`, which stops a
  // nested fade from leaking its parent's size/range.
  for (const v of ['--sf-size', '--sf-range']) {
    const prop = base[`@property ${v}`]
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
  for (const [key, decl] of Object.entries(base)) {
    if (!key.startsWith('@property')) continue
    if (decl.syntax === '"*"') {
      assert.equal(decl['initial-value'], undefined, `${key} (universal) should omit initial-value`)
      continue
    }
    const initial = decl['initial-value']
    assert.ok(initial !== undefined, `typed ${key} must declare an initial-value`)
    // Every numeric token must be unitless or absolutely-sized. Allowlist beats a
    // denylist: new CSS units (cqw, lh, dvh…) can't outrun "only px/cm/…/unitless".
    for (const token of String(initial).split(/[\s,()]+/).filter(Boolean)) {
      if (!/\d/.test(token)) continue
      assert.match(
        token,
        ABSOLUTE,
        `typed ${key} initial-value token "${token}" must be unitless or absolute`,
      )
    }
  }
})

test('leading edges reveal 0→1, trailing edges hide 1→0', () => {
  assert.equal(base['@keyframes sf-reveal-t'].from['--sf-t'], '0')
  assert.equal(base['@keyframes sf-reveal-t'].to['--sf-t'], '1')
  assert.equal(base['@keyframes sf-reveal-b'].from['--sf-b'], '1')
  assert.equal(base['@keyframes sf-reveal-b'].to['--sf-b'], '0')
  assert.equal(base['@keyframes sf-reveal-l'].from['--sf-l'], '0')
  assert.equal(base['@keyframes sf-reveal-r'].from['--sf-r'], '1')
})

test('every edge utility carries the composited multi-layer mask base', () => {
  for (const cls of ['.fade-t', '.fade-b', '.fade-l', '.fade-r', '.fade-y', '.fade-x', '.fade-xy']) {
    const u = utilities[cls]
    assert.ok(u, `missing ${cls}`)
    // intersect is mandatory: the initial `add` (union) would erase the fade.
    assert.equal(u['mask-composite'], 'intersect')
    assert.equal(u['mask-repeat'], 'no-repeat')
    assert.equal(u['mask-size'], '100% 100%')
    // Four layers, each defaulting to the opaque identity (no-op) gradient.
    const layers = u['mask-image'].split('linear-gradient(#000, #000)').length - 1
    assert.equal(layers, 4, `${cls} should have 4 identity fallbacks`)
  }
})

test('each directional utility sets ONLY its own mask layer', () => {
  const own = { '.fade-t': '--sf-mask-t', '.fade-b': '--sf-mask-b', '.fade-l': '--sf-mask-l', '.fade-r': '--sf-mask-r' }
  for (const [cls, mine] of Object.entries(own)) {
    for (const v of MASK_VARS) {
      if (v === mine) assert.ok(utilities[cls][v], `${cls} must set ${v}`)
      else assert.equal(utilities[cls][v], undefined, `${cls} must NOT set ${v}`)
    }
  }
})

test('axis shorthands set exactly their constituent mask layers', () => {
  assert.ok(utilities['.fade-y']['--sf-mask-t'] && utilities['.fade-y']['--sf-mask-b'])
  assert.equal(utilities['.fade-y']['--sf-mask-l'], undefined)
  assert.ok(utilities['.fade-x']['--sf-mask-l'] && utilities['.fade-x']['--sf-mask-r'])
  assert.equal(utilities['.fade-x']['--sf-mask-t'], undefined)
  for (const v of MASK_VARS) assert.ok(utilities['.fade-xy'][v], `xy must set ${v}`)
})

test('mask gradients point the right way and are driven by their amount', () => {
  assert.match(utilities['.fade-t']['--sf-mask-t'], /to bottom/)
  assert.match(utilities['.fade-b']['--sf-mask-b'], /to top/)
  assert.match(utilities['.fade-l']['--sf-mask-l'], /to right/)
  assert.match(utilities['.fade-r']['--sf-mask-r'], /to left/)
  // The amount scales both the gradient length (size * amount) and its alpha
  // (1 - amount * …), so at amount 0 the layer collapses to fully opaque.
  assert.match(utilities['.fade-t']['--sf-mask-t'], /calc\(1 - var\(--sf-t\)\)/)
  // Size is read with a fallback default so a panel WITHOUT a fade-size-*
  // utility still gets a real fade band (the bug was an unset --sf-size).
  assert.match(
    utilities['.fade-t']['--sf-mask-t'],
    /calc\(var\(--sf-size, [^)]+\) \* var\(--sf-t\)\)/,
  )
})

test('scroll-driven reveal wires the correct axis per group', () => {
  const sup = base['@supports (animation-timeline: scroll())']
  const block = sup['.fade-t, .fade-b, .fade-y']
  const inline = sup['.fade-l, .fade-r, .fade-x']
  assert.match(block['animation-timeline'], /scroll\(self block\)/)
  assert.ok(!/inline/.test(block['animation-timeline']))
  assert.match(inline['animation-timeline'], /scroll\(self inline\)/)
  // Leading reveals over the first range; trailing hides over the last. Range is
  // read with a fallback default (same fix as --sf-size).
  assert.match(block['animation-range-start'], /^0, calc\(100% - var\(--sf-range, [^)]+\)\)$/)
  assert.match(block['animation-range-end'], /^var\(--sf-range, [^)]+\), 100%$/)
  // The animation MUST be set via longhands; the `animation` shorthand would
  // reset animation-timeline back to `auto` and break scroll-gating.
  assert.equal(sup['.fade-xy']['animation-name'].split(',').length, 4)
})

test('provides a static fallback when scroll-driven animation is unsupported', () => {
  const fb = base['@supports not (animation-timeline: scroll())']
  assert.equal(fb['.fade-t, .fade-y, .fade-xy']['--sf-t'], '1')
  assert.equal(fb['.fade-b, .fade-y, .fade-xy']['--sf-b'], '1')
})

test('fade-static forces the fade on and disables the animation', () => {
  const s = utilities['.fade-static']
  assert.equal(s['--sf-t'], '1')
  assert.equal(s['animation-name'], 'none')
  // It must come AFTER the reveal @supports block so `animation-name: none` wins.
  assert.ok(css.indexOf('@supports (animation-timeline') < css.indexOf('.fade-static'))
})

test('exposes the size and range scales, skipping the no-op DEFAULT', () => {
  assert.equal(utilities['.fade-size-sm']['--sf-size'], '2.5rem')
  assert.equal(utilities['.fade-size-lg']['--sf-size'], '4.375rem')
  assert.equal(utilities['.fade-range-lg']['--sf-range'], '96px')
  // No bare `.fade-size` utility (a DEFAULT-valued no-op).
  assert.equal(utilities['.fade-size'], undefined)
  assert.ok(!/\.fade-size \{/.test(css))
})

test('the smoothstep ramp is the 13-stop sigmoid from the reference', () => {
  assert.equal(plugin.STOPS.length, 13)
  assert.deepEqual(plugin.STOPS[0], [0, 0])
  assert.deepEqual(plugin.STOPS[12], [1, 1])
  assert.deepEqual(plugin.STOPS[6], [0.5, 0.5])
  // Strictly monotonic in both fraction and alpha — a clean S-curve.
  for (let i = 1; i < plugin.STOPS.length; i++) {
    assert.ok(plugin.STOPS[i][0] > plugin.STOPS[i - 1][0], 'fraction must increase')
    assert.ok(plugin.STOPS[i][1] > plugin.STOPS[i - 1][1], 'alpha must increase')
  }
})

test('plugin options set the default fade length/range, not the named scale', () => {
  const custom = collect({ size: '5rem', range: '120px' })
  // options.size/range change the DEFAULT applied to bare usage — baked in as the
  // fallback of `var(--sf-size, …)` / `var(--sf-range, …)`, which is what shows
  // when no -size-*/-range-* utility is set. A rem default is fine here (it's a
  // plain var fallback, not a registered @property initial-value).
  assert.match(custom.utilities['.fade-y']['--sf-mask-t'], /var\(--sf-size, 5rem\)/)
  const block = custom.base['@supports (animation-timeline: scroll())'][
    '.fade-t, .fade-b, .fade-y'
  ]
  assert.match(block['animation-range-end'], /var\(--sf-range, 120px\)/)
  // The named scale (sm/md/lg) is intentionally fixed and unaffected by options.
  assert.equal(custom.utilities['.fade-size-md']['--sf-size'], '3.125rem')
})

test('compiled output is ordered base-before-utilities and is self-contained', () => {
  assert.ok(css.indexOf('@property --sf-t') < css.indexOf('.fade-t {'))
  assert.ok(css.indexOf('@keyframes sf-reveal-t') < css.indexOf('.fade-t {'))
  // No Tailwind base noise leaked in.
  assert.ok(!/--tw-/.test(css))
})
