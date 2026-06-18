import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const demo = 'file://' + path.resolve(__dirname, '../demo/index.html')

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 1400 }, deviceScaleFactor: 2 })
await page.goto(demo, { waitUntil: 'networkidle' })
await page.waitForTimeout(150)

async function probe(selector, { top, left } = {}) {
  return page.evaluate(
    async ([sel, scrollTop, scrollLeft]) => {
      const el = document.querySelector(sel)
      if (!el) throw new Error(`Missing selector: ${sel}`)
      if (scrollTop != null) el.scrollTop = scrollTop
      if (scrollLeft != null) el.scrollLeft = scrollLeft
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      const cs = getComputedStyle(el)
      const num = (v) => Number(cs.getPropertyValue(v).trim() || 'NaN')
      return {
        className: el.className,
        scrollTop: el.scrollTop,
        scrollLeft: el.scrollLeft,
        maxScrollTop: el.scrollHeight - el.clientHeight,
        maxScrollLeft: el.scrollWidth - el.clientWidth,
        t: num('--sf-t'),
        b: num('--sf-b'),
        l: num('--sf-l'),
        r: num('--sf-r'),
        hasMaskT: cs.getPropertyValue('--sf-mask-t').trim() !== '',
        hasMaskB: cs.getPropertyValue('--sf-mask-b').trim() !== '',
        hasMaskL: cs.getPropertyValue('--sf-mask-l').trim() !== '',
        hasMaskR: cs.getPropertyValue('--sf-mask-r').trim() !== '',
        maskImage: cs.maskImage,
        maskComposite: cs.maskComposite || cs.webkitMaskComposite,
      }
    },
    [selector, top, left],
  )
}

const results = {}

// 1. Popover content: the most important shadcn/Base UI use case on the page.
const popoverTop = await probe('[data-demo="popover"]', { top: 0 })
const popoverMax = popoverTop.maxScrollTop
results.popover_top = popoverTop
results.popover_mid = await probe('[data-demo="popover"]', { top: Math.round(popoverMax / 2) })
results.popover_bottom = await probe('[data-demo="popover"]', { top: popoverMax })
results.popover_quarter = await probe('[data-demo="popover"]', { top: 25 })

// 2. List surface.
const listTop = await probe('[data-demo="list"]', { top: 0 })
const listMax = listTop.maxScrollTop
results.list_top = listTop
results.list_mid = await probe('[data-demo="list"]', { top: Math.round(listMax / 2) })
results.list_bottom = await probe('[data-demo="list"]', { top: listMax })

// 3. Horizontal tabs / chip rows.
const railStart = await probe('[data-demo="rail"]', { left: 0 })
const railMax = railStart.maxScrollLeft
results.rail_start = railStart
results.rail_mid = await probe('[data-demo="rail"]', { left: Math.round(railMax / 2) })
results.rail_end = await probe('[data-demo="rail"]', { left: railMax })

await browser.close()

const approx = (a, b, tol = 0.08) => Math.abs(a - b) <= tol
const verticalLayersOnly = (result) =>
  result.hasMaskT && result.hasMaskB && !result.hasMaskL && !result.hasMaskR
const horizontalLayersOnly = (result) =>
  result.hasMaskL && result.hasMaskR && !result.hasMaskT && !result.hasMaskB

const checks = [
  ['popover is scrollable', results.popover_top.maxScrollTop > 0],
  ['popover at top: no top fade (t≈0)', approx(results.popover_top.t, 0)],
  ['popover at top: full bottom fade (b≈1)', approx(results.popover_top.b, 1)],
  ['popover at 25px: top partially revealed', results.popover_quarter.t > 0 && results.popover_quarter.t < 1],
  [
    'popover mid: both vertical fades present (t≈1,b≈1)',
    approx(results.popover_mid.t, 1) && approx(results.popover_mid.b, 1),
  ],
  ['popover at bottom: no bottom fade (b≈0)', approx(results.popover_bottom.b, 0)],
  ['popover uses only vertical mask layers', verticalLayersOnly(results.popover_mid)],
  ['item list is scrollable', results.list_top.maxScrollTop > 0],
  ['item list mid uses only vertical mask layers', verticalLayersOnly(results.list_mid)],
  ['item list bottom removes bottom fade', approx(results.list_bottom.b, 0)],
  ['tabs rail is horizontally scrollable', results.rail_start.maxScrollLeft > 0],
  ['tabs rail at start: no left fade (l≈0)', approx(results.rail_start.l, 0)],
  ['tabs rail at start: right fade present (r≈1)', approx(results.rail_start.r, 1)],
  [
    'tabs rail mid: both horizontal fades present (l≈1,r≈1)',
    approx(results.rail_mid.l, 1) && approx(results.rail_mid.r, 1),
  ],
  ['tabs rail at end: no right fade (r≈0)', approx(results.rail_end.r, 0)],
  ['tabs rail only uses left/right mask layers', horizontalLayersOnly(results.rail_mid)],
  ['mask-composite is intersect', /intersect/.test(results.popover_mid.maskComposite)],
]

console.log(JSON.stringify(results, null, 2))
console.log('\n=== CHECKS ===')
let pass = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (ok) pass++
}
console.log(`\n${pass}/${checks.length} passed`)
process.exit(pass === checks.length ? 0 : 1)
