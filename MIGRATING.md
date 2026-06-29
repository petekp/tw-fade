# Migrating to tw-fade 0.7.0 — Plain Direction API

This guide is for **humans and coding agents alike** — upgrade by hand, or point an agent at this file. Either way it takes a project from tw-fade `0.6.x` to `0.7.0`.

> **Coding agents:** this document is written for you to execute. Run it top to bottom as a procedure — Step 1 (judgment calls) first, then the mechanical renames in Steps 2–3, then verify with Step 6. Don't reintroduce any removed name; the rejected shapes are deliberate and enforced by the test suite (see [Why Plain Directions](#why-plain-directions)).

`0.7.0` is a breaking rename. Internally the engine still uses a physical four-edge mask; the public class names are now plain directions:

```txt
fade   fade-y   fade-top   fade-bottom   fade-x   fade-start   fade-end
```

`start` / `end` are **horizontal and direction-aware**: in LTR, start = left and end = right; in RTL they swap. RTL is read from the `dir` attribute on the scroll container or an ancestor (the `:dir()` selector), not a CSS-only `direction: rtl`.

---

## Step 0 — Search scope

Search the whole project, not just `.html`. Tokens appear in `class` / `className` strings (HTML, JSX/TSX, Vue, Svelte, Astro, templates), `@apply` rules, `@theme` overrides (`--fade-range-*`), and inline custom properties (`style="--fade-clear-l: 2"`).

**Match whole tokens only.** A token is bounded by a quote, whitespace, backtick, or Tailwind variant colon (`:`). Variant prefixes stay attached: `sm:fade-t` → `sm:fade-top`, `hover:fade-l` → `hover:fade-start`. Never replace a *prefix* of a longer class — `fade-r` must not match inside `fade-range-*` (or the new `fade-travel-*`). The Step 2 family rules are self-protecting because each prefix ends in `-`.

---

## Step 1 — Judgment calls (do first; never blind-replace)

### `fade-l` / `fade-r` were *physical*; `fade-start` / `fade-end` are *direction-aware* ⚠️

This is the one genuinely unsafe transform. In LTR the mapping is exact and automatable; inside `dir="rtl"` it **inverts** — `fade-start` resolves to the *right* edge — so RTL cases need human review, not a blind swap.

| Context | `fade-l` → | `fade-r` → |
| --- | --- | --- |
| LTR container (the default) | `fade-start` ✅ exact | `fade-end` ✅ exact |
| RTL, author meant the physical **left** edge | `fade-end` ⚠️ review | — |
| RTL, author meant the physical **right** edge | — | `fade-start` ⚠️ review |

