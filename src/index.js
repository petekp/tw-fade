'use strict'

/**
 * tw-fade
 * --------------
 * Elegant, CSS-driven scroll-edge fade masking for Tailwind CSS.
 *
 * Add `fade-t` / `fade-b` / `fade-l` / `fade-r`
 * (or the `-x` / `-y` / `-xy` axis shorthands) to any scroll container and its
 * content dissolves into the surface at the chosen edges. The fade is
 * "scroll-gated" with ZERO JavaScript: the top fade only appears once you have
 * scrolled down, the bottom fade vanishes as you reach the end — mirroring the
 * progress-driven `ScrollEdgeFade` React component this plugin is modelled on.
 *
 * How it works
 * ============
 * 1. MASK, not paint. Each edge is one layer of a multi-layer `mask-image` on
 *    the scroll container. Layers are composited with `mask-composite: intersect`
 *    so each edge clips independently, and unset edges fall back to an opaque
 *    identity layer (`linear-gradient(#000,#000)`) that never clips.
 *
 * 2. A numeric "amount" per edge (`--sf-t/-b/-l/-r`, a registered `<number>` in
 *    [0,1]) drives each gradient: `0` = no fade (fully opaque), `1` = full fade.
 *    The amount scales BOTH the gradient's length (the reference's `scaleY`) and
 *    its alpha (the reference's `opacity`), so the reveal is pixel-faithful.
 *
 * 3. Scroll-gating is pure CSS via scroll-driven animations
 *    (`animation-timeline: scroll(self …)`). Each amount is animated over a fixed
 *    scroll distance (`--sf-range`, default 50px — the reference's
 *    DEFAULT_SCROLL_EDGE_RANGE). Leading edges (top/left) reveal over the FIRST
 *    `--sf-range`; trailing edges (bottom/right) hide over the LAST `--sf-range`.
 *
 * 4. Graceful fallback. The amounts default to `0` (no fade), so when the
 *    container is NOT scrollable the scroll timeline is inactive and the base
 *    value (0) shows — no fade, exactly like the JS guard. In browsers without
 *    scroll-driven animations (Firefox stable as of 2026) an
 *    `@supports not (…)` block pins active edges to `1` so you still get a
 *    static always-on fade rather than nothing.
 */

const plugin = require('tailwindcss/plugin')

/**
 * The 13-stop "smoothstep" alpha ramp, lifted verbatim from the reference
 * arc-design-studio `--scroll-edge-mask-*` gradients so the curve is identical.
 * Each entry is `[fractionOfFadeLength, alpha]`. A plain linear fade looks
 * cheap; this sigmoid is what makes the edge feel like it melts into the surface.
 */
const STOPS = [
  [0, 0],
  [0.08333, 0.017],
  [0.16667, 0.067],
  [0.25, 0.146],
  [0.33333, 0.25],
  [0.41667, 0.371],
  [0.5, 0.5],
  [0.58333, 0.629],
  [0.66667, 0.75],
  [0.75, 0.854],
  [0.83333, 0.933],
  [0.91667, 0.983],
  [1, 1],
]

/** Fully-opaque layer: a no-op under `mask-composite: intersect`. */
const IDENTITY = 'linear-gradient(#000, #000)'

const EDGES = {
  t: { dir: 'to bottom', amount: '--sf-t', maskVar: '--sf-mask-t' },
  b: { dir: 'to top', amount: '--sf-b', maskVar: '--sf-mask-b' },
  l: { dir: 'to right', amount: '--sf-l', maskVar: '--sf-mask-l' },
  r: { dir: 'to left', amount: '--sf-r', maskVar: '--sf-mask-r' },
}

/** Trim a JS float to a compact CSS-friendly string (no trailing zeros). */
function num(n) {
  return String(Number(n.toFixed(5)))
}

/**
 * Build one edge's mask gradient as a function of its amount variable.
 *
 * For a stop at `[frac, alpha]` and amount `a`:
 *   - position = size · a · frac   (amount scales the fade length → "scaleY")
 *   - mask-alpha = 1 − a · (1 − alpha)  (amount scales opacity → "opacity")
 *
 * At a=0 every stop collapses to position 0 with alpha 1 ⇒ uniformly opaque ⇒
 * NO fade. At a=1 it is exactly the reference smoothstep over the full size.
 */
function edgeGradient(edge, sizeRef) {
  const { dir, amount } = EDGES[edge]
  const stops = STOPS.map(([frac, alpha]) => {
    const position =
      frac === 0
        ? '0'
        : frac === 1
          ? `calc(${sizeRef} * var(${amount}))`
          : `calc(${sizeRef} * var(${amount}) * ${num(frac)})`
    const a =
      alpha === 1
        ? '1'
        : alpha === 0
          ? `calc(1 - var(${amount}))`
          : `calc(1 - var(${amount}) * ${num(1 - alpha)})`
    return `rgb(0 0 0 / ${a}) ${position}`
  })
  return `linear-gradient(${dir}, ${stops.join(', ')})`
}

