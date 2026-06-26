# Migrating To The Plain Direction API

This release is a breaking rename. The implementation still uses a physical four-edge mask internally, but the public API now uses readable directions:

```txt
fade
fade-y
fade-top
fade-bottom
fade-x
fade-start
fade-end
```

`start` and `end` are horizontal and direction-aware. In LTR, start is left and end is right. In RTL, start is right and end is left. RTL routing follows the HTML `dir` attribute on the scroll container or an ancestor, not a CSS-only `direction: rtl` rule.

## Direction Renames

| Before | After |
| --- | --- |
| `fade-xy` | `fade` |
| `fade-t` | `fade-top` |
| `fade-b` | `fade-bottom` |
| `fade-l` | `fade-start` for normal LTR horizontal rails |
| `fade-r` | `fade-end` for normal LTR horizontal rails |
| `fade-y` | unchanged |
| `fade-x` | unchanged name, now direction-aware |
| `fade-static` | `fade-always` |

There are no public `fade-left` or `fade-right` utilities in this API. Use `fade-start` and `fade-end` unless you intentionally need a physical-side escape hatch. That escape hatch is not part of v1.

## Size Renames

| Before | After |
| --- | --- |
| `fade-size-t-*` | `fade-size-top-*` |
| `fade-size-b-*` | `fade-size-bottom-*` |
| `fade-size-l-*` | `fade-size-start-*` |
| `fade-size-r-*` | `fade-size-end-*` |
| `fade-size-y-*` | unchanged |
| `fade-size-x-*` | unchanged name, now start + end |
| `fade-size-*` | unchanged |

The source path still supports arbitrary values:

```html
<div class="fade-y fade-size-[15%]">...</div>
```

The prebuilt CSS includes named sizes only.

## Reveal Renames

`range` was renamed to `reveal` because the class controls how quickly the fade appears and disappears during scroll.

| Before | After |
| --- | --- |
| `fade-range-*` | `fade-reveal-*` |
| `fade-range-[80px]` | `fade-reveal-[80px]` |
| `--fade-range-md` | `--fade-reveal-md` |

`fade-reveal-*` is global only. There are no per-edge reveal utilities.

## Clear Zone Renames

| Before | After |
| --- | --- |
| `fade-clear-t-*` | `fade-clear-top-*` |
| `fade-clear-b-*` | `fade-clear-bottom-*` |
| `fade-clear-l-*` | `fade-clear-start-*` |
| `fade-clear-r-*` | `fade-clear-end-*` |
| `fade-clear-xy-*` | `fade-clear-*` |
| `fade-clear-y-*` | unchanged |
| `fade-clear-x-*` | unchanged name, now start + end |

Dynamic clear variables use the new names too:

| Before | After |
| --- | --- |
| `--fade-clear-t` | `--fade-clear-top` |
| `--fade-clear-b` | `--fade-clear-bottom` |
| `--fade-clear-l` | `--fade-clear-start` |
| `--fade-clear-r` | `--fade-clear-end` |
| `--fade-clear-xy` | `--fade-clear` |

## Force Or Disable

| Before | After |
| --- | --- |
| `fade-static` | `fade-always` |
| none | `fade-always-y` |
| none | `fade-always-x` |
| none | `fade-none` |
| none | `fade-none-y` |
| none | `fade-none-x` |

Pair these with a direction utility. For example:

```html
<div class="fade-y fade-always-y">...</div>
```

## CDN Users

Pin CDN URLs to the version your HTML was written against. After migrating to this API, a pinned URL looks like this:

```html
<link rel="stylesheet" href="https://unpkg.com/tw-fade@0.7.0/dist/tw-fade.css" />
```

Unversioned URLs such as `https://unpkg.com/tw-fade/dist/tw-fade.css` track the latest package and will receive breaking API changes.

## Demo Release Note

The demo CSS is generated. After changing the source API or demo markup, run:

```bash
npm run build:demo
npm run ship-demo
```

That keeps the vendored `pete.design` demo in sync with the package docs and generated CSS.
