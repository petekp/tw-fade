# tw-fade

Elegant, CSS-driven scroll-edge fade masking for Tailwind CSS.

Add `fade-y` (or `-t` / `-b` / `-l` / `-r` / `-x` / `-xy`) to any scroll
container and its content dissolves into the surface at the edges. The fade is
**scroll-gated** — the top fade only appears once you've scrolled down, the
bottom fade retreats as you reach the end — with **zero JavaScript**. No overlay
element, no scroll listeners, no `requestAnimationFrame` loop.

```html
<div class="fade-y h-72 overflow-y-auto">
  <!-- long content; edges melt into the background as you scroll -->
</div>
```

It's a CSS port of a progress-driven React component, reproducing the same
13-stop smoothstep curve so the result is visually identical — but it's just a
class.

## Why it's nice

- **Pure CSS.** Driven by [scroll-driven animations][sda] and [CSS masking][mask].
  Nothing runs on the main thread.
- **Scroll-gated, not always-on.** A bare gradient scrim sits there even when
  there's nothing to scroll to. This reveals each edge only when you can
  actually scroll toward it — and shows **no fade at all** when the container
  isn't scrollable.
- **Composable per edge.** Each edge is an independent mask layer composited with
  `mask-composite: intersect`, so `fade-t fade-r` just works.
- **Faithful curve.** The smoothstep alpha ramp makes the edge look like it
  melts into the surface rather than cheaply cross-fading.
- **Graceful fallback.** In engines without scroll-driven animations (Firefox
  stable as of 2026) it falls back to a static always-on fade.

## Install

```sh
npm install tw-fade
```

### Tailwind CSS v3 (JavaScript config)

```js
// tailwind.config.js
module.exports = {
  content: ['./src/**/*.{html,js,jsx,ts,tsx,vue}'],
  plugins: [require('tw-fade')],
}
```

### Tailwind CSS v4 (CSS-first config)

```css
/* app.css */
@import 'tailwindcss';
@plugin 'tw-fade';
```

### No build step (plain HTML / CDN)

A precompiled, framework-free stylesheet ships in the package. It contains only
this plugin's rules — no Tailwind reset, no `--tw-*` defaults — so you can drop it
into any page:

```html
<link rel="stylesheet" href="node_modules/tw-fade/dist/tw-fade.css" />
```

```js
import 'tw-fade/css' // or via a bundler
```

## Usage

The utility is the class. Put it on the scrollable element (the one with
`overflow: auto`/`scroll`), not a wrapper.

| Class             | Fades                          |
| ----------------- | ------------------------------ |
| `fade-t`    | top edge                       |
| `fade-b`    | bottom edge                    |
| `fade-l`    | left edge                      |
| `fade-r`    | right edge                     |
| `fade-y`    | top **and** bottom             |
| `fade-x`    | left **and** right             |
| `fade-xy`   | all four edges                 |
| `fade-static` | force the fade on, always (disables scroll-gating) |

```html
<!-- vertical list, both edges -->
<div class="fade-y h-80 overflow-y-auto">…</div>

<!-- horizontal carousel, both edges -->
<div class="fade-x flex gap-4 overflow-x-auto">…</div>

<!-- only fade the top (e.g. a chat log pinned to the bottom) -->
<div class="fade-t h-96 overflow-y-auto">…</div>
```

### Fading the whole page

To dissolve content into the top and bottom of the **viewport** as the page
scrolls, put the fade on `<body>` itself. Two things are easy to get wrong:

```html
<!-- surface lives on the parent; html stops overflow from escaping to the viewport -->
<html class="h-full overflow-hidden bg-neutral-950">
  <!-- body is the real scroll container, and transparent so the mask reveals the surface -->
  <body class="fade-y h-full overflow-y-auto bg-transparent">
    …
  </body>
</html>
```

1. **`<body>` must be the scroll container.** The fade is driven by
   `animation-timeline: scroll(self block)`, which only attaches to the element's
   *own* scrollport. If you let the page scroll on the viewport, there's no `self`
   scroll to track. Give `<body>` `height: 100%` + `overflow-y: auto`, **and** set
   `overflow: hidden` on `<html>` — otherwise the browser [propagates][prop] the
   body's overflow up to the viewport and `<body>` never becomes a scroller (the
   fade silently does nothing).
2. **Put the surface behind it.** A mask masks the element's *own* background too,
   so there has to be something behind `<body>` to reveal. Keep the surface color
   on `<html>` (or a fixed backdrop) and make `<body>` `bg-transparent`.