**Flag every `fade-l` / `fade-r` inside an RTL subtree for human review.** There is no physical-side escape hatch by design (see [Why Plain Directions](#why-plain-directions)).

### `fade-x` — same name, new behavior

`fade-x` is **not renamed**, but it now fades the inline start + end edges (direction-aware) rather than fixed physical left + right. No edit; just note the behavior change where RTL applies.

---

## Step 2 — Mechanical renames (safe to automate)

### Bare direction & state classes — match the whole token

| Old | New |
| --- | --- |
| `fade-xy` | `fade` |
| `fade-t` | `fade-top` |
| `fade-b` | `fade-bottom` |
| `fade-l` | `fade-start` _(Step 1 caveat)_ |
| `fade-r` | `fade-end` _(Step 1 caveat)_ |
| `fade-static` | `fade-always` |
| `fade-y` | _unchanged_ |
| `fade-x` | _unchanged name (Step 1)_ |

### Family classes — replace the prefix; the suffix carries through

The suffix may be a named scale (`-md`), a bare integer (`-2`), or an arbitrary value (`-[80px]`) — replacing only the prefix preserves all three. Each prefix ends in `-`, making the rule self-protecting (`fade-clear-t-md` → `fade-clear-top-md` no longer matches `fade-clear-t-`).

| Old prefix | New prefix |
| --- | --- |
| `fade-size-t-` | `fade-size-top-` |
| `fade-size-b-` | `fade-size-bottom-` |
| `fade-size-l-` | `fade-size-start-` |
| `fade-size-r-` | `fade-size-end-` |
| `fade-range-` | `fade-travel-` |
| `fade-clear-t-` | `fade-clear-top-` |
| `fade-clear-b-` | `fade-clear-bottom-` |
| `fade-clear-l-` | `fade-clear-start-` |
| `fade-clear-r-` | `fade-clear-end-` |
| `fade-clear-xy-` | `fade-clear-` |
| `fade-size-x-` · `fade-size-y-` · `fade-clear-x-` · `fade-clear-y-` | _unchanged_ |

`range` → `travel` controls how quickly the soft band eases open as you scroll (the masked edge itself is now covered almost immediately — see the [changelog](./CHANGELOG.md)). `fade-travel-*` is **global only** — no per-edge travel utilities. The default travel is now `sm` (was `md`), so a surface that relied on the implicit default gets a slightly snappier band open — purely cosmetic, no action needed.

---

## Step 3 — Theme tokens & inline custom properties

| Old | New |
| --- | --- |
| `--fade-range-*` (e.g. `--fade-range-md`) | `--fade-travel-*` |
| `--fade-clear-t` | `--fade-clear-top` |
| `--fade-clear-b` | `--fade-clear-bottom` |
| `--fade-clear-l` | `--fade-clear-start` |
| `--fade-clear-r` | `--fade-clear-end` |
| `--fade-clear-xy` | `--fade-clear` |

---

## Step 4 — New utilities (no old equivalent)

`fade-none`, `fade-none-x`, `fade-none-y`, `fade-always-x`, `fade-always-y` are new. They change only the fade *amount*, so pair them with a direction utility:

```html
<div class="fade-y fade-always-y">…</div>
```

No migration action — listed so they aren't flagged as unrecognized.

---

## Step 5 — Pin the CDN (prebuilt-CSS users only)

If the project links the prebuilt CSS, pin the version so this breaking rename can't arrive unannounced:

```html
<link rel="stylesheet" href="https://unpkg.com/tw-fade@0.7.0/dist/tw-fade.css" />
```

An unversioned URL (`https://unpkg.com/tw-fade/dist/tw-fade.css`) tracks latest and will receive future breaking renames. Projects that build from the Tailwind source path pick up the new names on the next build — no pin needed.

---

## Step 6 — Verify

Run from the project root. A complete migration prints **nothing** (the pattern matches every removed class/variable shape with token boundaries, so it won't false-positive on the new names):

```bash
rg -nP '(?<![\w-])fade-(?:t|b|l|r|xy|static)(?![\w-])|(?<![\w-])fade-size-(?:t|b|l|r)-|(?<![\w-])fade-clear-(?:t|b|l|r|xy)-|(?<![\w-])fade-range-|--fade-range-|(?<![\w-])--fade-clear-(?:t|b|l|r|xy)(?![\w-])'
```

Then rebuild and load the app. Re-check that any `fade-l` / `fade-r` flagged in Step 1 fade the intended physical edge under the container's actual text direction.

---

## Why Plain Directions

**Don't reintroduce removed names** — these choices are deliberate and enforced by the test suite. An earlier draft used fully logical names (`fade-inline-start`, `fade-inline-end`, `fade-block`); this release ships plain directions:

- **Vertical edges stay physical** (`fade-top`, `fade-bottom`, `fade-y`) — the block axis never flips with text direction, so `fade-block-start` would just be a longer spelling of `fade-top`.
- **Horizontal edges stay logical** (`fade-start`, `fade-end`) — only the inline axis flips under RTL, so physical `fade-left` / `fade-right` would silently fade the wrong edge.

This split mirrors Tailwind itself (physical `top`/`bottom` insets alongside logical `ps`/`pe`). Trade-off: bare `start`/`end` assume the inline axis, so there's no `fade-block-start`, and `fade-start` on a vertical-only scroller is a no-op.

Rejected by `REJECTED_CLASSES` in the test suite — do not add as aliases:

- old physical: `fade-t` · `fade-b` · `fade-l` · `fade-r` · `fade-xy` · `fade-static` (and their `fade-size-*` / `fade-range-*` / `fade-clear-*` families)
- logical aliases: `fade-inline-start` · `fade-inline-end` · `fade-block` · `fade-block-start` · `fade-block-end`
- physical horizontal: `fade-left` · `fade-right`
