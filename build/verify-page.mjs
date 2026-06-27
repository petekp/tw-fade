/**
 * verify-page.mjs - regression smoke for the static demo page.
 *
 * The package-level mask behavior is covered by verify.mjs, verify-dist.mjs,
 * and verify-fade.mjs. This script drives the actual demo in Chromium and
 * asserts the page contract that can drift during design work:
 *   - <body> remains the page scroller over an <html> theme surface
 *   - generated demo CSS still contains the public fade utilities
 *   - the advanced specimen can switch to one edge without dragging in the
 *     other mask layers
 *   - the horizontal rail starts on Recede and still moves selection on click
 *   - the advanced Direction control swaps fade-start/fade-end to the opposite
 *     physical edge under RTL, and the safeguard activates a horizontal edge
 *     when none is set
 *
 * Usage: node build/verify-page.mjs
 */
import { chromium } from 'playwright'
import { fileURLToPath, pathToFileURL } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const demoUrl = pathToFileURL(path.resolve(__dirname, '../demo/index.html')).href
const demoCss = fs.readFileSync(path.resolve(__dirname, '../demo/styles.css'), 'utf8')

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 900, height: 700 }, deviceScaleFactor: 1 })
await page.goto(demoUrl, { waitUntil: 'networkidle' })

// Structural facts that must hold regardless of scroll position.
const structure = await page.evaluate(() => {
  const b = document.body
  const cs = getComputedStyle(b)
  const htmlBg = getComputedStyle(document.documentElement).backgroundColor
  return {
    bodyIsScroller: b.scrollHeight > b.clientHeight + 8,
    bodyBg: cs.backgroundColor,
    bodyClass: b.className,
    htmlBg,
  }
})

const demoEdgeUtilities = ['fade-top', 'fade-bottom', 'fade-start', 'fade-end']
const missingDemoEdgeUtilities = demoEdgeUtilities.filter((className) => {
  return !new RegExp(`\\.${className}\\s*\\{`).test(demoCss)
})
const singleEdgeSpecimen = await page.evaluate(async () => {
  const specimen = document.querySelector('[data-demo="type-specimen"]')
  if (!specimen) return null

  specimen.className = 'fade-top fade-size-2xl fade-ramp-md thin-scroll type-scale-sample h-64 overflow-auto p-5 sm:h-72'
  specimen.scrollTop = 96
  specimen.scrollLeft = 96
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

  const cs = getComputedStyle(specimen)
  return {
    maskComposite: cs.maskComposite || cs.webkitMaskComposite,
    maskT: cs.getPropertyValue('--tw-fade-mask-t').trim(),
    maskB: cs.getPropertyValue('--tw-fade-mask-b').trim(),
    maskL: cs.getPropertyValue('--tw-fade-mask-l').trim(),
    maskR: cs.getPropertyValue('--tw-fade-mask-r').trim(),
  }
})

const railSelection = await page.evaluate(() => {
  const rail = document.querySelector('[data-demo="rail"]')
  const cards = Array.from(rail?.querySelectorAll('.rail-card') ?? [])
  if (!cards.length) return null

  const labelFor = (card) => card.querySelector('.rail-card-label')?.textContent.trim() || ''
  const readSelection = () => cards.map((card) => card.getAttribute('aria-selected') === 'true')
  const before = readSelection()
  const beforeIndex = before.findIndex(Boolean)
  const recede = cards.find((card) => labelFor(card) === 'Recede')
  const railRect = rail.getBoundingClientRect()
  const recedeRect = recede?.getBoundingClientRect()
  const targetIndex = cards.findIndex((card, index) => index !== beforeIndex && labelFor(card) === 'Dim')
  const clickIndex = targetIndex === -1 ? (beforeIndex === 0 ? 1 : 0) : targetIndex
  cards[clickIndex]?.click()

  return {
    count: cards.length,
    before,
    beforeIndex,
    beforeLabel: beforeIndex === -1 ? '' : labelFor(cards[beforeIndex]),
    after: readSelection(),
    clickIndex,
    selectedLabel: cards.find((card) => card.getAttribute('aria-selected') === 'true')?.textContent.trim().replace(/\s+/g, ' ') || '',
    recedeLeftFromRail: recedeRect ? Number((recedeRect.left - railRect.left).toFixed(2)) : null,
  }
})

