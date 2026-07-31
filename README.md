# tw-fade

Scroll-aware edge fades for Tailwind CSS v4. Add a utility to a scroll container. The fade appears while content remains beyond an edge and clears when you reach it.

**[Live demo](https://pete.design/tw-fade)**

```html
<div class="fade-y h-64 overflow-y-auto">
  <!-- long content; top and bottom fade as you scroll -->
</div>
```

`tw-fade` masks the scroll container itself, so your existing surface shows through. It requires no wrapper or runtime JavaScript. You can compose direction, size, travel, and clear-zone utilities. Browsers without scroll-driven animations show a static fade.

## Install

### Tailwind v4 source path

Use the source path in a Tailwind v4 app. It supports bracket values such as `fade-size-[2rem]`.

```bash
npm install tw-fade
```

```css
@import "tailwindcss";
@import "tw-fade";
```

### Prebuilt CSS

Use the prebuilt file with plain HTML, a CDN, or a bundler that imports CSS.

```html
<link rel="stylesheet" href="https://unpkg.com/tw-fade@0.8.0/dist/tw-fade.css" />
```

```js
import "tw-fade/css";
```

The prebuilt file contains the named utility set. Bracket values require Tailwind's source path. Pin CDN imports to a version to avoid breaking changes.

## Usage

Apply the fade utility to the scrolling element.

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

`start` and `end` name horizontal edges and follow the HTML `dir` attribute. In LTR, start is left and end is right. RTL reverses them. `top` and `bottom` stay physical.

Set `dir` on the scroll container or an ancestor. A CSS `direction: rtl` rule does not trigger RTL routing. See [Why plain directions](./MIGRATING.md#why-plain-directions) for the naming rationale.

```html
<div dir="rtl" class="fade-start overflow-x-auto">...</div>
```

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

Size precedence runs from edge to axis to global to default. For example, `fade-size-top-*` overrides `fade-size-y-*`, which overrides `fade-size-*`.

`tw-fade` caps the default at `min(12%, 3rem)`. Named sizes use Tailwind's `--spacing` token, with `0.25rem` as the fallback.

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

The source path accepts named values, lengths, and percentages, including `fade-size-[15%]`.

## Travel Distance

`fade-travel-*` controls how far you scroll before the band reaches full width.

```html
<div class="fade-y fade-travel-sm overflow-y-auto">...</div>
<div class="fade-y fade-travel-[80px] overflow-y-auto">...</div>
```

Smaller values open the band sooner. The edge reaches full transparency after about `travel ÷ 8` while the band continues to widen. Set `--tw-fade-onset` to change that ratio; the default is `8`. Higher values make the edge transparent sooner.

Travel uses the same named steps as size through its own `--fade-travel-*` tokens, and defaults to `sm`. The source path also accepts bracket values such as `fade-travel-[80px]`.

## Clear Zones

Clear zones keep an opaque strip before the fade starts. Use them for sticky headers, sticky footers, or fixed controls inside the scroll container.

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

The source path accepts named values, lengths, percentages, and bare integers. An integer uses `--spacing * N`, so `fade-clear-top-4` resolves to `1rem` with the default spacing unit.

### Dynamic Clear Zones

Append `-var` when the clear zone depends on runtime layout:

```html
<div class="fade-top fade-clear-top-var" style="--fade-clear-top: 56px">
  ...
</div>
```

Use `fade-clear-var`, an axis form such as `fade-clear-y-var`, or an edge form such as `fade-clear-top-var`. Values fall back from edge to axis to global to `0px`.

```css
--fade-clear-top: 56px;
--fade-clear-y: 24px;
--fade-clear: 0px;
```

## Force Or Disable A Fade

These utilities set active fade amounts. Pair them with a direction utility because they do not select edges.

| Utility | Effect |
| --- | --- |
| `fade-none` | disables all selected fades |
| `fade-none-y` | disables selected vertical fades |
| `fade-none-x` | disables selected horizontal fades |
| `fade-always` | pins all selected fades at full strength |
| `fade-always-y` | pins selected vertical fades at full strength |
| `fade-always-x` | pins selected horizontal fades at full strength |

```html
<div class="fade-y fade-always-y overflow-y-auto">...</div>
<div class="fade fade-none-x overflow-auto">...</div>
```

## Scrollbars

Classic scrollbars sit inside the scroll container's box, so the mask can fade their ends. Overlay scrollbars on macOS, iOS, and Android paint above the mask and need no change.

If you can hide the scrollbar, use `scrollbar-none` or `scrollbar-width: none`. To keep a classic scrollbar visible, add a `fade-scrollbar-safe-*` class for the scroll axis:

| Utility | Effect |
| --- | --- |
| `fade-scrollbar-safe-y` | shields the vertical bar |
| `fade-scrollbar-safe-x` | shields the horizontal bar |
| `fade-scrollbar-safe-xy` | shields both bars |
| `fade-scrollbar-width-sm\|md\|lg` | sets `11px`, `15px` (default), or `17px` |

Choose the suffix from the scroll axis. Use `-y` with `overflow-y` and `-x` with `overflow-x`:

```html
<div class="overflow-y-auto fade-y fade-scrollbar-safe-y">...</div>
```

The wrong suffix can place the opaque shield over content.

`fade-scrollbar-width-*` sets an opted-in scroller's width and inherits, so you can place it on the scroller or an ancestor. It does not enable protection by itself:

```html
<body class="fade-scrollbar-width-lg">
  <!-- protected descendants use 17px bars -->
</body>
```

Override named widths through the `--fade-scrollbar-width-*` theme tokens. The source path accepts lengths such as `fade-scrollbar-width-[13px]`; bare integers do not compile. The plugin clamps negative widths to `0px`.

In Blink and WebKit, the safe utilities pin the scrollbar width and add a mask strip of the same size. The pin applies to the element, so both scrollbar axes become classic, including on macOS. The vertical strip follows the bar under RTL.

Use `--tw-fade-scrollbar-width` for a custom width and `--tw-fade-scrollbar-thumb` for the thumb color:

```html
<div class="fade-y fade-scrollbar-safe-y overflow-y-auto" style="--tw-fade-scrollbar-thumb: #888">...</div>
```

Do not combine a safe utility with `scrollbar-width`, `scrollbar-color`, or Tailwind's `scrollbar-thin`, `scrollbar-auto`, `scrollbar-none`, `scrollbar-thumb-*`, and `scrollbar-track-*` utilities. Both properties cancel the pin in Blink; `scrollbar-width` also cancels it in WebKit. The mask strip remains in place. Use `fade-scrollbar-width-*` for size and `::-webkit-scrollbar-track` or `::-webkit-scrollbar-thumb` for colors.

### Limits

- Firefox ignores `::-webkit-scrollbar`, so the safe utilities cannot shield its bars.
- Safari can place the vertical shield over content when `overflow-y-auto` has no vertical overflow. Use `overflow-y-scroll` or add `fade-scrollbar-safe-y` when vertical overflow exists.
- The safe utilities require scroll-driven animations. They leave native scrollbars unchanged in Safari 17.x, Safari 18.x, and Firefox release.

## Fading The Whole Page

Fade the element that scrolls. For a full-page fade, make `<body>` the scroll container and keep the surface behind it on `<html>`.

```html
<html class="h-full overflow-hidden bg-neutral-950">
  <body class="fade-y h-full overflow-y-auto bg-transparent">
    ...
  </body>
</html>
```

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

The release build generates the prebuilt file from an explicit safelist. It excludes Tailwind Preflight, core Tailwind utilities, arbitrary values, and integer `fade-clear-*` classes.

## Exports

| Specifier | Resolves to |
| --- | --- |
| `tw-fade` | `./src/tw-fade.css` |
| `tw-fade/css` | `./dist/tw-fade.css` |
| `tw-fade/dist/tw-fade.css` | `./dist/tw-fade.css` |

`tailwindcss >=4.0.0` is an optional peer dependency. You need it for the source path, but not for the prebuilt CSS.

## How It Works

Each faded element uses four gradient mask layers and two dormant scrollbar-shield strips. Scroll timelines drive the physical edge layers with `scroll(self y)` and `scroll(self inline)`. The `:dir()` selector routes `start` and `end` to the correct horizontal layer.

An edge amount stays at `0` when its axis cannot scroll. Browsers without scroll-driven animations pin selected fades on as a static fallback.

### Dynamic content on a stable scrollport

WebKit can retain a stale fade when a mounted scrollport swaps long content for short content. The common case starts with the scroll position at the end. Try these fixes in order:

1. Upgrade to the latest `tw-fade`.
2. Remount or key the scrollport by content identity.
3. Restart the fade animation after the content swap.
4. Add `fade-none-y` or `fade-none-x` when your app knows that axis cannot overflow.

```tsx
<div key={activeTabId} className="fade-y overflow-y-auto">
  {items.map((item) => (
    <ListItem key={item.id} item={item} />
  ))}
</div>
```

Use this helper after the DOM update when remounting would discard useful element state:

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

The public CSS API includes the `fade-*` utilities and the `--fade-size-*`, `--fade-travel-*`, `--fade-clear-*`, and `--fade-scrollbar-width-*` theme tokens. The three author properties are `--tw-fade-onset`, `--tw-fade-scrollbar-width`, and `--tw-fade-scrollbar-thumb`. Treat other `--tw-fade-*` properties as internal.

## Accessibility

`tw-fade` changes appearance without moving content or changing focus order. Masking lowers contrast near an edge, so use modest bands and clear zones around controls or critical text.

## Browser Support

| Engine | Masking | Scroll-driven animation | `:dir()` | Result |
| --- | --- | --- | --- | --- |
| Chrome / Edge | 120+ | 115+ | 120+ | Full scroll-gated, direction-aware fade |
| Safari (WebKit) | 15.4+ | 26.0+ | 16.4+ | Full on 26+; static fade fallback below |
| Firefox (release) | 53+ | not by default | 49+ | Static always-on fade |

Browsers without scroll-driven animations render selected fades as static, always-on masks. Safari 17.x, Safari 18.x, and Firefox release use this fallback.

Chrome 115 through 119 map RTL `start` and `end` to LTR edges. LTR scrollers are unaffected.

Older WebKit may need `-webkit-mask-*`. Run the prebuilt CSS through Autoprefixer if you support it.

## Migrating

Upgrading from `0.6.x`? Follow [MIGRATING.md](./MIGRATING.md) for the `0.7.0` renames and RTL checks.

## Development

```bash
npm test
npm run build
npm run build:demo
npm run verify
```
