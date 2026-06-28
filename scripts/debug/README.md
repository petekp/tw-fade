# tw-fade debug harness

An interactive pressure-test bench for the fade engine. It renders the plugin
across every direction utility, a battery of real-world / edge-case layouts, and
four parameter sweeps — all pinned to the **same scroll offset** so any bug is a
side-by-side visual diff.

## Run

```bash
npm run debug        # → debug/index.html (self-contained, gitignored)
```

Open `debug/index.html` in a **Chromium-based browser** (needs scroll-driven
animations + `corner-shape`; Chrome/Edge ≥ 115-ish, full squircle support ≥ 149).
The file inlines the *compiled* plugin CSS — the same output `dist/` ships — so the
harness always reflects the real engine. Re-run `npm run debug` after editing
`src/tw-fade.css`.

## What it exercises

- **Directions** — all seven utilities (`fade`, `fade-y`, `fade-x`, `fade-top`,
  `fade-bottom`, `fade-start`, `fade-end`) on identical content.
- **Real-world & edge cases** — short (non-overflowing) content, sticky-header
  occlusion, padding lead-in, scroll-snap, nested fade scrollers, image/code/dense
  content, tiny containers, thick borders, oversized (50%) fades, per-edge sizes,
  `overflow: clip` trap, and the `fade-none` / `fade-none-y` / `fade-always-x`
  override paths.
- **Sweeps** — travel, onset, size, clear each across their scale at the global
  scroll offset.

## Controls

- **Synchronized scroll** — one slider drives every scroller. Fine chips
  (`0/2/4/6/8/12/24px`) plus a **px-from-start / px-from-end** toggle let you probe
  the onset edge-coverage window on the leading edge *and* the separate trailing
  range. `auto` oscillates.
- **size / travel / onset / clear** sliders write the public custom properties
  (`--tw-fade-size`, `--tw-fade-travel`, `--tw-fade-onset`, `--tw-fade-clear`)
  directly on each scroller — no class explosion, continuous values.
  - **onset 1 reproduces the old coupled hard-clip** (`alpha = t`); 8 is the
    decoupled default. That is the A/B.
- **static fallback** forces `fade-always`, mirroring the `@supports not
  (animation-timeline: scroll())` path that pins amounts to 1.
- **RTL**, **content type**, **background** (light/dark/checker/photo — reveals the
  mask silhouette), and **container shape** (rounded/squircle/sharp).
- Each card shows a live readout: scroll offset, `%`, and the resolved
  `--tw-fade-{t,b,l,r}` amounts. A non-overflowing card reads `no overflow → no
  fade` (the key scroll-driven invariant).

## Architecture

Three sources, assembled into one standalone file by `scripts/build-debug.mjs`:

| File | Role |
| --- | --- |
| `scripts/build-debug.mjs` | generator — inlines compiled plugin CSS + the two files below, writes `debug/index.html`, emits the control-panel markup |
| `scripts/debug/harness.css` | UI chrome only (never touches the fade engine) |
| `scripts/debug/harness.js` | scenario config, controls, scroll-sync engine |

The config props are `@property … inherits:false`, so the harness sets them on
**each `.fade*` element directly** (a parent would not cascade).

### Add a scenario

Append an object to `SCENARIOS.directions` / `SCENARIOS.realworld` in
`harness.js`:

```js
{ id: 'myCase', label: 'My case', cls: 'fade-y', special: 'simple',
  content: 'text', lock: { travel: 80, vars: { '--tw-fade-size-top': '64px' } },
  note: 'what to look for' }
```

`special` selects a builder (`simple`, `plane`, `hscroll`, `sticky`, `leadin`,
`snap`, `short`, `clip`, `nested`, `bordered`); `lock` overrides global params for
that card (`size`/`travel`/`onset`/`clear`, or arbitrary inline `vars`).
