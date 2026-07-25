# tw-fade

Scroll-aware edge fades for Tailwind CSS v4. Mask the edges of any scroll container so content dissolves into the surface behind it. All CSS. No runtime JavaScript.

**[Live demo](https://pete.design/tw-fade)**

```html
<div class="fade-y h-64 overflow-y-auto">
  <!-- long content; top and bottom fade as you scroll -->
</div>
```

The fade appears only when there is content beyond that edge, then recedes again when you reach the start or end.

## Why

A static gradient overlay is always on. It dims content even when nothing is hidden beyond the edge, and it sits in front of your content as another layer.

`tw-fade` uses a CSS mask on the scroll container itself:

- **Scroll-aware.** The fade is gated by the element's own scroll position.
- **No extra DOM.** The mask lives on the scroll container.
- **Surface-neutral.** The mask reveals whatever is behind the element instead of painting a fake background color.
- **Composable.** Direction, size, travel distance, and clear zones are separate utilities.
- **Graceful fallback.** Browsers without scroll-driven animations get a static fade instead of a broken mask.

## Install

### Tailwind v4 source path

Use this when your app already builds with Tailwind v4. This path supports arbitrary values like `fade-size-[2rem]`.

```bash
npm install tw-fade
```

```css
@import "tailwindcss";
@import "tw-fade";
```

### Prebuilt CSS

Use this for plain HTML, CDN usage, or bundlers that import CSS directly.

```html
<link rel="stylesheet" href="https://unpkg.com/tw-fade@0.7.0/dist/tw-fade.css" />
```

```js
import "tw-fade/css";
```

The prebuilt file includes only the named utility set. Arbitrary bracket values need Tailwind's source path.

If you use an unversioned CDN URL, you receive the latest package and any breaking API changes that come with it. Pin a version when you need stable HTML.

## Usage

Put the fade utility on the element that actually scrolls.

```html
<!-- Top and bottom -->
<div class="fade-y h-80 overflow-y-auto">...</div>

<!-- All four edges -->
<div class="fade h-80 overflow-auto">...</div>

<!-- Horizontal rail, direction-aware -->
<div class="fade-x overflow-x-auto">...</div>

<!-- Compose single edges -->
<div class="fade-top fade-end h-80 overflow-auto">...</div>

<!-- Tune the band and travel distance -->
<div class="fade-y fade-size-lg fade-travel-xl h-80 overflow-y-auto">...</div>
```

## Direction Utilities

| Utility | Edges |
| --- | --- |
| `fade` | all four edges |
| `fade-y` | top + bottom |
| `fade-top` | top |
| `fade-bottom` | bottom |
| `fade-x` | horizontal start + horizontal end |
| `fade-start` | horizontal start |
| `fade-end` | horizontal end |

`start` and `end` are **horizontal only** and follow semantic reading direction. In LTR, start is the left edge and end is the right edge; in RTL, start is the right edge and end is the left edge. For the top or bottom edge use `fade-top` / `fade-bottom` — there is no `fade-block-start`. Use the HTML `dir` attribute on the scroll container or an ancestor; a CSS-only `direction: rtl` rule does not trigger RTL routing.

Vertical names stay physical (`top` / `bottom`) because the block axis is not affected by text direction. This split — physical vertical, direction-aware horizontal — mirrors how Tailwind itself ships physical `top`/`bottom` insets alongside logical `ps`/`pe`. See [Why plain directions](./MIGRATING.md#why-plain-directions) for the naming rationale.

## Size

Size controls how thick the fade band is.

| Utility | Affects |
| --- | --- |
| `fade-size-*` | all edges |
| `fade-size-y-*` | top + bottom |
| `fade-size-x-*` | start + end |
| `fade-size-top-*` | top |
| `fade-size-bottom-*` | bottom |
| `fade-size-start-*` | horizontal start |
| `fade-size-end-*` | horizontal end |

```html
<div class="fade fade-size-md fade-size-top-2xl overflow-auto">...</div>
```

Resolution is edge, then axis, then global, then the default. For example, top uses `fade-size-top-*` first, then `fade-size-y-*`, then `fade-size-*`.

The default size is capped at `min(12%, 3rem)`, so small scroll areas do not get swallowed by the fade. Named sizes derive from Tailwind's spacing unit, `--spacing`, with `0.25rem` as the fallback.

| Step | Value | Step | Value |
| --- | --- | --- | --- |
| `xs` | `1.5rem` | `xl` | `5rem` |
| `sm` | `2rem` | `2xl` | `6rem` |
| `md` | `3rem` | `3xl` | `8rem` |
| `lg` | `4rem` | `4xl` | `10rem` |

You can override the tokens:

```css
@theme {
  --fade-size-md: 2.5rem;
}
```

On the Tailwind source path, size accepts named values, lengths, and percentages:

```html
<div class="fade-y fade-size-[15%]">...</div>
```

The prebuilt CSS includes the named sizes only.

## Travel Distance

Travel distance controls how far you scroll before the soft band eases open to its full width.

| Utility | Affects |
| --- | --- |
| `fade-travel-*` | all selected edges |

```html
<div class="fade-y fade-travel-sm overflow-y-auto">...</div>
<div class="fade-y fade-travel-[80px] overflow-y-auto">...</div>
```

A smaller travel distance opens the band faster; a larger one eases it over more scroll. Either way the **edge is masked almost immediately** — the band's transparency saturates within `travel ÷ 8` of scroll, so content is never hard-clipped at the scroll edge while the band is still widening. The travel is purely the cosmetic open-speed; it is safe at any size.

The named travel scale is the same as the size scale (default `sm`) and can be overridden with `--fade-travel-{step}`. Arbitrary travel values are source-path only. To change how fast the edge itself goes transparent, set `--tw-fade-onset` (default `8`; higher = snappier).

## Clear Zones

Clear zones keep a fully opaque strip before the fade starts. Use them for sticky headers, sticky footers, or fixed controls inside the scroll container.

| Utility | Affects |
| --- | --- |
| `fade-clear-*` | all edges |
| `fade-clear-y-*` | top + bottom |
| `fade-clear-x-*` | start + end |
| `fade-clear-top-*` | top |
| `fade-clear-bottom-*` | bottom |
| `fade-clear-start-*` | horizontal start |
| `fade-clear-end-*` | horizontal end |

```html
<div class="fade-top fade-clear-top-[56px] h-80 overflow-y-auto">
  <header class="sticky top-0 h-14">...</header>
  ...
</div>
```

Clear utilities accept named values, lengths, percentages, and bare integers on the Tailwind source path. A bare integer maps to `--spacing * N`, so `fade-clear-top-4` is `1rem` with the default spacing unit.

The prebuilt CSS includes named clear values and `-var` forms, not arbitrary values or integer forms.

### Dynamic Clear Zones

Use `-var` when the clear zone depends on runtime layout:

```html
<div class="fade-top fade-clear-top-var" style="--fade-clear-top: 56px">
  ...
</div>
```

Available forms:

```txt
fade-clear-var
fade-clear-y-var
fade-clear-x-var
fade-clear-top-var
fade-clear-bottom-var
fade-clear-start-var
fade-clear-end-var
```

The fallback chain is edge, then axis, then global, then `0px`.

```css
--fade-clear-top: 56px;
--fade-clear-y: 24px;
--fade-clear: 0px;
```

## Force Or Disable A Fade

These utilities change only the active fade amount. They do not select edges on their own, so pair them with a direction utility.

| Utility | Effect |
| --- | --- |
| `fade-none` | disables all selected fades |
| `fade-none-y` | disables selected vertical fades |
| `fade-none-x` | disables selected horizontal fades |
| `fade-always` | pins all selected fades fully on |
| `fade-always-y` | pins selected vertical fades fully on |
| `fade-always-x` | pins selected horizontal fades fully on |

```html
<div class="fade-y fade-always-y overflow-y-auto">...</div>
<div class="fade fade-none-x overflow-auto">...</div>
```

## Scrollbars

The fade is a mask on the scroll container, and a mask can't distinguish content from the container's own scrollbar. Whether that matters depends on how the browser paints the scrollbar:

- **Overlay scrollbars** — the default on macOS, iOS, and Android — paint in a separate layer on top of the element, so the mask never touches them. Nothing to do.
- **Classic (space-consuming) scrollbars** — the default on Windows and Linux, on macOS with *Show scroll bars → Always*, and any bar you style with `::-webkit-scrollbar` — paint inside the element's box, so the fade dims the scrollbar's ends along with the content.

If the container doesn't need a visible scrollbar, the shortest fix is to remove it — Tailwind's `scrollbar-none` (or `scrollbar-width: none`) takes the bar out of the box entirely and there is nothing left to fade. Reach for that first; it costs nothing and works everywhere.

When you *do* want the bar visible, add the `fade-scrollbar-safe-*` class for the axis you scroll. It shields the scrollbar's column with an opaque strip in the mask, so the content still fades while the scrollbar stays fully opaque.

| Utility | Effect |
| --- | --- |
| `fade-scrollbar-safe-y` | shields the **vertical** bar (from scrolling on y) |
| `fade-scrollbar-safe-x` | shields the **horizontal** bar (from scrolling on x) |
| `fade-scrollbar-safe-xy` | both |
| `fade-scrollbar-width-sm\|md\|lg` | sets the bar width: `11px` / `15px` (default) / `17px` |

**The suffix is the scroll axis, not the faded edge.** `-y` follows `overflow-y` — it's the vertical bar at the inline end. It deliberately does *not* follow this plugin's own `fade-y` (top + bottom edges). In practice the two agree, which is why it reads cleanly:

```html
<div class="overflow-y-auto fade-y fade-scrollbar-safe-y">...</div>
```

Match the class to the axis that actually scrolls. Putting `-y` on a horizontal-only scroller reserves a gutter for a vertical bar that never appears, and the strip then lands on your content — a bright notch at the fading edge. `-x` is the correct class there, and it reserves nothing.

`fade-scrollbar-width-*` is a setter, not a switch — on its own it turns nothing on. It also inherits, so the usual place for it is an ancestor:

```html
<body class="fade-scrollbar-width-lg">
  <!-- every opted-in container below picks up 17px -->
</body>
```

The named widths come from the `--fade-scrollbar-width-*` theme namespace and override like any other token:

```css
@theme {
  --fade-scrollbar-width-md: 13px;
}
```

On the Tailwind source path the utility also takes any length — `fade-scrollbar-width-[13px]`. A bare integer is deliberately rejected: everywhere else in this plugin an integer means spacing steps, and here it would have to mean pixels.

### The trade it makes

For the strip to line up with the scrollbar, the plugin has to know the bar's width — and CSS gives it no way to ask. The reserved gutter sits *inside* every box the mask can reference, so no `mask-clip` value excludes it; container query units can measure it but only descendants can read them, and the mask is on the container itself.

So `fade-scrollbar-safe-*` doesn't measure the bar, it **declares** it. It pins the bar via `::-webkit-scrollbar` and sizes the strip from the same custom property, which makes them equal by construction rather than by luck — including under page zoom, where a native bar's width in CSS px drifts but two declared lengths scale together.

The cost: pinning the bar makes it **classic on every platform**, including macOS, where you'd otherwise get an overlay bar and no bug at all. Apply it when your users see classic scrollbars, or when you want a consistent bar everywhere — not by default.

It also fixes a quieter symptom of the same root cause. Mask percentages resolve against a box that includes the gutter, while content stops at the scrollport edge, so an inline-end fade authored to reach transparent at `100%` reaches it *inside the gutter* — over real content it never finishes. How badly depends on the ratio: with a 15px bar the last content pixel measured 40/255 opaque under a 60px band, and 161/255 under a 26px one — the tighter the band, the larger the share of it spent inside the gutter. Pinning the width lets the plugin inset that layer so the ramp lands on the content edge instead (0/255 and 1/255 respectively).

### Styling

The reserved gutter shouldn't read as a separate panel, so the utility also gives the bar a **transparent track** and a subtle thumb derived from the container's `currentColor` (adapts to light and dark). Knobs:

- `--tw-fade-scrollbar-thumb` — the thumb color. Defaults to `color-mix(in srgb, currentColor 30%, transparent)`.
- `--tw-fade-scrollbar-width` — what `fade-scrollbar-width-*` sets, for a value off the scale. Defaults to `15px`, matching a macOS classic bar. Set this rather than `--tw-fade-scrollbar`: it drives the bar and the strip together, so they can't disagree. The pin *replaces* the native bar rather than decorating it, so this is your users' actual hit target — going much below native trades pointer accuracy for looks.

```html
<div class="fade-y fade-scrollbar-safe-y overflow-y-auto" style="--tw-fade-scrollbar-thumb: #888">...</div>
```

Do **not** set `scrollbar-width` or `scrollbar-color` on a `fade-scrollbar-safe-*` container — including via Tailwind's own `scrollbar-thin`, `scrollbar-auto`, `scrollbar-none`, `scrollbar-thumb-*`, and `scrollbar-track-*`. Either property makes Blink discard `::-webkit-scrollbar` styling entirely (`scrollbar-width` does the same in WebKit), which cancels the pin and takes the gutter to `0` — leaving a 15px opaque strip sitting on your content. Use `fade-scrollbar-width-*` for the size, and `::-webkit-scrollbar-track` / `::-webkit-scrollbar-thumb` for the colors.

### Limits

- RTL is handled automatically — the strip follows the vertical bar to the inline-start edge.
- **Pinning the bar is per-element, not per-axis.** Opting in makes *both* bars classic, so a container that scrolls both ways gets a classic horizontal bar whether or not you asked for one — which is why `-xy` exists, and why the axis suffix is worth getting right. The block strip can't just be on by default: unlike the inline gutter, the block gutter is only reserved when content actually overflows horizontally, so a blind block strip would slab an opaque band over content on every vertical-only scroller.
- **Firefox is not covered.** It ignores `::-webkit-scrollbar`, so its bar can't be pinned, and whether it's using overlay or classic bars can't be detected either. A guessed strip would be right on Windows/Linux and an opaque slab over content on macOS, with no way to tell which — and a missed strip damages content, while the bug it prevents only dims chrome. Firefox gets a thin styled bar and no strip.
- **In Safari, a container that isn't currently overflowing on the block axis has no gutter** (WebKit doesn't honor `scrollbar-gutter: stable`'s reserve-anyway behavior for custom bars), so the inline strip lands on content — an opaque band exactly where the fade just finished. It shows when such a container is faded anyway: with `fade-always*`, or with a live fade on the *other* axis (a two-axis scroller currently overflowing only horizontally). **Fix it with `overflow-y-scroll` instead of `overflow-y-auto`** — a permanent bar means a permanent gutter, in WebKit too (measured: 15px reserved, strip landing exactly on the track). Or apply the class only on a state that actually overflows.
- **The whole opt-in requires scroll-driven animations, and stands down without them.** On Safari 17.x / 18.x and on release Firefox, the plugin falls back to pinning fades on regardless of overflow — and a faded container with no overflow is precisely the case above. Rather than shield a bar on those engines, the utility declines to pin one, so they keep their native scrollbars: overlay on macOS, which the mask never touches. Pinning without shielding would be worse than not opting in at all — it manufactures a space-consuming bar and then lets the fade dim it.
- On overlay-scrollbar platforms the bar already paints above the mask and is never faded, so nothing is needed there — the utility trades that away deliberately in exchange for a bar it can shield exactly.

## Fading The Whole Page

Fade the element that scrolls. For a full-page fade, make `<body>` the scroll container and keep the surface behind it on `<html>`.

```html
<html class="h-full overflow-hidden bg-neutral-950">
  <body class="fade-y h-full overflow-y-auto bg-transparent">
    ...
  </body>
</html>
```

Two details matter:

1. `<body>` must have a fixed height and `overflow-y-auto`, otherwise the viewport scrolls instead.
2. The scroll container should be transparent if you want the mask to reveal the page surface behind it.

## Source Path Vs. Prebuilt

| | `@import "tw-fade"` | `tw-fade/css` |
| --- | --- | --- |
| Needs Tailwind v4 | yes | no |
| Direction utilities | yes | yes |
| Named size/travel/clear utilities | yes | yes |
| `fade-scrollbar-safe-*` and named `fade-scrollbar-width-*` | yes | yes |
| `fade-clear-*-var` | yes | yes |
| Arbitrary values like `fade-size-[6rem]` | yes | no |
| Integer clear values like `fade-clear-top-14` | yes | no |

The prebuilt file is generated from an explicit safelist. It does not include Tailwind Preflight, core Tailwind utilities, arbitrary values, or integer `fade-clear-*` classes.

## Exports

| Specifier | Resolves to |
| --- | --- |
| `tw-fade` | `./src/tw-fade.css` |
| `tw-fade/css` | `./dist/tw-fade.css` |
| `tw-fade/dist/tw-fade.css` | `./dist/tw-fade.css` |

`tailwindcss >=4.0.0` is an optional peer dependency. You need it for the source path, but not for the prebuilt CSS.

## How It Works

Each faded element gets a six-layer `mask-image`: four edge gradients, one per physical edge, combined with `intersect`, plus two scrollbar-shield strips unioned in front of them with `add`. Inactive edge layers fall back to an opaque identity mask; active ones use a 13-stop eased gradient. The strips are `0px` by default and inert — a union can only raise opacity — until a [`fade-scrollbar-safe-*`](#scrollbars) class widens one.

The public API uses plain direction names, but the internal engine still keeps four physical edge amounts. Those internal properties are typed numbers, do not inherit, and are driven by scroll animations. Keeping the engine physical makes the mask predictable; the public `start` and `end` utilities route to the correct physical side for LTR or RTL in browsers that support the `:dir()` selector (see [Browser Support](#browser-support)).

Inside browsers with scroll-driven animation support:

- vertical fades use `scroll(self y)`;
- horizontal fades use `scroll(self inline)`;
- leading edges reveal from `0` to `1` near the start of scroll;
- trailing edges retract from `1` to `0` near the end of scroll.

If an axis cannot scroll, that axis stays at `0`, so the fade does not show. This is intentional.

In browsers without scroll-driven animations, selected fades pin fully on as a static fallback.

### Dynamic content on a stable scrollport

If you replace the contents of a faded scrollport without replacing the scrollport itself, the browser has to invalidate the element's scroll-driven animation state. For example: a tabbed mobile list keeps one `.fade-y` node mounted, scrolls a long tab, then swaps in a short tab whose content no longer overflows.

Current `tw-fade` mitigates this in Chromium. The expected post-swap state is:

- `scrollTop` / `scrollLeft` is clamped back to `0`;
- the axis no longer overflows;
- the selected fade amounts return to `0`.

WebKit can still retain a stale sampled scroll-animation value in this exact shape, especially after collapsing content from the bottom/end of the scroll range. If a user reports a fade that stays visible after a content swap, advise them in this order:

1. Upgrade to the latest `tw-fade`.
2. Key/remount the scrollport by content identity when practical.
3. If remounting is awkward, restart the fade animation after the content swap.
4. If the app already knows the content cannot overflow, add `fade-none-y` or `fade-none-x` for that state.

React remount pattern:

```tsx
<div key={activeTabId} className="fade-y overflow-y-auto">
  {items.map((item) => (
    <ListItem key={item.id} item={item} />
  ))}
</div>
```

Animation reset helper:

```js
function resetTwFade(el) {
  const previous = el.style.animation
  el.style.animation = 'none'
  void el.offsetHeight
  requestAnimationFrame(() => {
    el.style.animation = previous
  })
}
```

React reset pattern:

```tsx
const scrollRef = useRef(null)

useLayoutEffect(() => {
  if (scrollRef.current) resetTwFade(scrollRef.current)
}, [activeTabId])

return (
  <div ref={scrollRef} className="fade-y overflow-y-auto">
    {items.map((item) => (
      <ListItem key={item.id} item={item} />
    ))}
  </div>
)
```

Known no-overflow escape hatch:

```tsx
<div className={canOverflow ? 'fade-y overflow-y-auto' : 'fade-y fade-none-y overflow-y-auto'}>
  {items.map((item) => (
    <ListItem key={item.id} item={item} />
  ))}
</div>
```

The supported public surface is the `fade-*` utilities, the public `--fade-*` theme tokens described above (`--fade-size-*`, `--fade-travel-*`, `--fade-clear-*`, `--fade-scrollbar-width-*`), and three author knobs: `--tw-fade-onset` (the edge-speed knob under [Travel Distance](#travel-distance)) plus `--tw-fade-scrollbar-width` and `--tw-fade-scrollbar-thumb` (both under [Scrollbars](#scrollbars)). Treat the rest of the `--tw-fade-*` namespace — including `--tw-fade-scrollbar` and `--tw-fade-scrollbar-block` — as internal implementation detail.

## RTL

Horizontal fades are direction-aware:

```html
<div dir="rtl" class="fade-start overflow-x-auto">...</div>
```

In that example, `fade-start` selects the right edge because the scroll container is RTL. `fade-end` selects the left edge. `fade-x` selects both.

RTL routing follows semantic direction through `dir`, not a CSS-only `direction: rtl` declaration. It relies on the `:dir()` selector, so on the narrow band of Chromium that supports scroll-driven animations but not `:dir()` (Chrome 115–119), RTL scrollers fall back to LTR edge mapping — see [Browser Support](#browser-support). LTR is unaffected.

Vertical fades are unchanged by text direction.

## Accessibility

`tw-fade` is visual only. It does not move content, add scroll behavior, or change focus order. Like any edge fade, it lowers contrast near the masked edge, so keep band sizes modest and use clear zones for sticky controls or critical text.

## Browser Support

Three CSS features carry different support floors:

- **CSS masking** (`mask-image`, `mask-composite`). Interoperable across current evergreen browsers.
- **Scroll-driven animations** (`animation-timeline: scroll()`). Shipped by default in every major engine except Firefox release.
- **The `:dir()` selector**, used to route `start` / `end` to the correct physical edge under RTL.

| Engine | Masking | Scroll-driven animation | `:dir()` | Result |
| --- | --- | --- | --- | --- |
| Chrome / Edge | 120+ | 115+ | 120+ | Full scroll-gated, direction-aware fade |
| Safari (WebKit) | 15.4+ | 26.0+ | 16.4+ | Full on 26+; static fade fallback below |
| Firefox (release) | 53+ | not by default | 49+ | Static always-on fade |

**Scroll-driven fallback.** Browsers without scroll-driven animations still render selected fades, but as always-on static fades. Safari 17.x / 18.x and Firefox release get this fallback (Firefox keeps scroll-driven animations behind a flag, default-on only in Nightly).

**RTL routing floor.** Direction-aware `start` / `end` routing additionally needs `:dir()`. On the narrow band of Chromium that has scroll-driven animations but not `:dir()` (Chrome 115–119), RTL scrollers fall back to LTR physical-edge mapping — the fade still renders, but `start` / `end` map to the wrong side. LTR is unaffected, and that band is effectively gone on auto-updating Chromium.

**Older WebKit** may also need `-webkit-mask-*`; run the prebuilt CSS through Autoprefixer if you target it.

## Migrating

Upgrading from `0.6.x`? [MIGRATING.md](./MIGRATING.md) is written as a step-by-step
procedure you can hand straight to a coding agent ("upgrade this project to tw-fade
0.7.0 using MIGRATING.md") — ordered renames, the physical→logical RTL caveats to
review by hand, and a one-line grep to verify nothing was missed. It reads fine for
humans too.

## Development

```bash
npm test
npm run build
npm run build:demo
npm run verify
```
