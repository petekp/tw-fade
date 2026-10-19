/** Verify the standalone artifact and the source API through rendered outcomes. */
import { chromium, firefox } from 'playwright'
import { compile } from '@tailwindcss/node'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const css = fs.readFileSync(path.join(root, 'dist/tw-fade.css'), 'utf8')
const defaultClassInventory = [...new Set(
  [...css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)]
    .map((match) => match[1])
    .filter((name) => name === 'fade' || name.startsWith('fade-')),
)]
const failures = []
let passed = 0
const edges = ['t', 'b', 'l', 'r']
const scopes = ['', 'x', 'y', 'top', 'bottom', 'start', 'end']
const scopeEdges = { '': edges, x: ['l', 'r'], y: ['t', 'b'], top: ['t'], bottom: ['b'], start: ['l'], end: ['r'] }
const approx = (a, b, tolerance = 0.035) => Number.isFinite(a) && Math.abs(a - b) <= tolerance
const allNear = (actual, expected) => actual.every((value, i) => approx(value, expected[i]))
const zero = [0, 0, 0, 0]
const amounts = ({ raw, opacity, blur }) => ({ raw, opacity, blur })
const layerMarkup = '<span class="fade-blur-layer" aria-hidden="true"></span>'
const harness = `
  * { box-sizing: border-box; }
  body { margin: 24px; background: #ddd; font: 14px system-ui; }
  .sample { width: 240px; height: 240px; }
  .sample-scrollport { height: 100%; overflow: auto; background: white; scrollbar-width: none; }
  .content { width: 800px; height: 800px; background: linear-gradient(to right, black 120px, white 120px); }
  .short { width: 100%; height: 80px; }
`

function check(ok, label, detail) {
  if (ok) passed++
  else failures.push(`${label}${detail === undefined ? '' : `: ${JSON.stringify(detail)}`}`)
}

async function settle(page) {
  await page.waitForTimeout(70)
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
}

function markup(classes, { id = 'sample', count = 0, style = '', dir = '', contentStyle = '', content = '' } = {}) {
  return `<div id="${id}" class="sample fade-blur-frame ${classes}" tabindex="0" style="${style}" ${dir ? `dir="${dir}"` : ''}>` +
    `<div class="sample-scrollport" tabindex="0"><div class="content" style="${contentStyle}">${content}</div></div>` + layerMarkup.repeat(count) + '</div>'
}

async function render(page, classes, options = {}, stylesheet = css) {
  await page.setContent(`<!doctype html><style>${stylesheet}${harness}</style>${markup(classes, options)}`)
  await settle(page)
}

async function scroll(page, top = 4, left = 4) {
  await page.locator('.sample-scrollport').evaluateAll((elements, [t, l]) => {
    for (const element of elements) {
      element.scrollTop = t
      element.scrollLeft = getComputedStyle(element).direction === 'rtl' ? -l : l
    }
  }, [top, left])
  await settle(page)
}