/** The 4-layer mask list, each layer defaulting to the identity (no-op) layer. */
const MASK_LIST = ['t', 'b', 'l', 'r']
  .map((e) => `var(${EDGES[e].maskVar}, ${IDENTITY})`)
  .join(', ')

/**
 * Shared declarations that turn an element into a composited 4-edge mask.
 *
 * We emit the STANDARD properties only. Every modern target engine supports
 * them unprefixed (Chrome 120+, Safari 15.4+, Firefox 53+ for masking;
 * `mask-composite: intersect` across the same range). Emitting our own
 * `-webkit-mask-composite` is counter-productive: autoprefixer in a consumer's
 * build re-derives an (imperfect, not layer-count-aware) prefixed value and,
 * placing it after ours, would override it. Leaving prefixing to each
 * consumer's autoprefixer keeps modern engines on the correct standard value
 * (which always wins as the last-declared property) and keeps Tailwind v4
 * output — which runs no autoprefixer — perfectly clean.
 *
 * `mask-composite: intersect` is MANDATORY: the initial value is `add` (union),
 * which would leave nearly the whole element visible and the fade absent.
 * `mask-repeat: no-repeat` + `mask-size: 100% 100%` are required because a
 * gradient has no intrinsic size and would otherwise tile and break the math.
 */
const BASE_MASK = {
  'mask-image': MASK_LIST,
  'mask-repeat': 'no-repeat',
  'mask-size': '100% 100%',
  'mask-composite': 'intersect',
}

/** An edge utility = the shared mask base + this edge's gradient assignment. */
function edgeUtility(edges, sizeRef) {
  const decls = { ...BASE_MASK }
  for (const e of edges) decls[EDGES[e].maskVar] = edgeGradient(e, sizeRef)
  return decls
}

/** Animation longhands for a set of `[name, axis, trailing]` reveal tracks. */
function revealWiring(tracks, rangeRef) {
  const join = (fn) => tracks.map(fn).join(', ')
  return {
    'animation-name': join(([name]) => name),
    'animation-duration': join(() => 'auto'),
    'animation-timing-function': join(() => 'linear'),
    'animation-fill-mode': join(() => 'both'),
    'animation-timeline': join(([, axis]) => `scroll(self ${axis})`),
    // Leading edges reveal over the first range; trailing edges over the last.
    'animation-range-start': join(([, , trailing]) =>
      trailing ? `calc(100% - ${rangeRef})` : '0',
    ),
    'animation-range-end': join(([, , trailing]) => (trailing ? '100%' : rangeRef)),
  }
}

const REVEAL_T = ['sf-reveal-t', 'block', false]
const REVEAL_B = ['sf-reveal-b', 'block', true]
const REVEAL_L = ['sf-reveal-l', 'inline', false]
const REVEAL_R = ['sf-reveal-r', 'inline', true]

const DEFAULTS = {
  size: '3.125rem', // reference default fade length (50px)
  range: '50px', // reference DEFAULT_SCROLL_EDGE_RANGE
  sizes: {
    sm: '2.5rem',
    md: '3.125rem',
    lg: '4.375rem',
  },
  ranges: {
    sm: '24px',
    md: '50px',
    lg: '96px',
  },
}

