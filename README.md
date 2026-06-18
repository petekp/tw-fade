# tw-fade

Elegant, CSS-driven scroll-edge fade masking for Tailwind CSS v4.

[Live demo](https://pete.design/tw-fade)

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
class. tw-fade is **Tailwind v4-native**: a CSS-first plugin authored entirely
with `@utility` / `@theme`, no JavaScript anywhere.

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

Then import it after Tailwind in your CSS entrypoint:

```css
/* app.css */
@import "tailwindcss";
@import "tw-fade";
```

That's it — the import adds the `fade-*` utilities to your build. tw-fade is a
CSS-first plugin, so it needs **Tailwind CSS v4**. (Using v3, or no build step at
all? See [No build step](#no-build-step-plain-html--cdn) below.)

### No build step (plain HTML / CDN)

A precompiled, framework-free stylesheet ships in the package. It contains only
this plugin's rules — no Tailwind reset, no `--tw-*` defaults — so you can drop it
into any page, with or without Tailwind:

```html
<link rel="stylesheet" href="node_modules/tw-fade/dist/tw-fade.css" />
```

```js
import 'tw-fade/css' // or via a bundler that handles CSS imports
```

The precompiled CSS includes the full named scale (`xs` through `4xl`) for
`fade-size-*`, `fade-range-*`, `fade-clear-*`, their edge/axis variants, and the
dynamic clear-zone utilities (`fade-clear-*-var`). Arbitrary values like
`fade-size-[6rem]`, `fade-size-b-[6rem]`, `fade-range-[12px]`, and
`fade-clear-t-[56px]` are generated on demand by Tailwind's JIT, so they're only
available through the v4 build path above - not the prebuilt drop-in.

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
   `animation-timeline: scroll(self y)`, which only attaches to the element's
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

### Writing direction

The timeline tracks a **physical** axis, so the vertical utilities (`fade-y`,
`fade-t`, `fade-b`) are correct in every writing mode and direction — they fade
only when there's real vertical overflow.

The horizontal utilities (`fade-x`, `fade-l`, `fade-r`) currently **assume
left-to-right**. In a right-to-left context the scroll progress runs the other
way while the mask edges stay physical, so the fade lands on the opposite side
from the hidden content. For an order-neutral horizontal scroller (e.g. a card
carousel) you can force `dir="ltr"` on the scroll container to get correct fades;
otherwise treat horizontal fades as LTR-only for now. Full RTL support for
`fade-x` is planned.

### Tuning the fade

Three knobs, each with an `xs` through `4xl` scale and arbitrary-value support.
The named scale uses Tailwind's spacing unit (`--spacing`, falling back to
`0.25rem`), and all three knobs share the same values:

`xs` 1.5rem · `sm` 2rem · `md` 3rem · `lg` 4rem · `xl` 5rem · `2xl` 6rem ·
`3xl` 8rem · `4xl` 10rem

| Class                     | Sets                | Default scale                  |
| ------------------------- | ------------------- | ------------------------------ |
| `fade-size-*`       | the fade **length** for every active edge | shared `xs`-`4xl` scale |
| `fade-size-t-*` / `fade-size-b-*` / `fade-size-l-*` / `fade-size-r-*` | the fade **length** for one edge | shared `xs`-`4xl` scale |
| `fade-size-y-*` / `fade-size-x-*` | the fade **length** for an axis | shared `xs`-`4xl` scale |
| `fade-range-*`      | the scroll **distance** over which an edge eases in/out | shared `xs`-`4xl` scale |
| `fade-clear-t-*` / `fade-clear-b-*` / `fade-clear-l-*` / `fade-clear-r-*` | an unfaded **clear zone** before one edge's fade starts | shared `xs`-`4xl` scale |
| `fade-clear-y-*` / `fade-clear-x-*` / `fade-clear-xy-*` | an unfaded **clear zone** for an axis or all edges | shared `xs`-`4xl` scale |

```html
<div class="fade-y fade-size-lg h-80 overflow-y-auto">…</div>

<!-- top uses the default md size; bottom uses lg -->
<div class="fade-y fade-size-b-lg h-80 overflow-y-auto">…</div>

<!-- start from sm everywhere, then make only the bottom fade larger -->
<div class="fade-y fade-size-sm fade-size-b-2xl h-80 overflow-y-auto">…</div>

<!-- leave an unfaded zone before the top fade starts -->
<div class="fade-y fade-clear-t-lg h-80 overflow-y-auto">…</div>

<!-- arbitrary values (v4 build only; not in the precompiled CSS) -->
<div class="fade-y fade-size-[6rem] fade-range-[80px] fade-clear-t-[56px] …">…</div>
```

- **size** is how tall/wide the faded band is. A bare `fade-y` with no
  `fade-size-*` uses the `md` length.
- Scoped sizes resolve from most specific to least specific: edge (`fade-size-b-*`)
  wins over axis (`fade-size-y-*`), axis wins over global (`fade-size-*`), and
  global wins over the default `md` length.
- **range** is how far you scroll before an edge is fully revealed (leading
  edges) or fully hidden (trailing edges). A small range snaps the fade in
  quickly; a large one eases it. Bare usage defaults to the `md` range.
- **clear** is an opaque band before the fade ramp begins. It changes the mask
  only; it does not add padding, reserve layout space, or change sticky
  positioning.

#### Dynamic clear zones

If you intentionally keep a fade on an edge with measured sticky chrome, use a
`fade-clear-*-var` utility and set a public custom property on the scroll
container:

```html
<div id="orders" class="fade-y fade-clear-t-var h-80 overflow-y-auto">
  <header data-sticky-header class="sticky top-0">...</header>
  ...
</div>

<script>
  const scroller = document.querySelector('#orders')
  const header = scroller.querySelector('[data-sticky-header]')

  const syncClearance = () => {
    scroller.style.setProperty('--fade-clear-t', `${header.getBoundingClientRect().height}px`)
  }

  new ResizeObserver(syncClearance).observe(header)
  syncClearance()
</script>
```

The public dynamic variables are `--fade-clear-t`, `--fade-clear-b`,
`--fade-clear-l`, `--fade-clear-r`, `--fade-clear-y`, `--fade-clear-x`, and
`--fade-clear-xy`. Edge variables win over axis variables, axis variables win
over `--fade-clear-xy`, and missing values fall back to `0px`.

#### Sticky edges and rubber-band overscroll

If a sticky element sits on an edge, avoid fading that same edge when possible.
On macOS rubber-band overscroll, the sticky element can visually move with the
scrolling content while the mask stays fixed to the scroll container. That can
create a temporary gap that `fade-clear-*` cannot track.

For sticky headers, prefer fading only the bottom edge:

```html
<div class="fade-b h-80 overflow-y-auto">
  <header class="sticky top-0">...</header>
  ...
</div>
```

Use `fade-clear-t-*` or `fade-clear-t-var` only when that tradeoff is acceptable,
or when the sticky chrome lives outside the masked scroll container.

### Extending the scale

The scale lives in Tailwind's theme, so you add or override steps with `@theme` —
no plugin config, no JavaScript:

```css
@import "tailwindcss";
@import "tw-fade";

@theme {
  --fade-size-5xl: calc(var(--spacing, 0.25rem) * 48); /* enables fade-size-5xl, fade-size-b-5xl, etc. */
  --fade-range-5xl: calc(var(--spacing, 0.25rem) * 48); /* enables fade-range-5xl */
  --fade-clear-5xl: calc(var(--spacing, 0.25rem) * 48); /* enables fade-clear-t-5xl, fade-clear-y-5xl, etc. */
}
```

Each `--fade-size-*`, `--fade-range-*`, and `--fade-clear-*` theme key
automatically becomes a matching utility.

## How it works

1. **Mask, don't paint.** Each edge is one layer of a four-layer `mask-image` on
   the scroll container. Layers composite with `mask-composite: intersect`, and
   unset edges fall back to an opaque identity layer that never clips — which is
   what makes the edges independently composable.
2. **A numeric amount per edge.** `--sf-t/-b/-l/-r` are registered
   `@property … <number>` values in `[0, 1]`: `0` = no fade, `1` = full fade. The
   amount scales **both** the gradient's length and its alpha, so the reveal is
   pixel-faithful to the source component's `scaleY` + `opacity` animation.
3. **Scroll-gating is the timeline.** `animation-timeline: scroll(self y)` (or
   `scroll(self x)` for horizontal edges) drives each amount across a fixed scroll
   window (`--sf-range`). Leading edges reveal over the first range; trailing edges
   hide over the last. Because the amount is a typed `<number>`, the browser
   interpolates it smoothly. The axis is **physical** (`y`/`x`), matching the
   physical mask gradients, so the fade stays correct under any writing mode.
4. **Inactive timeline → base value.** When the container isn't scrollable the
   timeline is inactive, so the registered initial value (`0` = no fade) shows.
   That's the same "don't fade what you can't scroll" guard the original did,
   for free.

The reveal is written as the `animation` shorthand followed by an explicit
`animation-timeline` longhand. The shorthand resets `animation-timeline` to
`auto`, then the longhand immediately re-points it at the scroll timeline — the
canonical scroll-driven pattern, since the shorthand has no slot for a timeline.
`fade-static` pins each amount with `!important`, so it forces the fade on
regardless of where Tailwind sorts it relative to the reveal animation.

## Browser support

| Engine            | Behaviour                                            |
| ----------------- | ---------------------------------------------------- |
| Chrome/Edge 120+  | Full scroll-gated fade on desktop and Android        |
| Safari 26+        | Full scroll-gated fade on macOS, iOS, and iPadOS     |
| Firefox 128+      | Static always-on fade (via `@supports not (…)`)      |
| Opera 106+        | Full scroll-gated fade                               |
| Samsung Internet 25+ | Full scroll-gated fade                            |

The scroll-driven behaviour is wrapped in
`@supports (animation-timeline: scroll())`; the `@supports not (…)` branch pins
active edges to a static fade so the effect degrades to "always faded" rather
than disappearing. The plugin emits **unprefixed** mask properties only, so the
floor is the first engine with unprefixed CSS masking: Chrome/Edge **120** (Dec
2023) — note scroll-driven animations shipped earlier, in 115, but 115–119 still
needed `-webkit-` masking, so 120 is the real lower bound for the full effect.
Safari needs **26+** for scroll-driven animation support, including Mobile
Safari on iOS/iPadOS; older Safari versions support the mask layer but not the
scroll-gated reveal. Firefox currently supports the mask layer and `@property`,
but not scroll-driven animations by default, so it intentionally receives the
static fallback. Add an autoprefixer if you need to reach older Chromium,
Safari, or Samsung Internet versions that only accepted `-webkit-` masking.

## Development

`src/tw-fade.css` is the single source of truth — a Tailwind v4 CSS-first
stylesheet. `dist/tw-fade.css` is generated from it by running the v4 CLI over
the source in isolation (utilities only, no Preflight), so the shipped drop-in
contains nothing but this plugin's rules.

```sh
npm test                      # fast, browser-free unit tests on the compiled CSS
node scripts/build-css.mjs    # regenerate dist/tw-fade.css from src/tw-fade.css
npm run build:demo            # rebuild the demo stylesheet (demo/styles.css)

# real-browser verification (needs Chromium via Playwright)
npm run verify                # runs all four checks below
node build/verify.mjs         # amount-level checks against the full demo build
node build/verify-dist.mjs    # amount-level checks against the shipped framework-free CSS
node build/verify-fade.mjs    # pixel-level: the mask actually renders (vertical, horizontal, size, nesting)
node build/verify-page.mjs    # the whole-page fade on <body> (scroller + scroll-gating)
node build/shots.mjs          # capture demo screenshots

open demo/index.html          # the interactive demo
```

The unit tests compile `src/tw-fade.css` the same way the dist is built and
assert on the real emitted bytes, so they exercise exactly what a consumer's
`<link>` receives.

## Credit

A CSS reimplementation of a progress-driven `ScrollEdgeFade` React component; the
13-stop smoothstep mask ramp is lifted verbatim so the two are visually
indistinguishable.

## License

[MIT](./LICENSE) © Pete Petrash

[sda]: https://developer.mozilla.org/en-US/docs/Web/CSS/animation-timeline
[mask]: https://developer.mozilla.org/en-US/docs/Web/CSS/mask-composite
[prop]: https://www.w3.org/TR/css-overflow-3/#overflow-propagation