async function states(page) {
  return page.locator('.sample').evaluateAll((elements) => elements.map((element) => {
    const scrollport = element.querySelector(':scope > .sample-scrollport') ?? element
    const style = getComputedStyle(element)
    const pseudo = getComputedStyle(element, '::after')
    const read = (prefix) => ['t', 'b', 'l', 'r'].map((edge) => Number(style.getPropertyValue(`${prefix}${edge}`).trim()))
    const rect = element.getBoundingClientRect()
    const layers = Array.from(element.querySelectorAll(':scope > .fade-blur-layer'), (layer) => {
      const layerStyle = getComputedStyle(layer)
      const bounds = layer.getBoundingClientRect()
      return { display: layerStyle.display, filter: layerStyle.backdropFilter, z: Number(layerStyle.zIndex), x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
    })
    return {
      id: element.id, raw: read('--tw-fade-'), opacity: read('--tw-fade-opacity-'), blur: read('--tw-fade-blur-'),
      top: scrollport.scrollTop, left: scrollport.scrollLeft, width: scrollport.clientWidth, height: scrollport.clientHeight,
      scrollWidth: scrollport.scrollWidth, scrollHeight: scrollport.scrollHeight,
      mask: getComputedStyle(scrollport).maskImage, maskSize: getComputedStyle(scrollport).maskSize,
      anchor: style.anchorName,
      animation: style.animationName.split(',').map((value) => value.trim()),
      timeline: (style.animationTimeline || '').split(',').map((value) => value.trim()),
      ranges: style.animationRangeEnd,
      pseudo: { content: pseudo.content, filter: pseudo.backdropFilter, mask: pseudo.maskImage, z: Number(pseudo.zIndex), pointer: pseudo.pointerEvents },
      geometry: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, layers,
    }
  }))
}

async function state(page) {
  return (await states(page))[0]
}

async function pixels(page) {
  const png = await page.locator('#sample').screenshot()
  return page.evaluate(async (url) => {
    const image = new Image()
    image.src = url
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const context = canvas.getContext('2d')
    context.drawImage(image, 0, 0)
    const profile = (y) => {
      const row = context.getImageData(40, y, 160, 1).data
      const values = Array.from({ length: 160 }, (_, i) => row[i * 4])
      const contrast = values.at(-1) - values[0]
      return Math.max(...values.slice(1).map((value, i) => value - values[i])) / contrast
    }
    return {
      edge: profile(24), center: profile(120), clear: profile(16),
      nearEdge: context.getImageData(60, 1, 1, 1).data[0],
      inside: context.getImageData(60, 60, 1, 1).data[0],
      nearBottom: context.getImageData(60, image.height - 2, 1, 1).data[0],
      nearLeft: context.getImageData(1, 80, 1, 1).data[0],
      nearRight: context.getImageData(image.width - 2, 80, 1, 1).data[0],
    }
  }, 'data:image/png;base64,' + png.toString('base64'))
}

async function checkNamedApi(page, stylesheet = css) {
  const renderWithStylesheet = (classes, options = {}) => render(page, classes, options, stylesheet)
  const combinations = [
    ['fade-y', [1, 1, 0, 0], zero],
    ['fade-blur-y', zero, [1, 1, 0, 0]],
    ['fade-y fade-blur-y', [1, 1, 0, 0], [1, 1, 0, 0]],
    ['fade-bottom fade-blur-top', [0, 1, 0, 0], [1, 0, 0, 0]],
    ['fade-top fade-bottom fade-blur-x fade-blur-top', [1, 1, 0, 0], [1, 0, 1, 1]],
    ['fade-y fade-blur-y fade-none', zero, [1, 1, 0, 0]],
    ['fade-y fade-blur-y fade-blur-none', [1, 1, 0, 0], zero],
    ['fade fade-always fade-none-x', [1, 1, 0, 0], zero],
    ['fade fade-none fade-always-y', [1, 1, 0, 0], zero],
    ['fade-blur fade-blur-none fade-blur-always-y', zero, [1, 1, 0, 0]],
  ]
  await page.setContent(`<!doctype html><style>${stylesheet}${harness}</style>` + combinations.map(([classes], index) => markup(classes, { id: `combination-${index}` })).join(''))
  await scroll(page, 100, 100)
  for (const [index, got] of (await states(page)).entries()) {
    const [classes, opacity, blur] = combinations[index]
    check(allNear(got.opacity, opacity) && allNear(got.blur, blur), `independent selection: ${classes}`, amounts(got))
    check(got.animation.length === 4 && new Set(got.animation.filter((name) => name !== 'none')).size === got.animation.filter((name) => name !== 'none').length && got.timeline.length === 4,
      `one four-slot raw animation set: ${classes}`, { names: got.animation, timeline: got.timeline })
  }

  for (const classes of ['fade-blur-lg', 'fade-blur-always-y', 'fade-none-top', 'fade-auto', 'fade-size-lg fade-clear-top-sm']) {
    await renderWithStylesheet(classes, { count: 4 })
    const got = await state(page)
    check(got.mask === 'none' && got.anchor === 'none' && got.pseudo.content === 'none' && got.layers.every((layer) => layer.display === 'none'),
      `configuration alone is inert: ${classes}`, got)
  }

  await renderWithStylesheet('fade-y fade-blur-y fade-always')
  await scroll(page)
  let got = await state(page)
  check(allNear(got.opacity, [1, 1, 0, 0]) && allNear(got.blur, [got.raw[0], got.raw[1], 0, 0]) && got.raw[0] > 0 && got.raw[0] < 1,
    'opacity can be forced while blur follows the same raw scroll', got)
  await renderWithStylesheet('fade-y fade-blur-y fade-always fade-none-y fade-auto-top fade-blur-none fade-blur-auto-top')
  await scroll(page)
  got = await state(page)
  check(allNear(got.opacity, [got.raw[0], 0, 0, 0]) && allNear(got.blur, [got.raw[0], 0, 0, 0]),
    'explicit edge auto overrides axis and global modes independently', got)

  const modeSets = [[], ['auto'], ['always'], ['none'], ['none', 'always'], ['none', 'auto'], ['auto', 'always'], ['auto', 'always', 'none']]
  const cases = []
  for (const namespace of ['fade', 'fade-blur']) {
    for (const scope of scopes) {
      for (const modes of modeSets) {
        for (const ordered of [modes, [...modes].reverse()]) {
          cases.push({ namespace, scope, modes, classes: `${namespace} ${ordered.map((mode) => `${namespace}-${mode}${scope ? `-${scope}` : ''}`).join(' ')}` })
        }
      }
    }
  }
  await page.setContent(`<!doctype html><style>${stylesheet}${harness}</style>` + cases.map(({ classes }, index) => markup(classes, { id: `mode-${index}` })).join(''))
  await scroll(page)
  const resolved = await states(page)
  for (const [index, got] of resolved.entries()) {
    const { namespace, scope, modes, classes } = cases[index]
    const winner = modes.includes('none') ? 'none' : modes.includes('auto') ? 'auto' : modes.includes('always') ? 'always' : 'auto'
    const expected = edges.map((edge, i) => scopeEdges[scope].includes(edge) && winner !== 'auto' ? (winner === 'always' ? 1 : 0) : got.raw[i])
    check(allNear(got[namespace === 'fade' ? 'opacity' : 'blur'], expected), `mode truth table: ${classes}`, { expected, ...amounts(got) })
    check(allNear(got.raw, resolved[0].raw), `mode leaves raw progress unchanged: ${classes}`, got.raw)
  }

  await renderWithStylesheet('fade-y fade-blur-y')
  await scroll(page, 0, 0)
  const start = await state(page)
  await scroll(page, 100, 100)
  const middle = await state(page)
  await scroll(page, 10000, 10000)
  const end = await state(page)
  check(allNear(start.opacity, [0, 1, 0, 0]) && allNear(middle.opacity, [1, 1, 0, 0]) && allNear(end.opacity, [1, 0, 0, 0]), 'scroll endpoints retain opacity behavior', { start, middle, end })
  check(allNear(start.blur, start.opacity) && allNear(middle.blur, middle.opacity) && allNear(end.blur, end.opacity), 'both effects follow shared endpoints')

  await page.locator('.content').evaluate((element) => { element.style.width = '100%'; element.style.height = '80px' })
  await settle(page)
  got = await state(page)
  check(allNear(got.raw, zero) && allNear(got.opacity, zero) && allNear(got.blur, zero), 'same-node shrink clears both effects', got)
  await page.locator('.content').evaluate((element) => { element.style.width = '800px'; element.style.height = '800px' })
  await scroll(page, 100, 100)
  got = await state(page)
  check(allNear(got.opacity, [1, 1, 0, 0]) && allNear(got.blur, [1, 1, 0, 0]), 'same-node growth resumes both effects', got)
  await page.locator('.sample').evaluate((element) => { element.style.width = '900px'; element.style.height = '900px' })
  await settle(page)
  got = await state(page)
  check(allNear(got.raw, zero) && allNear(got.opacity, zero) && allNear(got.blur, zero), 'resize removing overflow clears both effects', got)

  await page.setContent(`<!doctype html><style>${stylesheet}${harness}</style><div dir="rtl">${markup('fade-end fade-blur-start', { id: 'inherited' })}</div>`)
  await scroll(page, 100, 100)
  got = await state(page)
  check(allNear(got.opacity, [0, 0, 1, 0]) && allNear(got.blur, [0, 0, 0, 1]), 'inherited RTL routes opacity end and blur start independently', got)

  await page.setContent(`<!doctype html><style>${stylesheet}${harness}</style>` + markup('fade fade-blur fade-none fade-blur-always fade-size-lg', {
    id: 'outer', content: markup('fade-y fade-blur-top', { id: 'inner', contentStyle: 'width:100%;height:80px' }),
  }))
  await scroll(page, 100, 100)
  const nested = await states(page)
  check(allNear(nested[1].opacity, zero) && allNear(nested[1].blur, zero), 'nested host does not inherit parent selection or activation', nested)
  check(nested[1].scrollWidth === nested[1].width && nested[1].scrollHeight === nested[1].height, 'nested blur overlays do not create overflow', nested[1])
}

async function checkConditions(page, sourceClassInventory) {
  const transitions = []
  for (const namespace of ['fade', 'fade-blur']) {
    for (const before of ['auto', 'always', 'none']) {
      for (const after of ['auto', 'always', 'none']) {
        if (before !== after) transitions.push({ namespace, before, after, classes: `${namespace}-y ${namespace}-${before} md:${namespace}-${after}` })
      }
    }
  }
  const variants = [
    'fade-y fade-always hover:fade-auto',
    'fade-blur-y fade-blur-none focus-visible:fade-blur-always',
    'fade-y fade-none group-hover:fade-always',
    'fade-blur-y fade-blur-always data-[paused]:fade-blur-none',
    'max-md:fade-y md:fade-x', 'fade-y md:fade-x',
    'fade-y fade-always max-md:fade-auto-y',
    'fade-blur-y fade-blur-none-y md:fade-blur-auto',
    'fade-blur-y fade-blur-none-y md:fade-blur-auto-y',
    'fade-y md:fade-auto md:fade-always', 'fade-y md:fade-none md:fade-always',
    'md:fade-blur-top group-hover:fade-blur-end md:fade-blur-lg',
  ]
  const compiler = await compile(`
    @import "tailwindcss";
    @import "./src/tw-fade.css";
    @layer components {
      .component-config { @apply fade-size-lg fade-clear-top-sm fade-travel-lg; --tw-fade-onset: 2; }
      .component-effects { @apply fade-y fade-blur-x; }
    }
  `, { base: root, onDependency() {} })
  const pixelClasses = [
    'fade', 'fade-top', 'fade-y', 'fade-none', 'fade-always', 'fade-always-x',
    'fade-always-y', 'fade-none-y', 'fade-none-top', 'fade-auto-top',
    'fade-blur', 'fade-blur-top', 'fade-blur-y', 'fade-blur-always',
    'fade-blur-layer', 'fade-blur-frame', 'fade-size-sm', 'fade-size-lg', 'fade-size-4xl', 'fade-size-y-4xl',
    'fade-size-y-md', 'fade-size-top-sm', 'fade-clear-top-sm', 'fade-travel-lg',
    'fade-blur-sm', 'fade-blur-md', 'fade-blur-lg',
  ]
  const sourceCss = compiler.build([
    ...sourceClassInventory,
    ...transitions.flatMap(({ classes }) => classes.split(' ')),
    ...variants.flatMap((classes) => classes.split(' ')), 'group',
    'fade-top', 'fade-blur-top', 'fade-size-lg', 'fade-clear-top-sm', 'fade-travel-lg',
    ...pixelClasses,
  ])
  await page.setContent(`<!doctype html><style>${sourceCss}${harness}</style>` +
    markup('component-config fade-top fade-blur-top', { id: 'component-config' }) +
    markup('fade-top fade-blur-top fade-size-lg fade-clear-top-sm fade-travel-lg', { id: 'utility-config', style: '--tw-fade-onset:2' }) +
    markup('component-effects', { id: 'component-effects' }))
  await scroll(page)
  const [componentConfig, utilityConfig, appliedEffects] = await states(page)
  const componentOnset = await page.locator('#component-config').evaluate((element) =>
    getComputedStyle(element).getPropertyValue('--tw-fade-onset').trim(),
  )
  check(componentOnset === '2', 'component-layer author onset overrides the renderer default', componentOnset)
  check(allNear(componentConfig.raw, utilityConfig.raw) && componentConfig.mask === utilityConfig.mask && componentConfig.pseudo.mask === utilityConfig.pseudo.mask,
    'component-layer size, clear, and travel produce the same rendered masks as utility configuration', { componentConfig, utilityConfig })
  check(allNear(appliedEffects.opacity, [appliedEffects.raw[0], appliedEffects.raw[1], 0, 0]) && allNear(appliedEffects.blur, [0, 0, appliedEffects.raw[2], appliedEffects.raw[3]]) && appliedEffects.raw.every((value) => value > 0),
    '@apply composes opacity and blur selectors without clearing their selections or timelines', amounts(appliedEffects))
  await page.setViewportSize({ width: 600, height: 600 })
  await page.setContent(`<!doctype html><style>${sourceCss}${harness}</style>` + transitions.map(({ classes }, index) => markup(classes, { id: `transition-${index}` })).join(''))
  const expected = (mode, raw) => [mode === 'auto' ? raw[0] : mode === 'always' ? 1 : 0, mode === 'none' ? 0 : 1, 0, 0]
  for (const [width, phase] of [[600, 'before'], [900, 'after'], [600, 'before']]) {
    await page.setViewportSize({ width, height: 600 })
    await scroll(page)
    for (const [index, got] of (await states(page)).entries()) {
      const test = transitions[index]
      check(allNear(got[test.namespace === 'fade' ? 'opacity' : 'blur'], expected(test[phase], got.raw)), `breakpoint ${phase}: ${test.classes}`, amounts(got))
    }
  }
  const scopedCases = [
    [variants[4], 'opacity', [1, 1, 0, 0], [0, 0, 1, 1]],
    [variants[5], 'opacity', [1, 1, 0, 0], [1, 1, 1, 1]],
    [variants[6], 'opacity', 'raw', [1, 1, 0, 0]],
    [variants[7], 'blur', zero, zero],
    [variants[8], 'blur', zero, 'raw'],
    [variants[9], 'opacity', 'raw', 'raw'],
    [variants[10], 'opacity', 'raw', zero],
  ]
  await page.setContent(`<!doctype html><style>${sourceCss}${harness}</style>` + scopedCases.map(([classes], index) => markup(classes, { id: `scope-${index}` })).join(''))
  for (const [width, index] of [[600, 2], [900, 3], [600, 2]]) {
    await page.setViewportSize({ width, height: 600 })
    await scroll(page)
    for (const [caseIndex, got] of (await states(page)).entries()) {
      const [classes, effect] = scopedCases[caseIndex]
      const wanted = scopedCases[caseIndex][index]
      const expectedAmounts = wanted === 'raw' ? [got.raw[0], got.raw[1], 0, 0] : wanted.map((amount, edge) => amount ? (classes.includes('always') ? amount : got.raw[edge]) : 0)
      check(allNear(got[effect], expectedAmounts), `conditional scope or selection at ${width}px: ${classes}`, { expectedAmounts, ...amounts(got) })
    }
  }

  await page.setViewportSize({ width: 900, height: 600 })
  for (const [classes, effect, entry, exit] of [
    [variants[0], 'opacity', 'hover', 'blur'],
    [variants[1], 'blur', 'focus', 'blur'],
    [variants[2], 'opacity', 'group', 'blur'],
    [variants[3], 'blur', 'data', 'data'],
  ]) {
    await page.setContent(`<!doctype html><style>${sourceCss}${harness}</style><div class="group">${markup(classes)}</div><button id="outside" style="position:fixed;right:0;bottom:0">outside</button>`)
    await scroll(page)
    await page.mouse.move(590, 590)
    const before = await state(page)
    if (entry === 'hover' || entry === 'group') await page.locator('.sample').hover()
    if (entry === 'focus') { await page.locator('#outside').focus(); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Shift+Tab') }
    if (entry === 'data') await page.locator('.sample').evaluate((element) => { element.dataset.paused = '' })
    await settle(page)
    const during = await state(page)
    if (exit === 'data') await page.locator('.sample').evaluate((element) => { delete element.dataset.paused })
    else { await page.mouse.move(590, 590); await page.locator('#outside').focus() }
    await settle(page)
    const after = await state(page)
    const activeExpected = entry === 'hover' ? [during.raw[0], during.raw[1], 0, 0] : entry === 'data' ? zero : [1, 1, 0, 0]
    check(allNear(during[effect], activeExpected) && allNear(after[effect], before[effect]), `state variant enters and exits: ${classes}`, { before: amounts(before), during: amounts(during), after: amounts(after) })
  }

  await page.setContent(`<!doctype html><style>${sourceCss}${harness}</style><div class="group">${markup(variants[11], { count: 4 })}</div>`)
  await scroll(page)
  await page.mouse.move(890, 590)
  const complex = await state(page)
  check(complex.pseudo.content !== 'none' && complex.layers.every((layer) => layer.display !== 'none'), 'breakpoint blur selector retains pseudo, support gate, and exact-four structure', complex)
  await page.locator('.sample').hover()
  await settle(page)
  const combined = await state(page)
  check(allNear(combined.blur, [combined.raw[0], 0, 0, combined.raw[3]]), 'group-hover blur selector adds its edge to a breakpoint selector', amounts(combined))
  await page.mouse.move(890, 590)
  await settle(page)
  check(allNear((await state(page)).blur, complex.blur), 'conditional blur selection is removed when group hover ends')
  return sourceCss
}

async function checkFrameIsolation(page, stylesheet, label) {
  const inner = markup('fade-blur-y', { id:'inner-frame', style:'height:160px' })
  await render(page, 'fade-blur-y', { id:'outer-frame', style:'height:300px', content:inner }, stylesheet)
  const read = () => page.evaluate(() => ['outer-frame', 'inner-frame'].map((id) => Number(getComputedStyle(document.getElementById(id)).getPropertyValue('--tw-fade-blur-t'))))
  await page.locator('#outer-frame > .sample-scrollport').evaluate((element) => { element.scrollTop = 64 })
  await settle(page)
  check(allNear(await read(), [1, 0]), `${label}: outer scrolling does not activate the nested frame`)
  await page.locator('#inner-frame > .sample-scrollport').evaluate((element) => { element.scrollTop = 32 })
  await settle(page)
  check(allNear(await read(), [1, 1]), `${label}: the nested frame reads its own scroll timeline`)
  await page.locator('#outer-frame > .sample-scrollport').evaluate((element) => { element.scrollTop = 0 })
  await settle(page)
  check(allNear(await read(), [0, 1]), `${label}: resetting the outer frame preserves nested scroll state`)

  await page.setContent(`<!doctype html><style>${stylesheet}
    body{margin:0;background:#ddd}.frame{width:240px;--tw-fade-scrollbar-width:21px}
    #scrollport{height:240px;overflow:auto}#scrollport::-webkit-scrollbar-track{background:rgb(0,255,0)}
    .ink{width:800px;height:800px;background:black}
  </style><div class="frame fade-blur-frame fade-y fade-blur-y fade-scrollbar-safe-y">
    <div id="scrollport"><div class="ink"></div></div></div>`)
  await page.locator('#scrollport').evaluate((element) => { element.scrollTop = 200 })
  await settle(page)
  const geometry = await page.locator('#scrollport').evaluate((element) => ({ frameWidth:element.parentElement.clientWidth, width:element.offsetWidth, gutter:element.offsetWidth-element.clientWidth }))
  check(geometry.frameWidth === 240 && geometry.width === 240 && geometry.gutter === 21, `${label}: scrollbar safety reserves one gutter on the child`, geometry)
  const screenshot = await page.locator('.frame').screenshot()
  const track = await page.evaluate(async (data) => {
    const image = new Image(); image.src = 'data:image/png;base64,' + data; await image.decode()
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0)
    return [...context.getImageData(230, 12, 1, 1).data].slice(0, 3)
  }, screenshot.toString('base64'))
  check(track[0] === 0 && track[1] === 255 && track[2] === 0, `${label}: fade and blur leave the protected scrollbar track intact`, track)
}

async function checkTransparentBlur(page, stylesheet, label) {
  for (const count of [0, 4]) for (const border of [0, 8]) {
    await render(page, 'fade-blur-top fade-blur-always fade-size-md fade-blur-lg', {
      count,
      style:`border:${border}px solid transparent;width:${240 + 2 * border}px;height:${240 + 2 * border}px`,
      contentStyle:'background:linear-gradient(to right,transparent 100px,white 100px 140px,transparent 140px)',
    }, stylesheet)
    await page.addStyleTag({ content:'.sample-scrollport{background:transparent}body{background:repeating-linear-gradient(#222 0 40px,#456 40px 80px)}' })
    const active = await page.locator('#sample > .sample-scrollport').screenshot()
    await page.locator('#sample').evaluate((element) => element.classList.add('fade-blur-none'))
    await settle(page)
    const plain = await page.locator('#sample > .sample-scrollport').screenshot()
    const result = await page.evaluate(async ([activeData, plainData]) => {
      async function read(data) {
        const image = new Image()
        image.src = 'data:image/png;base64,' + data
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width = image.width; canvas.height = image.height
        const context = canvas.getContext('2d')
        context.drawImage(image, 0, 0)
        return { width:canvas.width, pixels:context.getImageData(0, 0, canvas.width, canvas.height).data }
      }
      const active = await read(activeData), plain = await read(plainData)
      let centerMax = 0
      for (let y = 80; y < 160; y++) for (let x = 60; x < 180; x++) for (let channel = 0; channel < 3; channel++) {
        const index = (y * active.width + x) * 4 + channel
        centerMax = Math.max(centerMax, Math.abs(active.pixels[index] - plain.pixels[index]))
      }
      const at = (image, x, y) => image.pixels[(y * image.width + x) * 4]
      return { edge:at(active, 100, 6), plainEdge:at(plain, 100, 6), outside:at(active, 99, 6), plainOutside:at(plain, 99, 6), centerMax }
    }, [active.toString('base64'), plain.toString('base64')])
    const replacesEdge = result.plainEdge === 255 && result.edge < 220 && result.edge > 90 && result.outside > result.plainOutside + 30
    check(replacesEdge && result.centerMax <= 1, `${label}: ${count} sibling layers, ${border}px frame border replace the sharp edge over a transparent pattern and preserve the entire center`, result)
    const backgrounds = await page.locator('#sample').evaluate((element) => [element, element.firstElementChild].map((node) => getComputedStyle(node).backgroundColor))
    check(backgrounds.every((color) => color === 'rgba(0, 0, 0, 0)'), `${label}: blur does not fill transparent frames or scrollports`, backgrounds)
  }
  await render(page, 'fade-blur-top fade-blur-always', {}, stylesheet)
  await page.locator('#sample').evaluate((element) => element.classList.remove('fade-blur-frame'))
  const unframed = await state(page)
  check(unframed.pseudo.content === 'none' && unframed.mask === 'none', `${label}: missing frame omits the retired glow overlay`, unframed.pseudo)
}

async function checkBlurWrappers(browser, stylesheet, label) {
  const layouts = [
    ['block', 'display:block'],
    ['flex', 'display:flex;flex-direction:column'],
    ['grid', 'display:grid'],
    ['positioned', 'position:relative'],
    ['absolute', 'position:absolute;inset:0'],
  ]
  const radii = [0, 24]
  for (const dpr of [1, 2]) {
    const page = await browser.newPage({ viewport: { width: 500, height: 500 }, deviceScaleFactor: dpr })
    try {
      for (const [layout, layoutStyle] of layouts) for (const count of [0, 4]) {
        const radius = radii[(layouts.findIndex(([name]) => name === layout) + count / 4) % radii.length]
        const direction = count === 4 ? 'rtl' : 'ltr'
        await page.setContent(`<!doctype html><style>${stylesheet}
          * { box-sizing:border-box }
          body { margin:40px;background:#151515 }
          .frame { width:256px;height:256px;background:#303030;border-radius:${radius}px }
          .host { height:100%;overflow:auto;scrollbar-width:none;${layoutStyle} }
          .tiles { display:grid;grid-template-columns:repeat(8,128px);width:1024px;height:1024px;flex-shrink:0;background:rgb(255 255 255 / .15) }
          .tile { height:128px;padding:32px;background:repeating-linear-gradient(90deg,#eee 0 2px,#222 2px 4px);background-clip:content-box }
        </style><div class="frame fade-blur-frame fade fade-blur fade-blur-lg fade-size-md" dir="${direction}"><div class="host"><div class="tiles">${'<div class="tile"></div>'.repeat(64)}</div></div>${layerMarkup.repeat(count)}</div>`)
        for (const offset of [0, 128, 768]) {
          await page.locator('.host').evaluate((element, value) => {
            element.scrollTop = value
            element.scrollLeft = getComputedStyle(element).direction === 'rtl' ? -value : value
          }, offset)
          await settle(page)
          const before = await page.locator('.host').evaluate((element) => {
            const overlay = getComputedStyle(element.parentElement, '::after')
            return { width:element.scrollWidth, height:element.scrollHeight, top:element.scrollTop, left:element.scrollLeft,
              overlayWidth:parseFloat(overlay.width), overlayHeight:parseFloat(overlay.height),
              layers:Array.from(element.parentElement.querySelectorAll(':scope > .fade-blur-layer'), (layer) => {
                const host = element.getBoundingClientRect(), rect = layer.getBoundingClientRect()
                return { x:rect.x-host.x, y:rect.y-host.y, width:rect.width, height:rect.height }
              }) }
          })
          const disabled = await page.addStyleTag({ content:'.frame::after{content:none!important}.frame>.fade-blur-layer{display:none!important}' })
          const plain = await page.locator('.frame').screenshot()
          await disabled.evaluate((element) => element.remove())
          await settle(page)
          const blurred = await page.locator('.frame').screenshot()
          const delta = await page.evaluate(async ({ a, b, radius, scale }) => {
            async function read(data) {
              const image = new Image()
              image.src = 'data:image/png;base64,' + data
              await image.decode()
              const canvas = document.createElement('canvas')
              canvas.width = image.width; canvas.height = image.height
              const context = canvas.getContext('2d')
              context.drawImage(image, 0, 0)
              return { width:canvas.width, height:canvas.height, data:context.getImageData(0, 0, canvas.width, canvas.height).data }
            }
            const plain = await read(a), blurred = await read(b)
            let centerMax = 0, cornerMax = 0, edgeSum = 0, edgeCount = 0
            for (let y = 0; y < plain.height; y++) for (let x = 0; x < plain.width; x++) {
              const inCenter = x > 60 * scale && x < plain.width - 60 * scale && y > 60 * scale && y < plain.height - 60 * scale
              const nearVerticalEdge = x < radius * scale || x >= plain.width - radius * scale
              const nearHorizontalEdge = y < radius * scale || y >= plain.height - radius * scale
              const inCorner = nearVerticalEdge && nearHorizontalEdge
              const cornerX = x < radius * scale ? radius * scale : plain.width - radius * scale
              const cornerY = y < radius * scale ? radius * scale : plain.height - radius * scale
              const outsideRoundedClip = inCorner && Math.hypot(x + 0.5 - cornerX, y + 0.5 - cornerY) > radius * scale + 1
              for (let channel = 0; channel < 3; channel++) {
                const index = (y * plain.width + x) * 4 + channel
                const difference = Math.abs(plain.data[index] - blurred.data[index])
                if (inCenter) centerMax = Math.max(centerMax, difference)
                if (outsideRoundedClip) cornerMax = Math.max(cornerMax, Math.abs(blurred.data[index] - 21))
                if (!inCenter && !inCorner) { edgeSum += difference; edgeCount++ }
              }
            }
            return { centerMax, cornerMax, edgeMean:edgeSum / edgeCount }
          }, { a:plain.toString('base64'), b:blurred.toString('base64'), radius, scale:dpr })
          const name = `${label}: contained ${layout}, ${count} spans, ${direction}, DPR ${dpr}, scroll ${offset}`
          check(delta.centerMax <= 1 && delta.cornerMax <= 2 && delta.edgeMean > 0.1, `${name} clips active blur to the frame and keeps the center crisp`, delta)
          const pinnedLayers = before.layers.every((layer) => Math.abs(layer.x) < 1 && Math.abs(layer.y) < 1 && layer.width === 256 && layer.height === 256)
          const preservedGeometry = before.width === 1024 && before.height === 1024 && before.top === offset && Math.abs(before.left) === offset &&
            before.overlayWidth === 256 && before.overlayHeight === 256 && pinnedLayers
          check(preservedGeometry, `${name} preserves scroll extent and overlay bounds`, before)
        }
      }
    } finally { await page.close() }
  }
}

async function checkBlurPixels(browserType, label, { stylesheet = css, representativeOnly = false } = {}) {
  const browser = await browserType.launch()
  const page = await browser.newPage({ viewport: { width: 600, height: 600 }, deviceScaleFactor: 1 })
  const renderWithStylesheet = (classes, options = {}) => render(page, classes, options, stylesheet)
  try {
    await renderWithStylesheet('fade-top fade-always fade-size-sm')
    const plain = await pixels(page)
    await renderWithStylesheet('fade-top fade-blur-top fade-always fade-blur-always fade-size-sm')
    const got = await state(page)
    if (got.pseudo.content === 'none') {
      const fallback = await pixels(page)
      check(fallback.edge === plain.edge && fallback.center === plain.center, `${label}: unsupported blur retains opacity fallback`)
      await renderWithStylesheet('fade-blur-top fade-blur-always fade-size-sm', { count: 4 })
      const blurOnly = await pixels(page)
      const inactive = await state(page)
      check(blurOnly.nearEdge === 0 && blurOnly.edge === 1 && inactive.mask === 'none' && inactive.layers.every((layer) => layer.display === 'none'), `${label}: unsupported blur-only preserves unmodified content`, inactive)
      if (representativeOnly) await checkStaticFallback(page, stylesheet)
      return
    }
    const single = await pixels(page)
    check(single.edge < plain.edge - 0.1, `${label}: single blur changes pixels independently of opacity`, { plain, single })
    check(got.pseudo.filter === 'blur(3px)', `${label}: selector alone uses default 3px strength`, got.pseudo)
    await renderWithStylesheet('fade-top fade-blur-top fade-always fade-blur-always fade-size-sm', { count: 4 })
    const progressive = await pixels(page)
    check(progressive.edge < single.edge - 0.1, `${label}: four-span progressive blur changes detail loss`, { single, progressive })
    check(single.center === plain.center && progressive.center === plain.center, `${label}: both renderers keep the center crisp`)

    if (representativeOnly) {
      await renderWithStylesheet('fade-blur-top fade-blur-always fade-size-sm')
      const blurOnly = await pixels(page)
      check(blurOnly.nearEdge === 0 && blurOnly.edge < 1, `${label}: source blur-only changes edge pixels`, blurOnly)
      await checkStaticFallback(page, stylesheet)
      return
    }

    for (const count of [0, 1, 3, 4, 5]) {
      await renderWithStylesheet('fade-blur-top fade-blur-always fade-size-sm', { count })
      const blurOnly = await pixels(page)
      const active = await state(page)
      check(blurOnly.nearEdge === 0 && blurOnly.edge < 1 && active.mask === 'none' && allNear(active.opacity, zero), `${label}: ${count} spans preserve blur without opacity fading`, { blurOnly, active })
      check(active.layers.filter((layer) => layer.display !== 'none').length === (count === 4 ? 4 : 0), `${label}: exact-four selects progressive; ${count} spans`, active.layers)
      if (count === 4) {
        check(active.layers.every((layer) => Math.abs(layer.width - active.geometry.width) <= 1 && Math.abs(layer.height - active.geometry.height) <= 1), `${label}: layers match host geometry with content after spans`, active)
        const order = [active.pseudo.z, ...active.layers.map((layer) => layer.z)]
        check(order.every((value, index) => index === 0 || value > order[index - 1]), `${label}: progressive sheets have increasing paint order`, order)
      }
    }
    for (const count of [0, 4]) {
      await renderWithStylesheet('fade-top fade-blur-top fade-always fade-blur-always fade-size-sm fade-clear-top-sm', { count })
      check((await pixels(page)).clear === plain.clear, `${label}: ${count ? 'progressive' : 'single'} preserves the clear zone`)
      await renderWithStylesheet('fade-top fade-blur-top fade-always fade-blur-always fade-size-sm', { count, contentStyle: 'position:relative;z-index:20' })
      check(Math.abs((await pixels(page)).edge - (count ? progressive : single).edge) < 0.02, `${label}: positioned content remains beneath blur`)
      for (const style of ['transform:translateZ(0)', 'contain:paint']) {
        for (const classes of ['fade-top fade-always', 'fade-blur-top fade-blur-always', 'fade-top fade-blur-top fade-always fade-blur-always']) {
          await renderWithStylesheet(`${classes} fade-size-sm`, { count, style })
          const fallback = await pixels(page)
          const hasBlur = classes.includes('fade-blur-top')
          const expectedEdge = hasBlur ? fallback.edge < plain.edge : fallback.edge === plain.edge
          check(expectedEdge && fallback.center === plain.center && (classes.includes('fade-top') || fallback.nearEdge === 0), `${label}: frame supports ${style}, ${classes}, ${count} spans`, fallback)
        }
      }
    }
    await renderWithStylesheet('fade-blur-top fade-blur-always fade-size-sm')
    const shortBand = await pixels(page)
    await renderWithStylesheet('fade-blur-top fade-blur-always fade-size-lg')
    const largeBand = await pixels(page)
    check(largeBand.edge < shortBand.edge - 0.05, `${label}: shared size changes the blur band`, { shortBand, largeBand })
    await renderWithStylesheet('fade-blur-top fade-blur-always fade-size-lg fade-size-y-md fade-size-top-sm')
    check(Math.abs((await pixels(page)).edge - shortBand.edge) < 0.02, `${label}: edge size overrides axis and global size for blur`)
    await renderWithStylesheet('fade-blur-y fade-blur-always fade-size-4xl')
    check((await pixels(page)).center < 1, `${label}: explicit large blur bands can overlap at the center`)
    for (const [name, radius] of [['sm', 2], ['md', 3], ['lg', 6]]) {
      await renderWithStylesheet(`fade-blur-top fade-blur-always fade-blur-${name}`)
      check((await state(page)).pseudo.filter === `blur(${radius}px)`, `${label}: named ${name} strength is ${radius}px`)
    }
    await renderWithStylesheet('fade-top fade-blur-top fade-size-sm fade-travel-lg', { style: '--tw-fade-onset:2' })
    await scroll(page)
    const onset = await page.locator('.sample').evaluate((element) => {
      const host = getComputedStyle(element)
      const overlay = getComputedStyle(element, '::after')
      return { opacity: host.getPropertyValue('--tw-fade-alpha-t'), blur: overlay.getPropertyValue('--tw-fade-blur-alpha-t') }
    })
    check(onset.opacity === onset.blur, `${label}: both renderers share travel and onset`, onset)

    await renderWithStylesheet('fade-blur-y', { content: '<button id="edge-action">Edge action</button><p><span id="text">Selectable text</span></p>', count: 4 })
    await page.locator('#edge-action').click()
    check(await page.locator('#edge-action').evaluate((element) => document.activeElement === element), `${label}: overlay preserves pointer focus`)
    await page.locator('#text').dblclick({ position: { x: 10, y: 8 } })
    check(await page.evaluate(() => getSelection().toString()) === 'Selectable', `${label}: overlay preserves pointer text selection`)
    await page.locator('.sample-scrollport').focus()
    await page.keyboard.press('ArrowDown')
    await settle(page)
    check((await state(page)).top > 0, `${label}: focused host preserves keyboard scrolling`)
    const staticMarkup = await page.content()
    const noScript = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 600, height: 600 } })
    try {
      const nativePage = await noScript.newPage()
      await nativePage.setContent(staticMarkup)
      await nativePage.locator('.sample').hover()
      await nativePage.mouse.wheel(0, 80)
      await nativePage.waitForTimeout(250)
      const nativeState = await state(nativePage)
      check(nativeState.top > 0 && nativeState.blur[0] > 0, `${label}: native scrolling drives blur with JavaScript disabled`, nativeState)
    } finally { await noScript.close() }
  } finally { await browser.close() }
}

