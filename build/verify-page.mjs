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

const demoEdgeUtilities = ['fade-t', 'fade-b', 'fade-l', 'fade-r']
const missingDemoEdgeUtilities = demoEdgeUtilities.filter((className) => {
  return !new RegExp(`\\.${className}\\s*\\{`).test(demoCss)
})
const singleEdgeSpecimen = await page.evaluate(async () => {
  const specimen = document.querySelector('[data-demo="type-specimen"]')
  if (!specimen) return null

  specimen.className = 'fade-t fade-size-2xl fade-range-md thin-scroll type-scale-sample h-64 overflow-auto p-5 sm:h-72'
  specimen.scrollTop = 96
  specimen.scrollLeft = 96
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

  const cs = getComputedStyle(specimen)
  return {
    maskComposite: cs.maskComposite || cs.webkitMaskComposite,
    hasMaskT: cs.getPropertyValue('--tw-fade-mask-t').trim() !== '',
    hasMaskB: cs.getPropertyValue('--tw-fade-mask-b').trim() !== '',
    hasMaskL: cs.getPropertyValue('--tw-fade-mask-l').trim() !== '',
    hasMaskR: cs.getPropertyValue('--tw-fade-mask-r').trim() !== '',
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

await browser.close()

const transparent = (c) => c === 'rgba(0, 0, 0, 0)' || c === 'transparent'

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
  ['body does not own a page-level fade utility', !/\bfade-[tblrxy]/.test(structure.bodyClass), structure.bodyClass],
  [
    'advanced demo supports a single top fade',
    singleEdgeSpecimen?.hasMaskT === true &&
      singleEdgeSpecimen.hasMaskB === false &&
      singleEdgeSpecimen.hasMaskL === false &&
      singleEdgeSpecimen.hasMaskR === false &&
      /intersect/.test(singleEdgeSpecimen.maskComposite || ''),
    singleEdgeSpecimen
      ? `t:${singleEdgeSpecimen.hasMaskT} b:${singleEdgeSpecimen.hasMaskB} l:${singleEdgeSpecimen.hasMaskL} r:${singleEdgeSpecimen.hasMaskR}`
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