// The advanced Direction control drives the real radios + edge toggles, not a
// synthetic panel (verify-horizontal-rtl.mjs covers the CSS routing in
// isolation). This asserts the demo wiring: flipping LTR -> RTL migrates the
// `end` fade to the opposite physical edge, and the safeguard activates a
// horizontal edge when none is set so the toggle never looks dead.
const dirControl = await page.evaluate(async () => {
  const specimen = document.querySelector('[data-demo="type-specimen"]')
  const ltrRadio = document.querySelector('[data-fade-dir="ltr"]')
  const rtlRadio = document.querySelector('[data-fade-dir="rtl"]')
  const endToggle = document.querySelector('[data-fade-edge-toggle="end"]')
  const startToggle = document.querySelector('[data-fade-edge-toggle="start"]')
  if (!specimen || !ltrRadio || !rtlRadio || !endToggle || !startToggle) return null

  const settle = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  const horizontalPressed = () =>
    endToggle.getAttribute('aria-pressed') === 'true' ||
    startToggle.getAttribute('aria-pressed') === 'true'
  const masks = () => {
    const cs = getComputedStyle(specimen)
    return {
      maskL: cs.getPropertyValue('--tw-fade-mask-l').trim(),
      maskR: cs.getPropertyValue('--tw-fade-mask-r').trim(),
    }
  }
  const scrollMid = () => {
    const max = specimen.scrollWidth - specimen.clientWidth
    specimen.scrollLeft = getComputedStyle(specimen).direction === 'rtl' ? -(max / 2) : max / 2
  }

  // LTR baseline: enable the `end` edge so a horizontal mask layer exists.
  ltrRadio.click()
  if (endToggle.getAttribute('aria-pressed') !== 'true') endToggle.click()
  scrollMid()
  await settle()
  const ltr = { dir: specimen.getAttribute('dir'), ...masks() }

  // Flip to RTL: the same `end` edge must migrate to the opposite physical side.
  rtlRadio.click()
  scrollMid()
  await settle()
  const rtl = { dir: specimen.getAttribute('dir'), ...masks() }

  // Safeguard: from a clean no-horizontal-edge state, RTL auto-enables one.
  ltrRadio.click()
  if (endToggle.getAttribute('aria-pressed') === 'true') endToggle.click()
  if (startToggle.getAttribute('aria-pressed') === 'true') startToggle.click()
  await settle()
  const horizontalBefore = horizontalPressed()
  rtlRadio.click()
  scrollMid()
  await settle()
  const safeguard = { horizontalBefore, horizontalAfter: horizontalPressed(), ...masks() }

  return { ltr, rtl, safeguard }
})

await browser.close()

const transparent = (c) => c === 'rgba(0, 0, 0, 0)' || c === 'transparent'
// A horizontal mask layer is "active" when its gradient points inward:
// physical-left fades "to right", physical-right fades "to left".
const hasLeftMask = (m) => !!m && /to right/.test(m.maskL)
const hasRightMask = (m) => !!m && /to left/.test(m.maskR)

