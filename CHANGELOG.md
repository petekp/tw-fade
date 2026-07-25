# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `fade-scrollbar-safe-y` / `-x` / `-xy`: opt-in utilities that keep a classic
  (space-consuming) scrollbar from fading with the content. Each adds an opaque
  mask strip over the scrollbar's column or row, unioned onto the fade via
  `mask-composite: add`; `-y` and `-xy` also reserve a stable inline gutter. **The
  suffix is the scroll axis, not the faded edge** — `-y` follows `overflow-y` and
  shields the vertical bar at the inline end, which is the opposite convention
  from this plugin's own `fade-y` (top + bottom edges). In practice the two agree:
  a y-scroller wants `fade-y` and `fade-scrollbar-safe-y`. Because CSS offers no
  way to measure the reserved gutter from the element the mask is on, the
  utilities **pin** the bar with
  `::-webkit-scrollbar` and sizes the strip from the same custom property, so bar
  and strip agree by construction and stay aligned under page zoom. The trade is
  that the bar becomes classic on every platform, including macOS. Also gives the
  bar a transparent track and a `currentColor`-derived thumb so the gutter
  doesn't read as a separate panel; override via `--tw-fade-scrollbar-thumb`
  (color) and `fade-scrollbar-width-*` / `--tw-fade-scrollbar-width` (bar and
  strip width, default `15px`). RTL-aware and inert until applied. Not supported
  in Firefox, which ignores `::-webkit-scrollbar` and whose overlay/classic mode
  can't be detected.
- The three axes are independent rather than nested, because the strips have
  different preconditions. The block gutter is only reserved when content actually
  overflows horizontally — no `scrollbar-gutter` value reserves it unconditionally
  — so a block strip applied blind would paint an opaque band over content on
  every vertical-only scroller; hence `-x` and `-xy` rather than a block strip in
  the base class. Conversely only `-y` and `-xy` set `scrollbar-gutter: stable`,
  since `-x` says the container has no vertical bar and reserving an inline gutter
  for it would put the strip on content. `-xy` is needed because pinning the bar
  is a per-element opt-in rather than a per-axis one: a two-axis scroller gets a
  classic horizontal bar whether or not the utility asks for one.
- `fade-scrollbar-width-sm|md|lg` (`11px` / `15px` / `17px`), backed by the
  `--fade-scrollbar-width-*` theme namespace. A pure setter: on its own it turns
  nothing on, because only the `fade-scrollbar-safe-*` utilities read it. The
  underlying property inherits, so its most useful home is an ancestor —
  `<body class="fade-scrollbar-width-lg">` states a house style once for every
  opted-in scroller below. Absolute px rather than the spacing ramp (a scrollbar
  is device chrome, not typographic rhythm), and `[length]` only — a bare integer
  would read as px here and as spacing steps everywhere else in the plugin.

### Fixed

- The inline-end fade now reaches transparent at the content edge on containers
  with a classic scrollbar. Mask percentages resolve against a box that includes
  the reserved gutter while content stops at the scrollport edge, so an
  inline-end ramp authored to hit zero at `100%` hit zero inside the gutter and
  never finished over real content — measured at 40/255 still opaque on the last
  content pixel with a 60px band and the 15px default bar, and 161/255 under a
  26px band, versus 0/255 and 1/255 once the layer is inset by the pinned width.
  Tighter bands are hit harder, since the gutter eats a larger share of the ramp.
  Inert at the `0px` default.
- The scrollbar strips no longer make `@property` load-bearing for the whole
  plugin. `mask-size` references `--tw-fade-scrollbar`, which is only declared
  inside `@supports selector(::-webkit-scrollbar)`; everywhere else its value came
  solely from the `@property` initial value. On an engine without `@property`
  (Safari 15.4–16.3, Firefox < 128) that reference is guaranteed-invalid, which
  invalidated the entire `mask-size` declaration at computed-value time — all six
  layers fell back to `auto`, the two `0px` strips became full-size opaque layers,
  and the fade disappeared completely. Every reference now carries an explicit
  fallback. Verified by re-rendering the shipped CSS with the `@property` blocks
  stripped out.
- The scrollbar strip is anchored to the padding box rather than the border box,
  so it tracks the gutter on a scroll container with a border. Anchored to the
  border box it was displaced outward and straddled the border, shielding the
  border while leaving that many pixels of scrollbar still faded.

- Nudged scroll-driven animation ranges away from exact start/end endpoints so
  Chromium resets fade amounts when mounted scrollports swap from overflowing to
  non-overflowing content.

### Documented

- Added support guidance for dynamic content swaps on stable scrollport nodes,
  including remount, reset-helper, and `fade-none-*` escape-hatch patterns.

## [0.7.0] - 2026-06-28

Breaking rename to a plain direction API. [MIGRATING.md](./MIGRATING.md) is an
agent-ready upgrade procedure (ordered renames, RTL caveats, and a verification grep);
it also explains the [naming rationale](./MIGRATING.md#why-plain-directions).

### Added

- Direction-aware horizontal fades: `fade-start` / `fade-end` route to the correct
  physical edge per the container's `:dir()`, so they flip automatically under RTL.
- `fade-none` / `fade-always` (and `-x` / `-y` axis variants) to force or disable
  the active fade amount.
- Per-edge `fade-size-*` and `fade-clear-*` for `top` / `bottom` / `start` / `end`.

### Changed

- **Breaking:** the public API is now plain directions — `fade`, `fade-y`, `fade-top`,
  `fade-bottom`, `fade-x`, `fade-start`, `fade-end` — replacing the old physical
  `fade-t` / `fade-b` / `fade-l` / `fade-r` / `fade-xy` set.
- **Breaking:** `fade-x` keeps its name but now fades the inline **start + end** edges
  (direction-aware), not a fixed physical left + right — so it flips under RTL.
  `fade-y` is unchanged (the block axis never flips with text direction).
- **Breaking:** `fade-range-*` renamed to `fade-travel-*` (and `--fade-range-*` →
  `--fade-travel-*`).
- Edge transparency is now decoupled from the travel. The masked edge saturates to
  fully transparent within `travel ÷ --tw-fade-onset` (default `8`) of scroll, so a
  leading edge is no longer hard-clipped while the band is still widening over the
  travel. `fade-travel-*` now controls only how fast the soft band eases open (cosmetic,
  safe at any size). Tune edge speed with `--tw-fade-onset`.
- The default travel is now `sm` (was `md`), for a snappier band open.
- **Breaking:** `fade-static` renamed to `fade-always`.
- The prebuilt CDN example in the README is pinned to a fixed version; unversioned
  URLs track latest and will receive breaking renames.

### Removed

- The old physical public class names (`fade-t/b/l/r/xy`, `fade-static`, and their
  `fade-size-*` / `fade-range-*` / `fade-clear-*` families). No public physical
  horizontal utility (`fade-left` / `fade-right`) is provided.

[Unreleased]: https://github.com/petekp/tw-fade/compare/v0.7.0...HEAD
[0.7.0]: https://github.com/petekp/tw-fade/releases/tag/v0.7.0