async function checkStaticFallback(page, stylesheet = css) {
  const fallbackCss = stylesheet.replace(/@property\s+[^{]+\{[^}]*\}\s*/g, '').replace(/animation-timeline: scroll\(\)/g, 'animation-timeline: tw-fade-no-such-timeline()')
  const cases = [
    ['fade-y', [1, 1, 0, 0]],
    ['fade-y fade-none', zero],
    ['fade fade-none fade-always-x', [0, 0, 1, 1]],
    ['fade-y fade-none fade-always-y fade-none-top', [0, 1, 0, 0]],
    ['fade-y fade-always fade-none-y fade-auto-top', [1, 0, 0, 0]],
    ['fade-blur-y', zero],
    ['fade-y fade-blur-y fade-blur-always', [1, 1, 0, 0]],
  ]
  for (const [classes, amounts] of cases) {
    await render(page, classes, { count: 4 }, fallbackCss)
    const got = await state(page)
    const image = await pixels(page)
    check(JSON.stringify([image.nearEdge > 150, image.nearBottom > 150, image.nearLeft > 150, image.nearRight < 240]) === JSON.stringify(amounts.map(Boolean)) && got.pseudo.content === 'none' && got.layers.every((layer) => layer.display === 'none'), `static fallback without registrations: ${classes}`, { got, image })
    if (classes === 'fade-blur-y') check(got.mask === 'none', 'static blur-only fallback installs no host mask')
  }
  await page.setContent(`<!doctype html><style>${fallbackCss}${harness}</style><div class="fade fade-none fade-blur fade-blur-always" style="--tw-fade-size:120px">${markup('fade-y')}</div>`)
  const nested = await pixels(page)
  check(nested.nearEdge > 150 && nested.inside === 0 && nested.nearLeft === 0 && nested.nearRight === 255 && nested.center === 1, 'static nested host isolates parent disabled mode and geometry without registrations', nested)
}