const checks = [
  ['demo build does not emit private .tw-fade-mask utility', !/\.tw-fade-mask\s*\{/.test(demoCss), '.tw-fade-mask absent'],
  [
    'demo build emits runtime single-edge utilities',
    missingDemoEdgeUtilities.length === 0,
    missingDemoEdgeUtilities.length ? `missing: ${missingDemoEdgeUtilities.join(', ')}` : demoEdgeUtilities.join(', '),
  ],
  ['body is the real scroll container', structure.bodyIsScroller, String(structure.bodyIsScroller)],
  ['surface is on <html> (non-transparent)', !transparent(structure.htmlBg), structure.htmlBg],
  ['body is transparent (mask reveals the surface)', transparent(structure.bodyBg), structure.bodyBg],
  ['body does not own a page-level fade utility', !/\bfade(?:\b|-)/.test(structure.bodyClass), structure.bodyClass],
  [
    'advanced demo supports a single top fade',
    /to bottom/.test(singleEdgeSpecimen?.maskT || '') &&
      !/to top/.test(singleEdgeSpecimen?.maskB || '') &&
      !/to right/.test(singleEdgeSpecimen?.maskL || '') &&
      !/to left/.test(singleEdgeSpecimen?.maskR || '') &&
      /intersect/.test(singleEdgeSpecimen.maskComposite || ''),
    singleEdgeSpecimen
      ? `t:${/to bottom/.test(singleEdgeSpecimen.maskT)} b:${/to top/.test(singleEdgeSpecimen.maskB)} l:${/to right/.test(singleEdgeSpecimen.maskL)} r:${/to left/.test(singleEdgeSpecimen.maskR)}`
      : 'missing specimen',
  ],
  [
    'horizontal rail starts on Recede at the designed inset',
    railSelection?.beforeLabel === 'Recede' &&
      railSelection.before.filter(Boolean).length === 1 &&
      Math.abs((railSelection.recedeLeftFromRail ?? 0) - 140) <= 1,
    railSelection
      ? `${railSelection.count} cards, selected:${railSelection.beforeLabel}, inset:${railSelection.recedeLeftFromRail}`
      : 'missing rail cards',
  ],
  [
    'horizontal cards move selected treatment on click',
    railSelection?.after[railSelection.clickIndex] === true &&
      railSelection.before.filter(Boolean).length === 1 &&
      railSelection.after.filter(Boolean).length === 1,
    railSelection ? `${railSelection.count} cards, selected:${railSelection.selectedLabel}` : 'missing rail cards',
  ],
  [
    'advanced Direction control swaps the end fade to the opposite edge in RTL',
    dirControl &&
      dirControl.ltr.dir === 'ltr' &&
      hasRightMask(dirControl.ltr) &&
      !hasLeftMask(dirControl.ltr) &&
      dirControl.rtl.dir === 'rtl' &&
      hasLeftMask(dirControl.rtl) &&
      !hasRightMask(dirControl.rtl),
    dirControl
      ? `ltr(R:${hasRightMask(dirControl.ltr)} L:${hasLeftMask(dirControl.ltr)}) -> rtl(L:${hasLeftMask(dirControl.rtl)} R:${hasRightMask(dirControl.rtl)})`
      : 'missing direction control',
  ],
  [
    'advanced Direction RTL safeguard activates a horizontal edge when none is set',
    dirControl &&
      dirControl.safeguard.horizontalBefore === false &&
      dirControl.safeguard.horizontalAfter === true &&
      (hasLeftMask(dirControl.safeguard) || hasRightMask(dirControl.safeguard)),
    dirControl
      ? `before:${dirControl.safeguard.horizontalBefore} after:${dirControl.safeguard.horizontalAfter} mask(L:${hasLeftMask(dirControl.safeguard)} R:${hasRightMask(dirControl.safeguard)})`
      : 'missing direction control',
  ],
]

console.log('Demo page: static file smoke')
console.log(
  `structure - scroller:${structure.bodyIsScroller} htmlBg:${structure.htmlBg} bodyBg:${structure.bodyBg} bodyClass:${structure.bodyClass}`,
)
console.log('\n=== DEMO PAGE CHECKS ===')
let pass = 0
for (const [label, ok, detail] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  (${detail})`)
  if (ok) pass++
}
console.log(`\n${pass}/${checks.length} passed`)
process.exit(pass === checks.length ? 0 : 1)
