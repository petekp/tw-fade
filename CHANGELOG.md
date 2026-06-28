# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.0] - 2026-06-26

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

[0.7.0]: https://github.com/petekp/tw-fade/releases/tag/v0.7.0