async function checkOnsetLocality(page, stylesheet, label, registered) {
  for (const ancestor of ['2', '2px']) {
    const effects = 'fade-y fade-blur-y fade-always fade-blur-always'
    const children = markup(effects, { id:'onset-default', style:'height:100px' }) +
      markup(effects, { id:'onset-explicit', style:'--tw-fade-onset:3;height:100px' })
    await page.setContent(`<!doctype html><style>${stylesheet}${harness}</style>${markup(effects, { id:'onset-parent', style:`--tw-fade-onset:${ancestor};height:300px`, content:children })}`)
    const result = await page.evaluate(() => Object.fromEntries(['onset-parent', 'onset-default', 'onset-explicit'].map((id) => {
      const element = document.getElementById(id)
      const host = getComputedStyle(element)
      const overlay = getComputedStyle(element, '::after')
      return [id, {
        onset: host.getPropertyValue('--tw-fade-onset').trim(),
        blurOnset: host.getPropertyValue('--tw-fade-blur-onset').trim(),
        opacityAlpha: host.getPropertyValue('--tw-fade-alpha-t').trim(),
        blurAlpha: overlay.getPropertyValue('--tw-fade-blur-alpha-t').trim(),
        hostMask: getComputedStyle(element.firstElementChild).maskImage !== 'none',
        blurMask: overlay.maskImage !== 'none',
      }]
    })))
    const parent = result['onset-parent']
    const nested = result['onset-default']
    const explicit = result['onset-explicit']
    if (ancestor === '2' || registered) {
      const expected = ancestor === '2' ? '2' : '8'
      check(parent.onset === expected && parent.blurOnset === expected && parent.opacityAlpha === parent.blurAlpha && parent.hostMask && parent.blurMask,
        `${label}: parent ${ancestor} resolves to ${expected}`, parent)
    }
    check(nested.onset === (registered ? '8' : '') && nested.blurOnset === '8' && nested.opacityAlpha === nested.blurAlpha && nested.hostMask && nested.blurMask,
      `${label}: nested default ignores parent onset ${ancestor}`, nested)
    check(explicit.onset === '3' && explicit.blurOnset === '3' && explicit.opacityAlpha === explicit.blurAlpha && explicit.hostMask && explicit.blurMask,
      `${label}: nested explicit onset wins under parent ${ancestor}`, explicit)
  }
}