Two caveats specific to masking `<body>`: the mask establishes a **stacking
context** on the body, and in the Firefox static fallback the page shows a
permanent top *and* bottom fade (so the header is gently dimmed even at the very
top, where there's nothing to scroll up to).

### Tuning the fade

Two knobs, each with an `sm` / `md` / `lg` scale and arbitrary-value support:

| Class                     | Sets                | Default scale                  |
| ------------------------- | ------------------- | ------------------------------ |
| `fade-size-*`       | the fade **length** | `sm` 2.5rem · `md` 3.125rem · `lg` 4.375rem |
| `fade-range-*`      | the scroll **distance** over which an edge eases in/out | `sm` 24px · `md` 50px · `lg` 96px |

```html
<div class="fade-y fade-size-lg h-80 overflow-y-auto">…</div>

<!-- arbitrary values (plugin builds; not in the precompiled CSS) -->
<div class="fade-y fade-size-[6rem] fade-range-[80px] …">…</div>
```

- **size** is how tall/wide the faded band is.
- **range** is how far you scroll before an edge is fully revealed (leading
  edges) or fully hidden (trailing edges). A small range snaps the fade in
  quickly; a large one eases it.

### Plugin options

Change the project-wide defaults when registering the plugin:

```js
// tailwind.config.js
plugins: [
  require('tw-fade')({
    size: '4rem',   // default fade length
    range: '64px',  // default reveal distance
    sizes: { xl: '6rem' },   // extend the -size-* scale
    ranges: { xl: '120px' }, // extend the -range-* scale
  }),
]
```

`size` / `range` set the default applied to bare usage (e.g. `fade-y` with
no `-size-*`); the named scale stays fixed unless you extend it via `sizes` /
`ranges`.

## How it works

1. **Mask, don't paint.** Each edge is one layer of a four-layer `mask-image` on
   the scroll container. Layers composite with `mask-composite: intersect`, and
   unset edges fall back to an opaque identity layer that never clips — which is
   what makes the edges independently composable.
2. **A numeric amount per edge.** `--sf-t/-b/-l/-r` are registered
   `@property … <number>` values in `[0, 1]`: `0` = no fade, `1` = full fade. The
   amount scales **both** the gradient's length and its alpha, so the reveal is
   pixel-faithful to the source component's `scaleY` + `opacity` animation.
3. **Scroll-gating is the timeline.** `animation-timeline: scroll(self block)`
   drives each amount across a fixed scroll window (`--sf-range`). Leading edges
   reveal over the first range; trailing edges hide over the last. Because the
   amount is a typed `<number>`, the browser interpolates it smoothly.
4. **Inactive timeline → base value.** When the container isn't scrollable the
   timeline is inactive, so the registered initial value (`0` = no fade) shows.
   That's the same "don't fade what you can't scroll" guard the JS version did,
   for free.

The fade is defined with mask **longhands** (`animation-name`,
`animation-timeline`, …) rather than the `animation` shorthand on purpose: the
shorthand resets `animation-timeline` back to `auto` and would silently break
scroll-gating.

## Browser support

| Engine            | Behaviour                                            |
| ----------------- | ---------------------------------------------------- |
| Chrome/Edge 115+  | Full scroll-gated fade                               |
| Safari 26+        | Full scroll-gated fade                               |
| Firefox           | Static always-on fade (via `@supports not (…)`)      |

The scroll-driven behaviour is wrapped in
`@supports (animation-timeline: scroll())`; the `@supports not (…)` branch pins
active edges to a static fade so the effect degrades to "always faded" rather
than disappearing. Masking itself is supported everywhere unprefixed in the
above. (The plugin emits standard mask properties only and leaves any legacy
`-webkit-` prefixing to your build's autoprefixer.)

## Development

```sh
npm test                      # fast, browser-free unit tests on the emitted CSS
node scripts/build-css.mjs    # regenerate dist/tw-fade.css from src/

# real-browser verification (needs Chromium via Playwright)
npm run verify                # runs all four checks below
node build/verify.mjs         # amount-level checks against the full demo build
node build/verify-dist.mjs    # amount-level checks against the shipped framework-free CSS
node build/verify-fade.mjs    # pixel-level: the mask actually renders (vertical, horizontal, size, nesting)
node build/verify-page.mjs    # the whole-page fade on <body> (scroller + scroll-gating)
node build/shots.mjs          # capture demo screenshots

open demo/index.html          # the interactive demo
```

`src/index.js` is the single source of truth — `dist/tw-fade.css` is
generated from it.

## Credit

A CSS reimplementation of a progress-driven `ScrollEdgeFade` React component; the
13-stop smoothstep mask ramp is lifted verbatim so the two are visually
indistinguishable.

## License

[MIT](./LICENSE) © Pete Petrash

[sda]: https://developer.mozilla.org/en-US/docs/Web/CSS/animation-timeline
[mask]: https://developer.mozilla.org/en-US/docs/Web/CSS/mask-composite
[prop]: https://www.w3.org/TR/css-overflow-3/#overflow-propagation
