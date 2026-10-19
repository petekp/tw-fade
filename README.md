# tw-fade

Scroll-aware opacity fades and edge blur for Tailwind CSS v4. Select either effect, or combine them. Each appears while content remains beyond an edge and clears when you reach it.

Version `0.10.0` introduces the frame renderer for blur. Existing blur users need the [frame migration](./MIGRATING.md#containing-existing-blur-scrollers). Opacity-only usage is unchanged.

**[Live demo](https://pete.design/tw-fade)**

```html
<div class="fade-y h-64 overflow-y-auto">
  <!-- long content; top and bottom fade as you scroll -->
</div>
```

Apply opacity-only classes to the scroll container. Opacity fading reveals your existing surface and needs no wrapper. Blur softens content near its selected edges and requires a [containing wrapper](#blur-setup). Both effects are CSS-only. Size, travel, and clear-zone settings are shared. Browsers without scroll-driven animations retain static opacity fading and omit blur.

## Install

### Tailwind v4 source path

Use the source path in a Tailwind v4 app. It generates responsive and state variants, plus bracket values such as `fade-size-[2rem]`.

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
<link rel="stylesheet" href="https://unpkg.com/tw-fade@0.10.0/dist/tw-fade.css" />
```

```js
import "tw-fade/css";
```

The prebuilt file contains the named, unprefixed utility set. Variants and bracket values require Tailwind's source path. Pin CDN imports to a version to avoid breaking changes.

## Usage

Apply opacity-only selectors to the scrolling element. For blur or combined effects, put the selectors and configuration on `fade-blur-frame`; its first child is the scroller.

| Intent | Classes |
| --- | --- |
| Vertical opacity fade | `fade-y` |
| Vertical blur | `fade-blur-y` |
| Both effects vertically | `fade-y fade-blur-y` |
| Top blur and bottom opacity fade | `fade-blur-top fade-bottom` |

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

| Opacity selector | Blur selector | Edges |
| --- | --- | --- |
| `fade` | `fade-blur` | all four edges |
| `fade-y` | `fade-blur-y` | top + bottom |
| `fade-top` | `fade-blur-top` | top |
| `fade-bottom` | `fade-blur-bottom` | bottom |
| `fade-x` | `fade-blur-x` | horizontal start + horizontal end |
| `fade-start` | `fade-blur-start` | horizontal start |
| `fade-end` | `fade-blur-end` | horizontal end |

Selections add together within each effect. `fade-top fade-bottom` selects both opacity edges. `fade-blur-y fade-blur-x` selects all blur edges. Neither family changes the other's selection. Strength, geometry, and activation settings do not select edges by themselves.

`start` and `end` name horizontal edges and follow the HTML `dir` attribute. In LTR, start is left and end is right. RTL reverses them. `top` and `bottom` stay physical.

Set `dir` on the plain fade scroller or blur frame, or on an ancestor. A CSS `direction: rtl` rule does not trigger RTL routing. See [Why plain directions](./MIGRATING.md#why-plain-directions) for the naming rationale.

```html
<div dir="rtl" class="fade-start overflow-x-auto">...</div>
```

## Blur

Use a blur selector such as `fade-blur-y` for blur without opacity fading. Add an opacity selector when you want both effects.

### Blur setup

Put `fade-blur-frame`, effect selectors, and configuration on the outer frame. Its first child must be the scrolling element. Size that child for your layout and give it `overflow: auto`.

```html
<div class="fade-blur-frame fade-blur-y" style="border-radius: 1rem">
  <div style="height: 20rem; overflow: auto">
    ...
  </div>
</div>
```

Keep `fade-blur-frame` unprefixed in the markup; it is structural and cannot be used through `@apply`. Apply responsive and state variants to the effect and configuration utilities on that frame.

With Tailwind, use `rounded-xl` on the frame and `h-80 overflow-y-auto` on the child. Set `dir` on the frame or an ancestor so its controls and scrolling child share the same direction. The frame renderer is available in both the Tailwind source and prebuilt CSS.

The frame reads its child's scroll timelines. It applies opacity fading to that child and renders blur beside it, outside the fade mask. This lets blur sample the content together with the visible page background and replace sharp edges instead of adding a halo. Transparent backgrounds stay visible and also soften within the selected blur bands.

Put borders and equal-radius round corners on the frame; keep its scrolling child borderless. Unequal radii and `corner-shape` shapes other than `round` can cause Chromium to blur the center despite its mask. See [Chromium issue 574875260](https://issues.chromium.org/issues/574875260).

Keep masks, filters, opacity below `1`, and backdrop filters off the frame and its ancestors between the frame and the visible background. They can isolate that background from the renderer and restore the halo. Put transforms on the frame rather than the scrolling child. Paint containment clips content outside the frame and makes it a containing block for positioned descendants; place popovers outside it when they need to escape. Use an inset focus indicator on the scroller, such as `outline-offset: -2px`, or draw the indicator on the frame.

Block, flex, grid, relative, and absolute scrollers can use the frame. An absolutely positioned scroller needs a sized frame and can fill it with `inset: 0`. Keep the scrollport inside the frame's bounds. Large effect bands can meet in the middle; leave space between the selected bands when you want a crisp center.

The frame renderer requires version `0.10.0` or newer. See [migration guidance](./MIGRATING.md#containing-existing-blur-scrollers) when upgrading from `0.9.0`.

### Progressive blur

The default uses one blur layer. Add exactly four empty spans to the frame, after the scrolling child, for five increasing blur radii.

```html
<div class="fade-blur-frame fade-y fade-blur-y fade-blur-md" style="border-radius: 1rem">
  <div style="height: 20rem; overflow: auto">
    ...
  </div>
  <span class="fade-blur-layer" aria-hidden="true"></span>
  <span class="fade-blur-layer" aria-hidden="true"></span>
  <span class="fade-blur-layer" aria-hidden="true"></span>
  <span class="fade-blur-layer" aria-hidden="true"></span>
</div>
```

`fade-blur-sm`, `fade-blur-md`, and `fade-blur-lg` set strength only. They do nothing without a blur selector. The single radii are `2px`, `3px`, and `6px`; a selector without a strength class uses `md` (`3px`). There is no arbitrary-radius utility in this API. Override `--fade-blur-sm`, `--fade-blur-md`, or `--fade-blur-lg` with a CSS length to tune a preset.

Progressive mode uses a stronger sequence of radii in the same region. It approximates a gradual change in blur, without promising an exact radius at every pixel. Layer counts other than four use single blur. The scrolling element must remain the first child. Keep the structural `fade-blur-layer` marker unprefixed; apply variants to the parent blur utilities. Conditional switching between single and progressive structure is not a utility feature.

Blur strength does not change opacity. `fade-size-*`, per-edge sizes, `fade-clear-*`, travel, and onset configure both effects. Activation is independent: `fade-none` disables opacity, and `fade-blur-none` disables blur. See [activation controls](#activation-controls).

Both renderers preserve pointer input. A blur selector reserves the frame's `::after` and `anchor-scope`. The frame reserves its own `timeline-scope` and its child's `anchor-name` and `scroll-timeline`. Layers use z-index 1000–1004 inside the frame; keep content below that range. Use a frame that permits direct spans, such as a `div`. Its scrolling child may be a native list.

Blur needs backdrop filters, CSS anchor positioning and scope, filtered `:nth-child()`, scroll-driven animations, and `timeline-scope`. Blur selectors outside a `fade-blur-frame` do not render blur. See [fallbacks and support](#browser-support) for the effect-specific result.

Blur uses the same raw scroll state as opacity fading. The [dynamic-content limitation](#dynamic-content-on-a-stable-scrollport) applies to both. When an axis cannot overflow, disable each selected effect on that axis.

## Size

Size controls the reach of both effects from each selected edge.

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

Explicit sizes are not capped. Opposing bands can overlap and cover the center of a small scroller.

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

`fade-travel-*` controls how far you scroll before either effect reaches its full band width. Travel and onset are shared by opacity and blur.

```html
<div class="fade-y fade-travel-sm overflow-y-auto">...</div>
<div class="fade-y fade-travel-[80px] overflow-y-auto">...</div>
```

Smaller values open the band sooner. The edge reaches full transparency after about `travel ÷ 8` while the band continues to widen.

Set `--tw-fade-onset` to a number on the effect owner, either the plain fade scroller or the blur frame to change that ratio. The default is `8`; higher values make the edge transparent sooner. Onset stays local to each scroller. A nested scroller keeps its default unless you set a value on it.

Travel uses the same named steps as size through its own `--fade-travel-*` tokens, and defaults to `sm`. The source path also accepts bracket values such as `fade-travel-[80px]`.

## Clear Zones

Clear zones offset an edge's opacity fade and blur. Use them for sticky headers, sticky footers, or fixed controls inside the scroll container. A clear zone applies to its edge; it does not protect a rectangle from other selected edges. For example, a top clear zone does not prevent a horizontal effect crossing the same header.

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

<a id="force-or-disable-a-fade"></a>

## Activation Controls

Each effect has its own activation settings. Pair a setting with an effect selector; a mode alone does not select an edge or create an effect.

| Meaning | Opacity | Blur |
| --- | --- | --- |
| Follow scrolling; default | `fade-auto` | `fade-blur-auto` |
| Force selected edges on | `fade-always` | `fade-blur-always` |
| Disable selected edges | `fade-none` | `fade-blur-none` |

Every mode supports global, `x`, `y`, `top`, `bottom`, `start`, and `end` scopes. Examples include `fade-auto-top`, `fade-none-y`, and `fade-blur-always-start`.

An edge setting wins over an axis setting, which wins over a global setting. An absent setting falls through to the broader scope, then to automatic behavior. An explicit `auto` stops that fallthrough. None of these modes removes an edge selection.

| Classes | Result |
| --- | --- |
| `fade fade-always fade-none-x` | Vertical opacity forced on; horizontal opacity off |
| `fade fade-none fade-always-y` | Vertical opacity forced on; horizontal opacity off |
| `fade-y fade-always fade-none-y fade-auto-top` | Top opacity follows scrolling; bottom opacity off |
| `fade-y fade-blur-y fade-none` | Blur remains automatic; opacity off |
| `fade-y fade-blur-y fade-none fade-blur-none` | Both effects off |

Prefer one mode per scope and condition. Conflicting modes at the same scope and identical variant chain resolve as **`none` > `auto` > `always`**, regardless of class-string order. Thus `fade-always fade-auto` is automatic, and adding `fade-none` disables it. This order is a tie-break within one condition; it does not outrank active conditional overrides.

### Conditional Composition

On the Tailwind source path, responsive and state variants replace the base mode at the same scope while their condition matches. When the condition ends, the base applies again. All six transitions work:

| Classes, alongside `fade-y` | Below `md` | At `md` and above |
| --- | --- | --- |
| `fade-auto md:fade-always` | automatic | forced on |
| `fade-auto md:fade-none` | automatic | off |
| `fade-always md:fade-auto` | forced on | automatic |
| `fade-always md:fade-none` | forced on | off |
| `fade-none md:fade-auto` | off | automatic |
| `fade-none md:fade-always` | off | forced on |

The same rules apply to `fade-blur-*` modes and state conditions such as `hover:`, `focus-visible:`, `group-hover:`, and `data-[open]:`. To disable both effects at a breakpoint, use both `md:fade-none` and `md:fade-blur-none`.

Scope still takes priority. `fade-blur-y fade-blur-none-y md:fade-blur-auto` stays disabled because the axis setting is narrower. Use `md:fade-blur-auto-y` to replace that setting.

Selectors add edges. `fade-y md:fade-x` selects both axes at `md`. Use `max-md:fade-y md:fade-x` to switch from vertical to horizontal selection, or `fade-y md:fade-x md:fade-none-y` to suppress the vertical treatment there. The same applies to blur.

There is no public unset mode. To resume broader-scope resolution, bound the narrower setting: `fade-y fade-always max-md:fade-auto-y` is automatic below `md` and forced at `md`. An unconditional `fade-auto-y` would continue to override the global mode.

Class concatenation is not a merge strategy. Remove obsolete selectors or modes when replacing a component's configuration. Different simultaneously active conditions use CSS specificity, cascade layers, and Tailwind's variant order. Custom variants can change those factors; equivalent conditions written as different variant chains are not treated as one conflict group.

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
| Opacity and blur selectors | yes | yes |
| Named blur strengths | yes | yes |
| Both activation families, at every scope | yes | yes |
| Named size/travel/clear utilities | yes | yes |
| `fade-scrollbar-safe-*` and named `fade-scrollbar-width-*` | yes | yes |
| `fade-clear-*-var` | yes | yes |
| Structural `fade-blur-frame` | yes, unprefixed | yes, unprefixed |
| Structural `fade-blur-layer` marker | yes, unprefixed | yes, unprefixed |
| Responsive and state variants | yes, using the app's theme | no |
| Arbitrary values like `fade-size-[6rem]` | yes | no |
| Integer clear values like `fade-clear-top-14` | yes | no |

The package build generates the prebuilt file from an explicit safelist. It excludes Tailwind Preflight, core Tailwind utilities, prefixed variants, arbitrary values, and integer `fade-clear-*` classes. Neither distribution provides arbitrary blur-radius utilities. When classes are built dynamically, include the complete names in Tailwind's scanned source or safelist.

## Exports

| Specifier | Resolves to |
| --- | --- |
| `tw-fade` | `./src/tw-fade.css` |
| `tw-fade/css` | `./dist/tw-fade.css` |
| `tw-fade/dist/tw-fade.css` | `./dist/tw-fade.css` |

`tailwindcss >=4.0.0` is an optional peer dependency. You need it for the source path, but not for the prebuilt CSS.

## How It Works

Each effect host uses one shared four-slot animation list for raw scroll progress. Unselected edges have empty slots. Its opacity and blur amounts resolve independently from that progress, their selections, and their activation settings. For a selected edge, `auto` uses scroll progress, `always` uses the full amount, and `none` uses zero. Plain fades use `scroll(self y)` and `scroll(self inline)`. Frames use named timelines from their first child, isolated by `timeline-scope`. The `:dir()` selector routes horizontal start and end.

Opacity uses four gradient mask layers and two dormant scrollbar-shield strips. With a frame, this mask belongs to the scrolling child. Blur layers are siblings of that child, anchored to its bounds. The frame itself stays unmasked so the blur can sample the visible background. Missing blur capabilities leave opacity fading available and omit blur.

Raw progress normally stays at `0` when its axis cannot scroll. Forced modes do not change raw progress. Without scroll-driven animations, selected automatic opacity fades use the static full amount; disabled fades stay disabled. Blur remains unavailable even with `fade-blur-always`.

Effect selections and mode settings are local to each scroller. A nested scroller does not inherit the parent's activation or strength class. Theme tokens can inherit. Ancestor masks, opacity, and filters still affect the composed result; a child effect cannot undo them. An authored mask or `::after` on the same host can conflict with the plugin's rendering.

### Dynamic content on a stable scrollport

WebKit can retain a stale fade when a mounted scrollport swaps long content for short content. The common case starts with the scroll position at the end. Try these fixes in order:

1. Upgrade to the latest `tw-fade`.
2. Remount or key the scrollport by content identity.
3. Restart the fade animation after the content swap.
4. Add `fade-none-y` or `fade-none-x` when your app knows that axis cannot overflow. For blur, use `fade-blur-none-y` or `fade-blur-none-x`. An element using both effects needs both disable controls for that axis.

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

The helper restarts the shared raw animations for both effects. It does not change selections or activation modes. Browser invalidation can still leave stale state after a content swap; do not treat the helper as a guarantee in affected WebKit builds.

### Public Properties

Theme with `--fade-size-*`, `--fade-travel-*`, `--fade-clear-*`, `--fade-blur-sm/md/lg`, and `--fade-scrollbar-width-*`. Runtime clear-zone properties such as `--fade-clear-top` feed the matching `-var` utilities.

The three author properties are `--tw-fade-onset`, `--tw-fade-scrollbar-width`, and `--tw-fade-scrollbar-thumb`. Treat other `--tw-fade-*` properties as internal. Raw scroll progress and effective opacity/blur amounts have different meanings; neither is an author-facing activation control.

## Accessibility

`tw-fade` changes appearance without moving content or changing focus order. Masking and blur reduce readability near an edge, so use modest bands and clear zones around controls or critical text. Blur layers pass pointer events through. Empty progressive spans should use `aria-hidden="true"`.

## Browser Support

Opacity requires CSS masking. Its animated path also uses scroll-driven animations, registered numeric custom properties, and `:dir()` routing. Without scroll timelines, static opacity fallback remains available, including when property registration is unavailable. Activation still applies: selected automatic or forced edges show a static fade, and disabled edges stay clear.

Blur additionally requires backdrop filtering, anchor positioning and scope, and filtered `:nth-child()`. Syntax support alone does not prove that a browser renders blur correctly. `always` changes activation; it does not bypass the renderer's capability gate.

| Requested effects | Blur unsupported or anchor ineligible | Scroll timelines unavailable |
| --- | --- | --- |
| Opacity only | Opacity fade remains | Static opacity fade |
| Blur only | Unmodified content | Unmodified content |
| Both | Opacity fade remains | Static opacity fade; no blur |

Each effect's disable modes still apply in these fallback paths. A blur-only fallback never introduces an opacity fade. Transform, filter, or paint/layout containment on the scroller can make its anchor ineligible even when all required syntax is supported.

Native Safari 18.6 passes checks for static opacity, disabled effects, and blur-only fallback. It lacks the features required for blur. Safari 26.2 on an iPhone 17 Pro simulator passes single and progressive blur pixel checks through both import paths, plus scroll endpoints, RTL routing, and a tap through the overlay. Physical iPhone rendering remains unverified. WebKit can retain scroll-state residue after content shrinks; this also reproduces in the simulator. See the [dynamic-content guidance](#dynamic-content-on-a-stable-scrollport).

Older WebKit may need `-webkit-mask-*`. Run the prebuilt CSS through Autoprefixer if you support it.

## Migrating

For the draft blur API or overlapping activation modes, follow the [0.9.0 migration](./MIGRATING.md#migrating-to-090). Ordinary opacity-only usage keeps its names. Upgrading from `0.6.x` also requires the [existing rename procedure](./MIGRATING.md#migrating-from-tw-fade-06x-to-07) and RTL checks.

## Development

```bash
npm test
npm run build
npm run build:demo
npm run verify
```
