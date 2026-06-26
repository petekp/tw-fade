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
- **Composable.** Direction, size, reveal distance, and clear zones are separate utilities.
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

<!-- Tune the band and reveal distance -->
<div class="fade-y fade-size-lg fade-reveal-xl h-80 overflow-y-auto">...</div>
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

`start` and `end` follow semantic reading direction for horizontal scrollers. In LTR, start is the left side and end is the right side. In RTL, start is the right side and end is the left side. Use the HTML `dir` attribute on the scroll container or an ancestor; a CSS-only `direction: rtl` rule does not trigger RTL routing.

Vertical names stay plain because they are not affected by text direction.

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

## Reveal Distance

Reveal distance controls how much scroll travel is used to bring a fade in or out.

| Utility | Affects |
| --- | --- |
| `fade-reveal-*` | all selected edges |

```html
<div class="fade-y fade-reveal-sm overflow-y-auto">...</div>
<div class="fade-y fade-reveal-[80px] overflow-y-auto">...</div>
```

A smaller reveal distance snaps the fade in faster. A larger distance eases it over more scroll.

The named reveal scale is the same as the size scale and can be overridden with `--fade-reveal-{step}`. Arbitrary reveal values are source-path only.

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
| Named size/reveal/clear utilities | yes | yes |
| `fade-clear-*-var` | yes | yes |
| Arbitrary values like `fade-size-[6rem]` | yes | no |
| Integer clear values like `fade-clear-top-14` | yes | no |

The prebuilt file is generated from an explicit safelist. It does not include Tailwind Preflight, core Tailwind utilities, arbitrary values, or integer `fade-size-*` classes.

## Exports

| Specifier | Resolves to |
| --- | --- |
| `tw-fade` | `./src/tw-fade.css` |
| `tw-fade/css` | `./dist/tw-fade.css` |
| `tw-fade/dist/tw-fade.css` | `./dist/tw-fade.css` |

`tailwindcss >=4.0.0` is an optional peer dependency. You need it for the source path, but not for the prebuilt CSS.

## How It Works

Each faded element gets a four-layer `mask-image`, one layer per physical edge. Inactive layers fall back to an opaque identity mask. Active layers use a 13-stop eased gradient.

The public API uses plain direction names, but the internal engine still keeps four physical edge amounts. Those internal properties are typed numbers, do not inherit, and are driven by scroll animations. Keeping the engine physical makes the mask predictable; the public `start` and `end` utilities route to the correct physical side for LTR or RTL.

Inside browsers with scroll-driven animation support:

- vertical fades use `scroll(self y)`;
- horizontal fades use `scroll(self inline)`;
- leading edges reveal from `0` to `1` near the start of scroll;
- trailing edges retract from `1` to `0` near the end of scroll.

If an axis cannot scroll, that axis stays at `0`, so the fade does not show. This is intentional.

In browsers without scroll-driven animations, selected fades pin fully on as a static fallback.

The supported public surface is the `fade-*` utilities and the public `--fade-*` tokens described above. Treat `--tw-fade-*` as internal implementation detail.

## RTL

Horizontal fades are direction-aware:

```html
<div dir="rtl" class="fade-start overflow-x-auto">...</div>
```

In that example, `fade-start` selects the right edge because the scroll container is RTL. `fade-end` selects the left edge. `fade-x` selects both.

RTL routing follows semantic direction through `dir`, not a CSS-only `direction: rtl` declaration.

Vertical fades are unchanged by text direction.

## Accessibility

`tw-fade` is visual only. It does not move content, add scroll behavior, or change focus order. Like any edge fade, it lowers contrast near the masked edge, so keep band sizes modest and use clear zones for sticky controls or critical text.

## Browser Support

Two CSS features matter:

- CSS masking: available in current evergreen browsers.
- Scroll-driven animations: available in Chromium and current WebKit; Firefox release gets the static fallback.

Browsers without scroll-driven animations still render selected fades, but they render them as always-on static fades.

## Migrating

See [MIGRATING.md](./MIGRATING.md) for the breaking rename map.

## Development

```bash
npm test
npm run build
npm run build:demo
npm run verify
```
