# tw-fade

Scroll-aware edge fades for Tailwind CSS v4. Mask the edges of any scroll container so content dissolves into its surface. All CSS. Zero JavaScript.

**[Live demo →](https://pete.design/tw-fade)**

```html
<div class="fade-y overflow-y-auto h-64">
  <!-- long content; top and bottom fade as you scroll -->
</div>
```

The fade reveals as you scroll into content and recedes as you reach the ends.

---

## Why

A static edge scrim (a gradient overlay pinned to the top of a scroll area) is always on. It dims content even when nothing is scrolled out of view, and it sits *in front of* your content as a separate element.

`tw-fade` fixes both:

- **Scroll-gated.** The fade appears only when content has scrolled past the edge, and retracts when you reach the start or end. It never dims content you can already see in full.
- **Masks the container itself.** The effect is a `mask-image` on the scroll container: no extra DOM, no stacking-context juggling. It reveals whatever surface sits behind the element instead of painting a fixed color on top.

Add `fade-t`, `fade-b`, `fade-x`, `fade-y`, or `fade-xy` to a scrollable element and you're done.

### Highlights

- **No runtime JavaScript.** CSS scroll-driven animations (`animation-timeline: scroll()`) drive the reveal; the fade itself is a composited `mask-image`.
- **Composable per edge.** Fade one edge, an axis, or all four. The utilities compose (`fade-t fade-r` works) instead of overwriting each other, and nested fades stay isolated.
- **Tunable.** Set band thickness, reveal distance, and clearance zones for sticky headers and footers through utilities or theme tokens, with arbitrary values on the Tailwind source path.
- **Smooth curve.** The fade follows an eased sigmoid (S-curve) alpha ramp instead of a flat linear gradient, so opacity changes faster through the middle and eases at the ends.
- **Graceful fallback.** On engines without scroll-driven animations, the effect degrades to a permanent static fade via `@supports`, so content stays readable rather than stranded behind a half-applied mask.

---

## Requirements

| Use it as… | You need |
| --- | --- |
| Tailwind v4 source utilities (full JIT, arbitrary values) | Tailwind CSS **v4.0.0+** |
| Prebuilt framework-free stylesheet (`<link>` / CDN, fixed utility set) | **nothing** (no Tailwind, no build step) |

The package ships a precompiled, self-contained `dist/tw-fade.css` with only the `fade-*` utilities and their `@property` foundations. No Tailwind Preflight, no reset, no Tailwind core `--tw-*` variables.

---

## Install

### Tailwind v4 (CSS-first source path)

Use this if you already build with Tailwind v4. You get the full JIT, including arbitrary values like `fade-size-[2rem]`.

```bash
npm install tw-fade
```

In your Tailwind entry CSS:

```css
@import "tailwindcss";
@import "tw-fade";
```

The bare `@import "tw-fade"` resolves to the package's `src/tw-fade.css`, authored for v4's CSS-first pipeline and compiled by *your* Tailwind build.

### Prebuilt drop-in (no Tailwind required)

Use the precompiled stylesheet directly in plain HTML, over a CDN, or through a bundler.

```html
<link rel="stylesheet" href="https://unpkg.com/tw-fade/dist/tw-fade.css" />
```

```js
// or, via a JS/bundler import:
import "tw-fade/css";
```

The drop-in ships a fixed, enumerated set of utilities: the named scale only, no arbitrary bracket values. See [Source path vs. prebuilt](#source-path-vs-prebuilt).

---

## Usage

`tw-fade` is plain CSS classes. Apply them however your framework sets `class`.

```html
<!-- Fade top and bottom as you scroll a vertical list -->
<div class="fade-y overflow-y-auto h-80">…</div>

<!-- Fade only the left and right edge of a horizontal rail -->
<div class="fade-x overflow-x-auto flex">…</div>

<!-- Fade all four edges -->
<div class="fade-xy overflow-auto">…</div>

<!-- Compose individual edges -->
<div class="fade-t fade-r overflow-auto">…</div>

<!-- Larger band on the bottom only, longer reveal distance -->
<div class="fade-b fade-size-lg fade-range-xl overflow-y-auto">…</div>
```

The fade keys off the element's **own** scroll position, so put the utility on the element that scrolls (the one with `overflow-*: auto/scroll`), not a parent.

---

## API reference

### Direction utilities

Each utility masks one or more physical edges. Vertical edges track the element's vertical scroll; horizontal edges track its horizontal scroll.

| Utility | Edges masked |
| --- | --- |
| `fade-t` | top |
| `fade-b` | bottom |
| `fade-l` | left |
| `fade-r` | right |
| `fade-y` | top + bottom |
| `fade-x` | left + right |
| `fade-xy` | all four |
| `fade-static` | pins the selected fade(s) fully on, always (see below) |

`fade-static` forces the fade on regardless of scroll and disables the scroll-driven reveal. It sets only the fade *amounts*, not which edges are masked, so pair it with a direction utility: `fade-y fade-static` renders a permanent top and bottom fade. (It pins all four edge amounts internally, but only edges selected by a direction utility render a mask.)

### Size: fade band thickness

Controls how thick the faded band is. Accepts the [named scale](#named-scale), a `[length]`, or a `[percentage]`.

| Utility | Affects |
| --- | --- |
| `fade-size-*` | global band thickness (all edges) |
| `fade-size-t-*` / `-b-*` / `-l-*` / `-r-*` | a single edge |
| `fade-size-y-*` | both vertical edges |
| `fade-size-x-*` | both horizontal edges |

```html
<div class="fade-xy fade-size-md fade-size-t-2xl overflow-auto">…</div>
```

Resolution runs **edge → axis → global → default** (`fade-size-md`, i.e. `3rem`): a per-edge value beats an axis value, which beats the global value, which falls back to the default. See [Resolution precedence](#resolution-precedence).

### Range: scroll reveal distance

Controls the scroll distance over which a fade reveals (as you scroll in) or retracts (as you reach the end). Accepts the named scale, a `[length]`, or a `[percentage]`.

| Utility | Affects |
| --- | --- |
| `fade-range-*` | reveal distance (default `fade-range-md`, i.e. `3rem`) |

A short range snaps the fade in; a long range eases it over more scroll travel.

### Clear: clearance zone before the fade

An opaque, unfaded band held at the edge before the fade ramp begins. Use it behind a sticky header or footer so the pinned UI stays fully visible while content fades beneath it.

| Utility | Affects |
| --- | --- |
| `fade-clear-t-*` / `-b-*` / `-l-*` / `-r-*` | a single edge |
| `fade-clear-y-*` | both vertical edges |
| `fade-clear-x-*` | both horizontal edges |
| `fade-clear-xy-*` | all four edges |

The `*` accepts the named scale, a bare integer (`N` = `spacing × N`, e.g. `fade-clear-t-4` = `1rem`), a `[length]`, or a `[percentage]`. Default clearance is `0`.

```html
<!-- 56px sticky header stays fully opaque; content fades below it -->
<div class="fade-t fade-clear-t-[56px] overflow-y-auto h-80">
  <header class="sticky top-0 h-14">…</header>
  …
</div>
```

> On macOS, rubber-band overscroll can briefly reveal a gap between a sticky element and the clear zone, because the mask stays fixed to the scroll container while the sticky element rubber-bands with the content. If that matters, fade only the opposite edge (e.g. `fade-b` under a top-pinned header).

#### Dynamic clear zones (`-var`)

Every clear utility has a `-var` form that reads the clearance from a CSS custom property you set, so you can drive it from JS or layout-dependent values:

`fade-clear-t-var`, `fade-clear-b-var`, `fade-clear-l-var`, `fade-clear-r-var`, `fade-clear-y-var`, `fade-clear-x-var`, `fade-clear-xy-var`.

Each resolves its property along an **edge → axis → xy → `0px`** chain. The public custom properties you can set:

| Property | Read by |
| --- | --- |
| `--fade-clear-t` / `-b` / `-l` / `-r` | the matching per-edge `-var` |
| `--fade-clear-y` / `-x` | the matching axis `-var` (and per-edge as a fallback) |
| `--fade-clear-xy` | all `-var` utilities (final fallback before `0px`) |

```html
<div class="fade-t fade-clear-t-var overflow-y-auto" style="--fade-clear-t: 56px">…</div>
```

```js
// e.g. keep clearance in sync with a measured sticky header
el.style.setProperty("--fade-clear-t", header.offsetHeight + "px");
```

> The `-var` family is the only one with a dynamic form. `fade-range` has no `-var` variant.

### Named scale

Used by every `fade-size-*`, `fade-range-*`, and named `fade-clear-*` utility. Values derive from Tailwind's spacing unit (`--spacing`, default `0.25rem`).

| Step | Value | Step | Value |
| --- | --- | --- | --- |
| `xs` | `1.5rem` | `xl` | `5rem` |
| `sm` | `2rem` | `2xl` | `6rem` |
| `md` | `3rem` | `3xl` | `8rem` |
| `lg` | `4rem` | `4xl` | `10rem` |

Read or override them as theme tokens: `--fade-size-{step}`, `--fade-range-{step}`, `--fade-clear-{step}`.

### Resolution precedence

For each edge, the band **size** resolves from most specific to least:

```
edge-specific  →  axis  →  global  →  default
fade-size-t-*  →  fade-size-y-*  →  fade-size-*  →  3rem (fade-size-md)
```

The top edge takes its top value if set, else the vertical-axis value, else the global value, else the default `3rem`. Horizontal edges follow the same chain through the x-axis value.

Dynamic **clearance** (`-var`) resolves `edge → axis → xy → 0px`.

---

## Fading the whole page

To dissolve content into the top and bottom of the **viewport** as the page scrolls, fade the element that scrolls. Make `<body>` the scroll container over a surface on `<html>`:

```html
<!-- surface lives on <html>; overflow-hidden stops it escaping to the viewport -->
<html class="h-full overflow-hidden bg-neutral-950">
  <!-- body is the real scroll container, transparent so the mask reveals the surface -->
  <body class="fade-y h-full overflow-y-auto bg-transparent">
    …
  </body>
</html>
```

Two requirements people miss:

1. **`<body>` must be the scroll container.** `scroll(self y)` tracks only the element's own scrollport. Give `<body>` `height: 100%` and `overflow-y: auto`, and set `overflow: hidden` on `<html>`. Otherwise the browser propagates the body's overflow up to the viewport, `<body>` never becomes a scroller, and the fade does nothing.
2. **Put a surface behind the mask.** A mask also masks the element's own background, so something has to sit behind `<body>` to reveal. Keep the surface color on `<html>` (or a fixed backdrop) and make `<body>` transparent.

Masking `<body>` also establishes a stacking context on it, which can change the `z-index` layering of fixed and absolute descendants.

---

## Troubleshooting

- **Is the class on the scrollable element?** The fade has to live on the element that overflows and scrolls, not a parent. See [Usage](#usage).
- **Can it scroll?** With no overflow on an axis, that axis's timeline stays inactive and the amount holds at its `0` base, so no fade. This is intentional: don't fade what you can't scroll.
- **Is there a contrasting surface behind it?** A mask reveals whatever sits behind the element. With nothing there, or no contrast, there's nothing to fade into.
- **RTL plus horizontal?** See [Writing direction](#writing-direction-rtl).

---

## How it works

The element gets a `mask-image` built from four comma-separated layers, one per physical edge, combined with `mask-composite: intersect`:

```css
mask-image:
  /* top */    var(--tw-fade-mask-t, linear-gradient(#000, #000)),
  /* bottom */ var(--tw-fade-mask-b, linear-gradient(#000, #000)),
  /* left */   var(--tw-fade-mask-l, linear-gradient(#000, #000)),
  /* right */  var(--tw-fade-mask-r, linear-gradient(#000, #000));
mask-composite: intersect;
```

When an edge is active, its layer holds a real `linear-gradient`. Otherwise it falls back to the opaque identity gradient `linear-gradient(#000, #000)`, which masks nothing. `intersect` is mandatory: the CSS default `add` (union) lets one opaque layer cancel another's transparency and erase the fade. Each direction utility sets only its own edge's layer, so classes compose cleanly.

**The amount drives both alpha and length.** Each active edge carries a numeric amount from `0` to `1` that controls the gradient's opacity (at `0`, every stop is fully opaque, so the layer is a no-op) and the band's length (at `0`, the band collapses to zero). At `1` you get the full fade over the full band thickness.

**The curve.** After the clearance zone, the active gradient is a 13-stop ramp. The alpha stops follow an eased, symmetric sigmoid sequence while their positions stay evenly spaced across the band. Eased opacity against linear positions yields a smooth S-curve: denser opacity change near the middle, gentler at the ends.

**Scroll gating.** Inside `@supports (animation-timeline: scroll())`, each utility binds the four edge amounts to scroll-driven animations: vertical edges to `scroll(self y)`, horizontal edges to `scroll(self x)`. Leading edges (top, left) reveal `0 → 1` over the first `fade-range` of scroll; trailing edges (bottom, right) retract `1 → 0` over the last. When an axis can't scroll, its amount holds at the `0` base, so no fade. That is the "don't fade what you can't scroll past" guard.

**Fallback.** Inside `@supports not (animation-timeline: scroll())`, all amounts pin to `1`, so every selected edge renders its full static fade instead of disappearing.

> **Public vs. internal surface.** The supported API is the `fade-*` utilities, the `--fade-*` theme tokens, and the `--fade-clear-*` dynamic vars above. The `--tw-fade-*` custom properties in this section are internal implementation details. They register with `inherits: false` so nested fades stay isolated, and they are not a surface to target directly.

---

## Writing direction (RTL)

Behavior keys off **physical** axes, not inline text direction.

- **Vertical fades (`fade-t`, `fade-b`, `fade-y`) are RTL-safe.** The vertical axis and the top and bottom gradients stay identical regardless of text direction.
- **Horizontal fades assume LTR.** `fade-l` acts as the leading edge (reveals as you scroll in) and `fade-r` as the trailing edge (retracts at the end). Because the timeline uses the physical `scroll(self x)` axis, an RTL context flips the leading and trailing semantics relative to reading order. For an order-neutral horizontal scroller, set `dir="ltr"` on the scroll container.

---

## Accessibility

`tw-fade` is a visual mask only. It animates the opacity and length of an edge gradient, never the position of content, and it adds no scrolling motion beyond the scroll you already perform. Like any edge scrim, it lowers the contrast of content right at the masked edges, so keep band sizes modest where edge text must stay legible, and use `fade-clear-*` to hold critical content fully opaque.

---

## Source path vs. prebuilt

| | `@import "tw-fade"` (source) | `tw-fade/css` (prebuilt) |
| --- | --- | --- |
| Requires Tailwind v4 | yes (compiles through your build) | no |
| Direction / `fade-static` | yes | yes |
| Named-scale utilities (`xs`–`4xl`) | yes | yes |
| Per-edge & axis size/clear utilities | yes | yes |
| `fade-clear-*-var` dynamic forms | yes | yes |
| **Arbitrary values** (`fade-size-[6rem]`, `fade-range-[80px]`, `fade-clear-t-[56px]`) | **yes** | **no** |

The prebuilt drop-in compiles only `tailwindcss/utilities.css`, so it carries no Preflight, no reset, and no Tailwind core `--tw-*` defaults. Just the enumerated `fade-*` utilities and their `@property` registrations. Arbitrary bracket values need Tailwind's JIT and exist only on the source path.

### Exports

| Specifier | Resolves to |
| --- | --- |
| `tw-fade` (`.`) | `./src/tw-fade.css` (v4 CSS-first source) |
| `tw-fade/css` | `./dist/tw-fade.css` (prebuilt drop-in) |
| `tw-fade/dist/tw-fade.css` | `./dist/tw-fade.css` (explicit path) |

`tailwindcss >=4.0.0` is an **optional** peer dependency. Consumers using only the prebuilt drop-in don't need it; the source path still needs Tailwind v4 to compile.

---

## Browser support

Two CSS features carry different support floors:

- **CSS masking** (`mask-image`, `mask-composite`, unprefixed). Interoperable across every current evergreen browser. See [caniuse: mask-image](https://caniuse.com/mdn-css_properties_mask-image).
- **Scroll-driven animations** (`animation-timeline: scroll()`). Shipped by default in every major engine except Firefox. See [caniuse: scroll-driven animations](https://caniuse.com/mdn-css_properties_animation-timeline_scroll).

| Engine | Masking | Scroll-driven animation | Result |
| --- | --- | --- | --- |
| Chrome / Edge | 120+ | 115+ | Full scroll-gated fade |
| Safari (WebKit) | 15.4+ / iOS 15.4+ | **26.0+** | Full on 26+; static fade fallback below |
| Firefox (release/beta) | 53+ | **not by default** | Static always-on fade |
| Opera | 106+ | 101+ | Full scroll-gated fade |
| Samsung Internet | 25+ | 23+ | Full scroll-gated fade |

**Firefox.** Scroll-driven animations are implemented but sit behind the `layout.css.scroll-driven-animations.enabled` flag, default-on only in Nightly (since 136) and default-off in Release, Beta, and Developer Edition. Firefox release users get the static `@supports` fallback (the fade renders fully on, always). Masking works regardless (Firefox 53+).

**Safari.** Scroll-driven animations shipped by default in Safari 26.0; 17.x and 18.x get the static fallback. Older WebKit may also need `-webkit-mask-*`, so run the prebuilt CSS through Autoprefixer if you target it.

The practical masking floor is Chrome/Edge 120, the last major engine to drop the `-webkit-` prefix requirement; Safari and Firefox were already ahead. In every case the `@supports` fallback degrades the effect to a permanent static fade rather than breaking.

---

## Development

```bash
npm test       # compiled-CSS unit tests, no browser required
npm run build  # regenerate dist/tw-fade.css from src/tw-fade.css
```

`dist/tw-fade.css` is generated. Don't edit it by hand.

---

## License

MIT © Pete Petrash