const browser = await chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] })
const page = await browser.newPage({ viewport: { width: 900, height: 700 }, deviceScaleFactor: 1 })
let sourceCss
try {
  console.log(`Chromium ${browser.version()}; viewport 900×700; DPR 1; ${os.platform()} ${os.arch()}`)
  await checkNamedApi(page)
  sourceCss = await checkConditions(page, defaultClassInventory)
  await checkNamedApi(page, sourceCss)
  for (const [label, stylesheet] of [['standalone', css], ['source', sourceCss]]) {
    await checkOnsetLocality(page, stylesheet, label, true)
    await checkOnsetLocality(page, stylesheet.replace(/@property\s+[^{]+\{[^}]*\}\s*/g, ''), `${label} without registrations`, false)
  }
  await checkStaticFallback(page)
  await checkFrameIsolation(page, css, 'standalone')
  await checkFrameIsolation(page, sourceCss, 'source')
  await checkTransparentBlur(page, css, 'standalone')
  await checkTransparentBlur(page, sourceCss, 'source')
  await checkBlurWrappers(browser, css, 'standalone')
  await checkBlurWrappers(browser, sourceCss, 'source')
} finally { await browser.close() }
await checkBlurPixels(chromium, 'Chromium')
await checkBlurPixels(firefox, 'Firefox')
await checkBlurPixels(chromium, 'Chromium source', { stylesheet: sourceCss, representativeOnly: true })
for (const failure of failures) console.error(`FAIL  ${failure}`)
console.log(`\n${passed}/${passed + failures.length} independent-effect and standalone checks passed`)
process.exitCode = failures.length ? 1 : 0
