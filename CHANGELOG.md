# Changelog

Notable changes since 0.7.0 are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Authoring rules

- Put user-visible changes under `Unreleased` using `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, or `Security`.
- Start each bullet with the affected public API or behavior.
- Keep one `**Migration:**` line as the first content under `Unreleased`. Update it when a change requires user action.
- Put that migration line directly below every dated release heading. The release script moves the current line into the release and seeds `Unreleased` with `**Migration:** None.`.
- Link the migration procedure when a release requires user action.
- Do not rewrite released entries except to correct a factual error.
- Keep these rules outside `Unreleased`. `npm run release -- <bump>` moves everything under `Unreleased` into the next dated release.

## [Unreleased]

**Migration:** None.

### Changed

- Documentation: shortened the README and made the 0.6.x migration procedure explicit about package updates, RTL decisions, scan scope, recovery, and verification.
- Release metadata: release preparation now requires a first-line migration status and at least one change-note bullet under `Unreleased`.

## [0.8.0] - 2026-07-31

**Migration:** None. Existing fade utilities keep their behavior; scrollbar helpers are opt-in.

### Added

- `fade-scrollbar-safe-y`, `fade-scrollbar-safe-x`, and `fade-scrollbar-safe-xy` shield classic scrollbars from the fade. The suffix names the scroll axis. Use `-y` with `overflow-y`, `-x` with `overflow-x`, and `-xy` for both. Apply `-x` or `-xy` only while horizontal overflow exists.
- `fade-scrollbar-width-sm`, `fade-scrollbar-width-md`, and `fade-scrollbar-width-lg` set the opted-in bar and shield to `11px`, `15px`, and `17px`. They inherit and do not enable protection by themselves. Theme with `--fade-scrollbar-width-*` or set `--tw-fade-scrollbar-width` directly. Set `--tw-fade-scrollbar-thumb` to override the thumb color.
- Browser support: scrollbar shielding requires scroll-driven animations and `::-webkit-scrollbar`. Release Firefox, Safari 17.x, and Safari 18.x keep their native scrollbars unchanged.
- Compatibility: do not combine a safe utility with `scrollbar-width`, `scrollbar-color`, or Tailwind's `scrollbar-thin`, `scrollbar-auto`, `scrollbar-none`, `scrollbar-thumb-*`, or `scrollbar-track-*`. Either CSS property cancels the scrollbar pin in Blink; `scrollbar-width` also cancels it in WebKit. The mask strip remains and can cover content.
- Geometry: any safe utility pins both scrollbar axes on that element, including on macOS. Safari can place the vertical shield over content when `overflow-y-auto` does not overflow. Use `overflow-y-scroll` or apply `fade-scrollbar-safe-y` only while vertical overflow exists.

See [Scrollbars](./README.md#scrollbars) for setup, limits, and examples.

### Fixed

- `fade-scrollbar-safe-y` and `fade-scrollbar-safe-xy` now make the inline-end ramp reach full transparency at the content edge beside a classic vertical scrollbar.
- Scrollbar mask layers now have explicit fallbacks, so the fade still works in engines without `@property`.
- Scrollbar shields now use the padding box, which keeps them aligned on bordered scroll containers.
- Negative scrollbar widths now clamp to `0px` before they reach the bar or mask.

## [0.7.1] - 2026-06-29

**Migration:** None.

### Fixed

- Scroll-driven animation ranges now avoid exact start and end endpoints, so Chromium resets fade amounts when a mounted scrollport changes from overflowing to non-overflowing content.

### Changed

- Documentation: added [guidance for dynamic content on a stable scrollport](./README.md#dynamic-content-on-a-stable-scrollport), including remount, reset-helper, and `fade-none-*` options.

## [0.7.0] - 2026-06-28

**Migration:** Required from 0.6.x. Follow [MIGRATING.md](./MIGRATING.md).

### Added

- `fade-start` and `fade-end` select direction-aware horizontal edges through `:dir()`.
- `fade-none`, `fade-none-x`, and `fade-none-y` disable selected fades.
- `fade-always`, `fade-always-x`, and `fade-always-y` pin selected fades at full strength.
- `fade-size-top-*`, `fade-size-bottom-*`, `fade-size-start-*`, and `fade-size-end-*` set one edge's fade size.
- `fade-clear-top-*`, `fade-clear-bottom-*`, `fade-clear-start-*`, and `fade-clear-end-*` set one edge's clear zone.

### Changed

- Breaking: `fade`, `fade-y`, `fade-top`, `fade-bottom`, `fade-x`, `fade-start`, and `fade-end` replace the old direction names.
- Breaking: `fade-x` keeps its name but selects inline start and end rather than fixed physical left and right. Review RTL surfaces.
- Breaking: `fade-range-*` and `--fade-range-*` became `fade-travel-*` and `--fade-travel-*`.
- Breaking: `fade-clear-t-*`, `fade-clear-b-*`, `fade-clear-l-*`, and `fade-clear-r-*`, including their `-var` forms, became the `top`, `bottom`, `start`, and `end` families. The matching `--fade-clear-t`, `--fade-clear-b`, `--fade-clear-l`, and `--fade-clear-r` properties changed the same way. Follow [MIGRATING.md](./MIGRATING.md) for left and right RTL decisions.
- Breaking: `fade-clear-xy-*`, `fade-clear-xy-var`, and `--fade-clear-xy` became `fade-clear-*`, `fade-clear-var`, and `--fade-clear`.
- Breaking: `fade-static` became `fade-always`.
- Edge transparency is separate from travel. `fade-travel-*` controls how fast the soft band opens; `--tw-fade-onset` controls edge speed.
- The default travel changed from `md` to `sm`.
- The README's prebuilt CSS URL is pinned to a release instead of following the newest version.

### Removed

- The old direction classes `fade-t`, `fade-b`, `fade-l`, `fade-r`, and `fade-xy` were removed.
- Their old per-edge families `fade-size-t-*`, `fade-size-b-*`, `fade-size-l-*`, `fade-size-r-*`, `fade-clear-t-*`, `fade-clear-b-*`, `fade-clear-l-*`, and `fade-clear-r-*` were removed.
- The global `fade-range-*` family was removed in favor of `fade-travel-*`.
- No public `fade-left` or `fade-right` alias is provided.

[Unreleased]: https://github.com/petekp/tw-fade/compare/v0.8.0...HEAD
[0.8.0]: https://github.com/petekp/tw-fade/compare/v0.7.1...v0.8.0
[0.7.1]: https://github.com/petekp/tw-fade/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/petekp/tw-fade/releases/tag/v0.7.0
