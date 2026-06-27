import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const demo = 'file://' + path.resolve(__dirname, '../demo/index.html')

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 1400 }, deviceScaleFactor: 2 })
await page.goto(demo, { waitUntil: 'networkidle' })
await page.waitForTimeout(150)

async function probe(selector, { top, left, noSnap } = {}) {
  return page.evaluate(
    async ([sel, scrollTop, scrollLeft, disableSnap]) => {
      const el = document.querySelector(sel)
      if (!el) throw new Error(`Missing selector: ${sel}`)
      // Some probes measure the fade as a pure function of scroll offset. Snap
      // would pull a small programmatic scroll to the nearest row center, so the
      // exact offset (and thus the partial fade) depends on row height rather
      // than the plugin. Disable snap for those to test the ramp itself.
      const prevSnap = el.style.scrollSnapType
      if (disableSnap) el.style.scrollSnapType = 'none'
      if (scrollTop != null) el.scrollTop = scrollTop
      if (scrollLeft != null) el.scrollLeft = scrollLeft
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      const cs = getComputedStyle(el)
      const num = (v) => Number(cs.getPropertyValue(v).trim() || 'NaN')
      const result = {
        className: el.className,
        scrollTop: el.scrollTop,
        scrollLeft: el.scrollLeft,
        maxScrollTop: el.scrollHeight - el.clientHeight,
        maxScrollLeft: el.scrollWidth - el.clientWidth,
        t: num('--tw-fade-t'),
        b: num('--tw-fade-b'),
        l: num('--tw-fade-l'),
        r: num('--tw-fade-r'),
        hasMaskT: /to bottom/.test(cs.getPropertyValue('--tw-fade-mask-t')),
        hasMaskB: /to top/.test(cs.getPropertyValue('--tw-fade-mask-b')),
        hasMaskL: /to right/.test(cs.getPropertyValue('--tw-fade-mask-l')),
        hasMaskR: /to left/.test(cs.getPropertyValue('--tw-fade-mask-r')),
        maskImage: cs.maskImage,
        maskComposite: cs.maskComposite || cs.webkitMaskComposite,
      }
      if (disableSnap) el.style.scrollSnapType = prevSnap
      return result
    },
    [selector, top, left, noSnap],
  )
}

const results = {}

// 1. List surface.
const listTop = await probe('[data-demo="list"]', { top: 0 })
const listMax = listTop.maxScrollTop
results.list_top = listTop
results.list_mid = await probe('[data-demo="list"]', { top: Math.round(listMax / 2) })
results.list_bottom = await probe('[data-demo="list"]', { top: listMax })
// Measure the fade ramp at a small offset with snap off: this asserts the
// plugin reveals the top edge progressively, independent of where snap would
// settle (which shifts with row height).
results.list_quarter = await probe('[data-demo="list"]', { top: 25, noSnap: true })

// 2. Horizontal tabs / chip rows.
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
  ['item list is scrollable', results.list_top.maxScrollTop > 0],
  ['item list at top: no top fade (t≈0)', approx(results.list_top.t, 0)],
  ['item list at top: full bottom fade (b≈1)', approx(results.list_top.b, 1)],
  ['item list at 25px: top partially revealed', results.list_quarter.t > 0 && results.list_quarter.t < 1],
  [
    'item list mid: both vertical fades present (t≈1,b≈1)',
    approx(results.list_mid.t, 1) && approx(results.list_mid.b, 1),
  ],
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
  ['mask-composite is intersect', /intersect/.test(results.list_mid.maskComposite)],
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
