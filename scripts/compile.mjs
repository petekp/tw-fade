/**
 * compile.mjs — turn the Tailwind plugin into a framework-free CSS string.
 *
 * The plugin in `src/index.js` is the single source of truth for every rule.
 * Rather than maintain a second hand-written stylesheet (which would inevitably
 * drift), we run the plugin against a minimal mock of Tailwind's plugin API,
 * collect the CSS-in-JS it emits, and serialize that to plain CSS.
 *
 * The result is a zero-noise drop-in: only the plugin's `@property` /
 * `@keyframes` / `@supports` foundations and its `.fade-*` utilities, with
 * none of the `--tw-*` base-variable defaults a full `@tailwind base` build drags
 * along. It's also what the unit tests assert against.
 */
import { createRequire } from 'node:module'

const requireCjs = createRequire(import.meta.url)

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

/** Resolve a dotted theme path (e.g. "twFade.size.DEFAULT") against an object. */
function resolvePath(root, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), root)
}

/**
 * Recursively serialize a CSS-in-JS node to a CSS string.
 * Object values become nested blocks (at-rules, selectors, keyframe steps);
 * string values become `prop: value;` declarations. Insertion order is
 * preserved, which is exactly the cascade order we want (base before utilities).
 */
function serialize(node, indent = '') {
  let out = ''
  for (const [key, value] of Object.entries(node)) {
    if (isPlainObject(value)) {
      const inner = serialize(value, indent + '  ')
      out += `${indent}${key} {\n${inner}${indent}}\n`
    } else {
      out += `${indent}${key}: ${value};\n`
    }
  }
  return out
}

/**
 * Run the plugin and return { base, utilities } — two ordered CSS-in-JS trees.
 * `options` are the same options accepted by the plugin (size, range, …).
 */
export function collect(options = {}) {
  const pluginExport = requireCjs('../src/index.js')
  const { handler, config } = pluginExport(options)

  const base = {}
  const utilities = {}

  const theme = (path) => resolvePath(config?.theme ?? {}, path)

  const api = {
    addBase: (obj) => Object.assign(base, obj),
    addUtilities: (obj) => Object.assign(utilities, obj),
    matchUtilities: (utils, opts = {}) => {
      const values = opts.values || {}
      for (const [name, fn] of Object.entries(utils)) {
        for (const [key, value] of Object.entries(values)) {
          // A `DEFAULT` key would emit a no-op bare utility (`.fade-size`);
          // skip it — the named scale (sm/md/lg) is what's useful in static CSS.
          if (key === 'DEFAULT') continue
          utilities[`.${name}-${key}`] = fn(value)
        }
      }
    },
    theme,
  }

  handler(api)
  return { base, utilities }
}

/** Compile the plugin to a complete framework-free CSS string. */
export function compileCss(options = {}) {
  const { base, utilities } = collect(options)
  const banner =
    '/*! tw-fade — framework-free build. Generated from src/index.js; do not edit by hand. */\n'
  return banner + serialize(base) + serialize(utilities)
}