module.exports = plugin.withOptions(
  (options = {}) =>
    function twFade({ addBase, addUtilities, matchUtilities, theme }) {
      const size = options.size || theme('twFade.size.DEFAULT') || DEFAULTS.size
      const range =
        options.range || theme('twFade.range.DEFAULT') || DEFAULTS.range

      // `--sf-size` / `--sf-range` are STATIC config (never animated). We must NOT
      // register them as a typed `<length>` @property: that requires a
      // *computationally independent* initial-value, which silently REJECTS a
      // font-relative `rem` default — the whole registration is dropped, the
      // variable is left unset, and the fade collapses (the "only large fades"
      // bug). So every consumer reads `var(--sf-size, <default>)`, where the
      // themeable default works in ANY unit and a `fade-size-*` utility still
      // overrides it.
      //
      // We DO register them — but with the UNIVERSAL syntax (`*`) and no
      // initial-value. The universal syntax carries no computational-independence
      // rule, and with the initial-value omitted an unset property holds the
      // *guaranteed-invalid* value, so `var(--sf-size, <default>)` STILL falls back
      // to the default exactly as before. The only thing registration buys us is
      // `inherits: false`: an UNregistered custom property inherits, so a
      // default-size fade nested inside a `fade-size-lg` one would
      // silently leak the parent's size/range. Registration stops that leak without
      // re-introducing the rejected-initial-value bug.
      const sizeRef = `var(--sf-size, ${size})`
      const rangeRef = `var(--sf-range, ${range})`

      addBase({
        // Registered numeric amounts: typed `<number>` so scroll-driven
        // animation interpolates them SMOOTHLY (a `*`-typed prop would jump).
        // Initial 0 = no fade, which is the correct "not scrollable" base state.
        // `0` is unitless and therefore computationally independent — valid.
        '@property --sf-t': { syntax: '"<number>"', inherits: 'false', 'initial-value': '0' },
        '@property --sf-b': { syntax: '"<number>"', inherits: 'false', 'initial-value': '0' },
        '@property --sf-l': { syntax: '"<number>"', inherits: 'false', 'initial-value': '0' },
        '@property --sf-r': { syntax: '"<number>"', inherits: 'false', 'initial-value': '0' },

        // Static config vars, registered ONLY for `inherits: false` (stops nested
        // fades leaking size/range). Universal syntax + no initial-value
        // keeps an unset value guaranteed-invalid, so the `var(…, <default>)`
        // fallback still supplies the rem default. See the note above.
        '@property --sf-size': { syntax: '"*"', inherits: 'false' },
        '@property --sf-range': { syntax: '"*"', inherits: 'false' },

        // Each keyframe drives one amount across its reveal window.
        '@keyframes sf-reveal-t': { from: { '--sf-t': '0' }, to: { '--sf-t': '1' } },
        '@keyframes sf-reveal-b': { from: { '--sf-b': '1' }, to: { '--sf-b': '0' } },
        '@keyframes sf-reveal-l': { from: { '--sf-l': '0' }, to: { '--sf-l': '1' } },
        '@keyframes sf-reveal-r': { from: { '--sf-r': '1' }, to: { '--sf-r': '0' } },

        // Scroll-driven reveal engine. Each axis owns the FULL comma-separated
        // longhand list because longhand lists do not concatenate across classes.
        '@supports (animation-timeline: scroll())': {
          '.fade-t, .fade-b, .fade-y': revealWiring([REVEAL_T, REVEAL_B], rangeRef),
          '.fade-l, .fade-r, .fade-x': revealWiring([REVEAL_L, REVEAL_R], rangeRef),
          '.fade-xy': revealWiring([REVEAL_T, REVEAL_B, REVEAL_L, REVEAL_R], rangeRef),
        },

        // No scroll-driven animations (Firefox stable): pin active edges to a
        // static always-on fade so the effect still shows.
        '@supports not (animation-timeline: scroll())': {
          '.fade-t, .fade-y, .fade-xy': { '--sf-t': '1' },
          '.fade-b, .fade-y, .fade-xy': { '--sf-b': '1' },
          '.fade-l, .fade-x, .fade-xy': { '--sf-l': '1' },
          '.fade-r, .fade-x, .fade-xy': { '--sf-r': '1' },
        },
      })

      addUtilities({
        '.fade-t': edgeUtility(['t'], sizeRef),
        '.fade-b': edgeUtility(['b'], sizeRef),
        '.fade-l': edgeUtility(['l'], sizeRef),
        '.fade-r': edgeUtility(['r'], sizeRef),
        '.fade-y': edgeUtility(['t', 'b'], sizeRef),
        '.fade-x': edgeUtility(['l', 'r'], sizeRef),
        '.fade-xy': edgeUtility(['t', 'b', 'l', 'r'], sizeRef),
        // Force always-on (disable scroll-gating) — handy when you always want
        // the fade regardless of scroll position.
        '.fade-static': {
          '--sf-t': '1',
          '--sf-b': '1',
          '--sf-l': '1',
          '--sf-r': '1',
          'animation-name': 'none',
        },
      })

      // Fade length: `fade-size-sm|md|lg` and arbitrary `fade-size-[6rem]`.
      matchUtilities(
        { 'fade-size': (value) => ({ '--sf-size': value }) },
        { values: theme('twFade.size'), type: ['length', 'percentage'] },
      )

      // Reveal distance: `fade-range-sm|md|lg` and arbitrary `fade-range-[80px]`.
      matchUtilities(
        { 'fade-range': (value) => ({ '--sf-range': value }) },
        { values: theme('twFade.range'), type: ['length', 'percentage'] },
      )
    },

  // Self-contained defaults — consumers need NO theme config to use the plugin.
  (options = {}) => ({
    theme: {
      twFade: {
        size: { DEFAULT: options.size || DEFAULTS.size, ...DEFAULTS.sizes, ...(options.sizes || {}) },
        range: {
          DEFAULT: options.range || DEFAULTS.range,
          ...DEFAULTS.ranges,
          ...(options.ranges || {}),
        },
      },
    },
  }),
)

module.exports.STOPS = STOPS
module.exports.edgeGradient = (edge, sizeRef = `var(--sf-size, ${DEFAULTS.size})`) =>
  edgeGradient(edge, sizeRef)
