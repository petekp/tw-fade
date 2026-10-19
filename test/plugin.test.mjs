/** Compiler contracts. Rendering and composition are verified by build/verify*.mjs. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { compile } from '@tailwindcss/node'
import { compileCss } from '../scripts/build-css.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const css = compileCss()
const customCss = compileCss({
  classes: 'fade-size-[15%] fade-size-top-[56px] fade-travel-[80px] fade-clear-14 fade-clear-y-14 fade-clear-x-14 fade-clear-top-14 fade-clear-bottom-14 fade-clear-start-14 fade-clear-end-14',
})
const SCALE = [['xs', 6], ['sm', 8], ['md', 12], ['lg', 16], ['xl', 20], ['2xl', 24], ['3xl', 32], ['4xl', 40]]
const SCOPES = ['', 'x', 'y', 'top', 'bottom', 'start', 'end']
const suffix = (scope) => scope ? `-${scope}` : ''
const directions = ['fade', ...SCOPES.slice(1).map((scope) => `fade-${scope}`)]
const blurDirections = directions.map((name) => name.replace('fade', 'fade-blur'))
const modeNames = ['fade', 'fade-blur'].flatMap((effect) => SCOPES.flatMap((scope) => ['always', 'auto', 'none'].map((mode) => `${effect}-${mode}${suffix(scope)}`)))
const PUBLIC_CLASSES = [
  ...directions, ...blurDirections, ...modeNames, 'fade-blur-layer', 'fade-blur-frame',
  ...['sm', 'md', 'lg'].map((strength) => `fade-blur-${strength}`),
  ...SCOPES.flatMap((scope) => SCALE.map(([step]) => `fade-size${suffix(scope)}-${step}`)),
  ...SCOPES.flatMap((scope) => [...SCALE.map(([step]) => step), 'var'].map((step) => `fade-clear${suffix(scope)}-${step}`)),
  ...SCALE.map(([step]) => `fade-travel-${step}`),
  ...['x', 'y', 'xy'].map((scope) => `fade-scrollbar-safe-${scope}`),
  ...['sm', 'md', 'lg'].map((step) => `fade-scrollbar-width-${step}`),
]
const REJECTED_CLASSES = [
  'fade-t', 'fade-b', 'fade-l', 'fade-r', 'fade-xy', 'fade-left', 'fade-right',
  'fade-block', 'fade-block-start', 'fade-block-end', 'fade-inline', 'fade-inline-start', 'fade-inline-end',
  'fade-range-sm', 'fade-ramp-sm', 'fade-static', 'fade-opaque', 'fade-blur-[4px]',
]
const variantFamilies = [
  'fade-y', 'fade-blur-x', 'fade-blur-lg', 'fade-auto', 'fade-blur-none-y',
  'fade-size-lg', 'fade-clear-top-sm', 'fade-travel-xl', 'fade-scrollbar-safe-y', 'fade-scrollbar-width-sm',
]
const prefixes = ['md:', 'hover:', 'focus-visible:', 'group-hover:', 'data-[open]:', 'md:group-hover:']
const variantClasses = [
  ...prefixes.flatMap((prefix) => variantFamilies.map((name) => prefix + name)),
  ...modeNames.map((name) => 'md:' + name),
]
const sourceCompiler = await compile('@import "tailwindcss"; @import "./src/tw-fade.css";', { base: root, onDependency() {} })
const sourceCss = sourceCompiler.build([...PUBLIC_CLASSES, ...variantClasses, ...REJECTED_CLASSES, 'md:fade-blur-layer', 'md:fade-blur-frame'])

function block(selector, source = css) {
  const match = source.match(new RegExp('(?:^|\\n)[ \t]*' + selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{'))
  if (!match) return null
  const open = source.indexOf('{', match.index)
  let depth = 0
  for (let index = open; index < source.length; index++) {
    if (source[index] === '{') depth++
    else if (source[index] === '}' && --depth === 0) return source.slice(open + 1, index)
  }
  return null
}

function property(name) {
  const body = block('@property ' + name)
  if (body == null) return null
  const field = (key) => body.match(new RegExp(`${key}:\\s*([^;]+);`))?.[1].trim()
  return { syntax: field('syntax'), inherits: field('inherits'), 'initial-value': field('initial-value') }
}

function declValue(body, prop) {
  return body?.match(new RegExp(`${prop}:\\s*([^;]+);`))?.[1].trim()
}

const compact = (value) => value?.replace(/\s+/g, ' ')
const escaped = (name) => '.' + name.replace(/([^\w-])/g, '\\$1')
const classSelectors = (source = css) => new Set([...source.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((match) => match[1]).filter((name) => name === 'fade' || name.startsWith('fade-')))

function ruleDeclarations(name, source = css) {
  const body = block(escaped(name), source)
  assert.ok(body, `missing .${name}`)
  return [...body.matchAll(/(^|[;\n])\s*([\w-]+):\s*([^;]+);/g)].map((match) => [match[2], match[3].trim()])
}

test('standalone inventory contains the complete named API and stays within budget', () => {
  assert.equal(new Set(PUBLIC_CLASSES).size, 194)
  assert.deepEqual([...classSelectors()].sort(), [...PUBLIC_CLASSES].sort())
  for (const name of REJECTED_CLASSES) {
    assert.equal(block(escaped(name)), null, `standalone must not emit ${name}`)
    assert.equal(block(escaped(name), sourceCss), null, `source must not emit retired or unsupported ${name}`)
  }
  assert.ok(Buffer.byteLength(css) <= 90_000, `raw CSS budget exceeded: ${Buffer.byteLength(css)}`)
  const compressedBytes = gzipSync(css).length
  assert.ok(compressedBytes <= 8_000, `gzip CSS budget exceeded: ${compressedBytes}`)
})

test('named configuration and structural utilities agree across distribution paths', () => {
  const effectSelectors = new Set([...directions, ...blurDirections])
  for (const name of PUBLIC_CLASSES.filter((name) => !effectSelectors.has(name))) {
    assert.equal(compact(block(escaped(name), sourceCss)), compact(block(escaped(name))), `named distribution parity: ${name}`)
  }
})

test('source compiles breakpoint, state, and compound variants for every control family', async () => {
  for (const name of variantClasses) assert.ok(block(escaped(name), sourceCss), `missing variant ${name}`)
  assert.equal(block('.md\\:fade-blur-layer', sourceCss), null, 'the layer marker stays structural')
  assert.equal(block('.md\\:fade-blur-frame', sourceCss), null, 'the frame marker stays structural')
  await assert.rejects(
    compile('@import "tailwindcss"; @import "./src/tw-fade.css"; .alias { @apply fade-blur-frame; }', { base:root, onDependency() {} }),
    /Cannot apply unknown utility class `fade-blur-frame`/,
  )
  const blur = block('.md\\:fade-blur-x', sourceCss)
  assert.match(blur, /@media/)
  assert.match(blur, /backdrop-filter/)
  assert.match(blur, /::after/)
  assert.match(blur, /nth-(?:last-)?child/)
  assert.match(block('.md\\:group-hover\\:fade-blur-x', sourceCss), /:hover/)
})

test('activation is one scoped declaration with always, auto, none emission priority', () => {
  for (const source of [css, sourceCss]) {
    for (const prefix of source === css ? [''] : ['', 'md:']) {
      for (const effect of ['fade', 'fade-blur']) {
        for (const scope of SCOPES) {
          const names = ['always', 'auto', 'none'].map((mode) => `${prefix}${effect}-${mode}${suffix(scope)}`)
          const offsets = names.map((name) => source.indexOf(escaped(name) + ' {'))
          assert.ok(offsets.every((offset) => offset >= 0) && offsets[0] < offsets[1] && offsets[1] < offsets[2], `mode priority: ${names.join(', ')}`)
          const declarations = names.map((name) => ruleDeclarations(name, source))
          assert.ok(declarations.every((values) => values.length === 1), `modes must remain pure setters: ${names}`)
          assert.ok(declarations.every((values) => values[0][0] === declarations[0][0][0]), `same scope must replace one property: ${names}`)
          assert.equal(new Set(declarations.map((values) => values[0][1])).size, 3, `auto, always, and none must remain distinct: ${names}`)
          assert.doesNotMatch(declarations.flat().join(' '), /!important|animation|mask|anchor|--tw-fade-[tblr]\b/)
        }
      }
    }
  }
})

test('configuration utilities do not initialize either renderer', () => {
  const setters = [...modeNames, 'fade-blur-sm', 'fade-blur-md', 'fade-blur-lg', 'fade-size-lg', 'fade-clear-top-sm', 'fade-travel-sm']
  for (const name of setters) {
    const declarations = ruleDeclarations(name)
    assert.equal(declarations.length, 1, `${name} only sets its configuration`)
    assert.ok(declarations[0][0].startsWith('--tw-fade-'))
    assert.doesNotMatch(block(escaped(name)), /::after|mask-image|animation:|anchor-name|display:/, `${name} must not create an effect`)
  }
  assert.equal(declValue(block('.fade-blur-layer'), 'display'), 'none')
})

test('local configuration can be absent and raw progress stays non-inheriting', () => {
  for (const edge of ['t', 'b', 'l', 'r']) {
    const raw = property(`--tw-fade-${edge}`)
    assert.equal(raw.syntax, '"<number>"')
    assert.equal(raw.inherits, 'false')
    assert.equal(raw['initial-value'], '0')
  }
  for (const name of [...modeNames, ...SCOPES.map((scope) => `fade-size${suffix(scope)}-sm`), ...SCOPES.map((scope) => `fade-clear${suffix(scope)}-sm`), 'fade-travel-sm']) {
    const [prop] = ruleDeclarations(name)[0]
    const registration = property(prop)
    assert.equal(registration?.syntax, '"*"', `${name} must distinguish unset configuration`)
    assert.equal(registration?.inherits, 'false', `${name} must stay local to its host`)
    assert.equal(registration?.['initial-value'], undefined)
  }
})

test('scrollbar opt-ins keep the pin, strips, and gutter inside their capability gate', () => {
  for (const scope of ['x', 'y', 'xy']) {
    const body = block(`.fade-scrollbar-safe-${scope}`)
    const gated = block('@supports (animation-timeline: scroll())', body)
    assert.ok(gated, `missing gated scrollbar ${scope}`)
    const outside = body.replace(gated, '')
    assert.doesNotMatch(outside, /scrollbar-gutter:|scrollbar-width:|--tw-fade-scrollbar:|--tw-fade-scrollbar-block:|width:/)
    const pinned = block('&::-webkit-scrollbar', gated)
    assert.equal(declValue(pinned, 'width'), 'max(0px, var(--tw-fade-scrollbar-width, 15px))')
    assert.equal(declValue(pinned, 'height'), 'max(0px, var(--tw-fade-scrollbar-width, 15px))')
    const webkit = block('@supports selector(::-webkit-scrollbar)', gated)
    assert.ok(webkit)
    assert.equal(declValue(webkit, '--tw-fade-scrollbar'), scope === 'x' ? undefined : 'max(0px, var(--tw-fade-scrollbar-width, 15px))')
    assert.equal(declValue(webkit, '--tw-fade-scrollbar-block'), scope === 'y' ? undefined : 'max(0px, var(--tw-fade-scrollbar-width, 15px))')
    assert.equal(declValue(gated, 'scrollbar-gutter'), scope === 'x' ? undefined : 'stable')
  }
  for (const name of ['--tw-fade-scrollbar', '--tw-fade-scrollbar-block']) {
    assert.deepEqual(property(name), { syntax: '"<length>"', inherits: 'false', 'initial-value': '0px' })
  }
  assert.deepEqual(property('--tw-fade-scrollbar-width'), { syntax: '"<length>"', inherits: 'true', 'initial-value': '15px' })
})

test('negative arbitrary scrollbar width stays a setter and geometry consumers clamp it', () => {
  const negative = compileCss({ classes: 'fade-scrollbar-width-[-5px] fade-scrollbar-safe-x fade-scrollbar-safe-y fade-scrollbar-safe-xy' })
  assert.equal(declValue(block('.fade-scrollbar-width-\\[-5px\\]', negative), '--tw-fade-scrollbar-width'), '-5px')
  for (const name of ['x', 'y', 'xy']) {
    const body = block(`.fade-scrollbar-safe-${name}`, negative)
    for (const prop of ['width', 'height']) assert.equal(declValue(block('&::-webkit-scrollbar', body), prop), 'max(0px, var(--tw-fade-scrollbar-width, 15px))')
  }
})
test('every typed @property has a computationally-independent initial-value', () => {
  const ABSOLUTE = /^-?(?:\d+\.?\d*|\.\d+)(px|cm|mm|in|pt|pc|q)?$/i
  const names = [...css.matchAll(/@property\s+(--[\w-]+)\s*\{/g)].map((m) => m[1])
  assert.ok(names.length >= 20, 'expected registered properties')
  for (const name of names) {
    const decl = property(name)
    if (decl.syntax === '"*"') {
      assert.equal(decl['initial-value'], undefined, `${name} (universal) should omit initial-value`)
      continue
    }
    const initial = decl['initial-value']
    assert.ok(initial !== undefined, `typed ${name} must declare an initial-value`)
    for (const token of String(initial).split(/[\s,()]+/).filter(Boolean)) {
      if (!/\d/.test(token)) continue
      assert.match(token, ABSOLUTE, `typed ${name} initial token "${token}" must be unitless or absolute`)
    }
  }
})


test('prebuilt dist is generated from the current default compile output', () => {
  const dist = fs.readFileSync(path.join(root, 'dist', 'tw-fade.css'), 'utf8')
  assert.equal(dist, css)
})


test('shipped CSS carries no retired reveal/range/ramp token names', () => {
  const retired = [
    /fade-reveal/,
    /fade-range/,
    /fade-ramp/,
    /--fade-reveal/,
    /--fade-range/,
    /--fade-ramp/,
    /--tw-fade-reveal/,
    /--tw-fade-range/,
    /--tw-fade-ramp/,
    /tw-fade-reveal/,
    /tw-fade-range/,
    /tw-fade-ramp/,
  ]
  for (const file of ['src/tw-fade.css', 'dist/tw-fade.css']) {
    const source = fs.readFileSync(path.join(root, file), 'utf8')
    for (const pattern of retired) {
      assert.equal(pattern.test(source), false, `${file} still contains retired token ${pattern}`)
    }
  }
})


test('leading and trailing keyframes include RTL horizontal variants', () => {
  const kf = (n) => block('@keyframes ' + n)
  assert.match(kf('tw-fade-travel-t'), /from\s*\{[^}]*--tw-fade-t:\s*0/)
  assert.match(kf('tw-fade-travel-t'), /to\s*\{[^}]*--tw-fade-t:\s*1/)
  assert.match(kf('tw-fade-travel-b'), /from\s*\{[^}]*--tw-fade-b:\s*1/)
  assert.match(kf('tw-fade-travel-b'), /to\s*\{[^}]*--tw-fade-b:\s*0/)
  assert.match(kf('tw-fade-travel-l'), /from\s*\{[^}]*--tw-fade-l:\s*0/)
  assert.match(kf('tw-fade-travel-r'), /from\s*\{[^}]*--tw-fade-r:\s*1/)
  assert.match(kf('tw-fade-travel-r-leading'), /from\s*\{[^}]*--tw-fade-r:\s*0/)
  assert.match(kf('tw-fade-travel-r-leading'), /to\s*\{[^}]*--tw-fade-r:\s*1/)
  assert.match(kf('tw-fade-travel-l-trailing'), /from\s*\{[^}]*--tw-fade-l:\s*1/)
  assert.match(kf('tw-fade-travel-l-trailing'), /to\s*\{[^}]*--tw-fade-l:\s*0/)
})


test('scrollbar vars never appear without a fallback, so @property stays optional', () => {
  // The three scrollbar properties are only ever DECLARED inside
  // @supports selector(::-webkit-scrollbar) (the first two) or by the author
  // (the third). Everywhere else their value comes solely from the @property
  // initial-value. On an engine without @property -- Safari 15.4-16.3, Firefox
  // < 128 -- a bare var() to an undeclared property is a guaranteed-invalid
  // value, and since these are substituted into mask-size that takes the WHOLE
  // declaration down at computed-value time: all six layers fall back to
  // `auto`, the two 0px strips become full-size opaque layers, `add` paints
  // over everything, and the fade silently disappears. 0.7.1 rendered fine on
  // those engines; the strips are what introduced the dependency.
  //
  // Rendering proof lives in build/verify-scrollbar.mjs (it strips the
  // @property blocks and re-renders). This is the cheap build-time guard.
  const bare = [...css.matchAll(/var\((--tw-fade-scrollbar(?:-block|-width)?)\s*([,)])/g)].filter(
    (m) => m[2] === ')',
  )
  assert.deepEqual(
    bare.map((m) => m[0]),
    [],
    'every scrollbar var() must carry a fallback, e.g. var(--tw-fade-scrollbar, 0px)',
  )
})


test('fade-scrollbar-width-* is a pure setter over an absolute-px scale', () => {
  // Three steps, real native bar widths. Absolute px, not the spacing ramp the
  // other scales use: a scrollbar is device chrome and should not resize with
  // the root font.
  const theme = block(':root, :host')
  for (const [name, px] of [['sm', '11px'], ['md', '15px'], ['lg', '17px']]) {
    assert.equal(declValue(theme, `--fade-scrollbar-width-${name}`), px)
    const rule = block(`.fade-scrollbar-width-${name}`)
    assert.ok(rule, `missing .fade-scrollbar-width-${name}`)
    assert.equal(declValue(rule, '--tw-fade-scrollbar-width'), `var(--fade-scrollbar-width-${name})`)
    // Sets ONE property and nothing else. The utility is meant to go on
    // ancestors (<body class="fade-scrollbar-width-lg">) so a house style can be
    // stated once; if it also enabled, it would pin and gutter the page itself.
    assert.equal(declValue(rule, 'scrollbar-gutter'), undefined)
    assert.equal(declValue(rule, '--tw-fade-scrollbar'), undefined)
    assert.equal(declValue(rule, '--tw-fade-scrollbar-block'), undefined)
  }

  // No --value(integer) branch: elsewhere a bare integer means spacing steps,
  // here it would read as px, and the two answers differ by 4x.
  const bare = compileCss({ classes: 'fade-scrollbar-width-4 fade-scrollbar-width-thin' })
  assert.equal(block('.fade-scrollbar-width-4', bare), null, 'a bare integer must not compile')
  // And the scale is deliberately not named after scrollbar-width's keywords --
  // that property must never be set here, since it cancels the pin.
  assert.equal(block('.fade-scrollbar-width-thin', bare), null, 'must not shadow the real keyword')
})


test('exposes the size and travel scales as theme-backed utilities', () => {
  for (const [name] of SCALE) {
    assert.equal(declValue(block(`.fade-size-${name}`), '--tw-fade-size'), `var(--fade-size-${name})`)
    assert.equal(declValue(block(`.fade-size-y-${name}`), '--tw-fade-size-y'), `var(--fade-size-${name})`)
    assert.equal(declValue(block(`.fade-size-x-${name}`), '--tw-fade-size-x'), `var(--fade-size-${name})`)
    assert.equal(declValue(block(`.fade-size-top-${name}`), '--tw-fade-size-top'), `var(--fade-size-${name})`)
    assert.equal(declValue(block(`.fade-size-bottom-${name}`), '--tw-fade-size-bottom'), `var(--fade-size-${name})`)
    assert.equal(declValue(block(`.fade-size-start-${name}`), '--tw-fade-size-start'), `var(--fade-size-${name})`)
    assert.equal(declValue(block(`.fade-size-end-${name}`), '--tw-fade-size-end'), `var(--fade-size-${name})`)
    assert.equal(declValue(block(`.fade-travel-${name}`), '--tw-fade-travel'), `var(--fade-travel-${name})`)
  }
  const rootBlock = block(':root, :host')
  for (const [name, units] of SCALE) {
    const expected = `calc(var(--spacing, 0.25rem) * ${units})`
    assert.equal(declValue(rootBlock, `--fade-size-${name}`), expected)
    assert.equal(declValue(rootBlock, `--fade-travel-${name}`), expected)
  }
  assert.equal(block('.fade-range-sm'), null)
  assert.equal(block('.fade-size-left-sm'), null)
})


test('arbitrary size and travel utilities compile only through the source path', () => {
  assert.equal(declValue(block('.fade-size-\\[15\\%\\]', customCss), '--tw-fade-size'), '15%')
  assert.equal(declValue(block('.fade-size-top-\\[56px\\]', customCss), '--tw-fade-size-top'), '56px')
  assert.equal(declValue(block('.fade-travel-\\[80px\\]', customCss), '--tw-fade-travel'), '80px')
  assert.equal(block('.fade-size-\\[15\\%\\]'), null)
  assert.equal(block('.fade-travel-\\[80px\\]'), null)
})


test('exposes directional clear utilities and source-path integer clear values', () => {
  for (const [name] of SCALE) {
    assert.equal(declValue(block(`.fade-clear-${name}`), '--tw-fade-clear'), `var(--fade-clear-${name})`)
    assert.equal(declValue(block(`.fade-clear-y-${name}`), '--tw-fade-clear-y'), `var(--fade-clear-${name})`)
    assert.equal(declValue(block(`.fade-clear-x-${name}`), '--tw-fade-clear-x'), `var(--fade-clear-${name})`)
    assert.equal(declValue(block(`.fade-clear-top-${name}`), '--tw-fade-clear-top'), `var(--fade-clear-${name})`)
    assert.equal(declValue(block(`.fade-clear-bottom-${name}`), '--tw-fade-clear-bottom'), `var(--fade-clear-${name})`)
    assert.equal(declValue(block(`.fade-clear-start-${name}`), '--tw-fade-clear-start'), `var(--fade-clear-${name})`)
    assert.equal(declValue(block(`.fade-clear-end-${name}`), '--tw-fade-clear-end'), `var(--fade-clear-${name})`)
  }
  const expected = 'calc(var(--spacing, 0.25rem) * 14)'
  assert.equal(declValue(block('.fade-clear-14', customCss), '--tw-fade-clear'), expected)
  assert.equal(declValue(block('.fade-clear-top-14', customCss), '--tw-fade-clear-top'), expected)
  assert.equal(declValue(block('.fade-clear-start-14', customCss), '--tw-fade-clear-start'), expected)
  assert.equal(block('.fade-clear-left-sm'), null)
  assert.equal(block('.fade-clear-xy-sm'), null)
})


test('dynamic clear variables follow edge to axis to global precedence', () => {
  assert.equal(declValue(block('.fade-clear-var'), '--tw-fade-clear'), 'var(--fade-clear, 0px)')
  assert.equal(declValue(block('.fade-clear-y-var'), '--tw-fade-clear-y'), 'var(--fade-clear-y, var(--fade-clear, 0px))')
  assert.equal(declValue(block('.fade-clear-x-var'), '--tw-fade-clear-x'), 'var(--fade-clear-x, var(--fade-clear, 0px))')
  assert.equal(
    declValue(block('.fade-clear-top-var'), '--tw-fade-clear-top'),
    'var(--fade-clear-top, var(--fade-clear-y, var(--fade-clear, 0px)))',
  )
  assert.equal(
    declValue(block('.fade-clear-bottom-var'), '--tw-fade-clear-bottom'),
    'var(--fade-clear-bottom, var(--fade-clear-y, var(--fade-clear, 0px)))',
  )
  assert.equal(
    declValue(block('.fade-clear-start-var'), '--tw-fade-clear-start'),
    'var(--fade-clear-start, var(--fade-clear-x, var(--fade-clear, 0px)))',
  )
  assert.equal(
    declValue(block('.fade-clear-end-var'), '--tw-fade-clear-end'),
    'var(--fade-clear-end, var(--fade-clear-x, var(--fade-clear, 0px)))',
  )
})


test('the framework-free build is real CSS, self-contained, with no Tailwind noise', () => {
  for (const token of ['@utility', '@theme', '@apply', '--value(']) {
    assert.ok(!css.includes(token), `compiled output must not contain ${token}`)
  }
  assert.ok(!/--tw-(?!fade-)/.test(css), 'no Tailwind core --tw-* variables should leak in')
  assert.ok(!/\.flex\s*\{|\.grid\s*\{|\.border\s*\{/.test(css), 'no built-in utilities should leak in')
})
