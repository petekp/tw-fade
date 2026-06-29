import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const css = fs.readFileSync(path.resolve(__dirname, '../dist/tw-fade.css'), 'utf8')

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px; background: #020617; color: #f8fafc; font: 14px/1.4 system-ui; }
  .panel {
    width: 240px;
    height: 120px;
    overflow-x: auto;
    overflow-y: hidden;
    white-space: nowrap;
    background: transparent;
    border: 1px solid #334155;
    margin: 12px;
  }
  .strip { width: 900px; height: 100%; background: #fff; display: inline-block; }
  .short { width: 120px; }
  ${css}
</style></head><body>
  <div id="ltr-start" class="panel fade-start" dir="ltr"><div class="strip"></div></div>
  <div id="ltr-end" class="panel fade-end" dir="ltr"><div class="strip"></div></div>
  <div id="ltr-x" class="panel fade-x" dir="ltr"><div class="strip"></div></div>
  <div id="rtl-start" class="panel fade-start" dir="rtl"><div class="strip"></div></div>
  <div id="rtl-end" class="panel fade-end" dir="rtl"><div class="strip"></div></div>
  <div id="rtl-x" class="panel fade-x" dir="rtl"><div class="strip"></div></div>
  <div dir="rtl"><div id="nested-ltr-start" class="panel fade-start" dir="ltr"><div class="strip"></div></div></div>
  <div id="short" class="panel fade-x" dir="ltr"><div class="strip short"></div></div>
</body></html>`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 900, height: 700 }, deviceScaleFactor: 1 })
await page.setContent(html, { waitUntil: 'networkidle' })

async function probe(selector, logicalPosition) {
  return page.evaluate(
    async ([sel, pos]) => {
      const el = document.querySelector(sel)
      if (!el) throw new Error(`Missing selector: ${sel}`)
      const dir = getComputedStyle(el).direction
      const max = el.scrollWidth - el.clientWidth
      const target = Math.max(0, Math.min(max, pos * max))
      el.scrollLeft = dir === 'rtl' ? -target : target
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      const cs = getComputedStyle(el)
      const num = (v) => Number(cs.getPropertyValue(v).trim() || 'NaN')
      const prop = (v) => cs.getPropertyValue(v).trim()
      return {
        selector: sel,
        dir,
        requested: target,
        scrollLeft: el.scrollLeft,
        maxScrollLeft: max,
        t: num('--tw-fade-t'),
        b: num('--tw-fade-b'),
        l: num('--tw-fade-l'),
        r: num('--tw-fade-r'),
        maskL: prop('--tw-fade-mask-l'),
        maskR: prop('--tw-fade-mask-r'),
        animationName: cs.animationName,
        animationTimeline: cs.animationTimeline,
        animationRangeStart: cs.animationRangeStart,
        animationRangeEnd: cs.animationRangeEnd,
      }
    },
    [selector, logicalPosition],
  )
}

const results = {
  ltrStart0: await probe('#ltr-start', 0),
  ltrStartMid: await probe('#ltr-start', 0.5),
  ltrEnd0: await probe('#ltr-end', 0),
  ltrEndMax: await probe('#ltr-end', 1),
  ltrX0: await probe('#ltr-x', 0),
  ltrXMid: await probe('#ltr-x', 0.5),
  ltrXMax: await probe('#ltr-x', 1),
  rtlStart0: await probe('#rtl-start', 0),
  rtlStartMid: await probe('#rtl-start', 0.5),
  rtlEnd0: await probe('#rtl-end', 0),
  rtlEndMax: await probe('#rtl-end', 1),
  rtlX0: await probe('#rtl-x', 0),
  rtlXMid: await probe('#rtl-x', 0.5),
  rtlXMax: await probe('#rtl-x', 1),
  nestedLtrStart0: await probe('#nested-ltr-start', 0),
  nestedLtrStartMid: await probe('#nested-ltr-start', 0.5),
  short: await probe('#short', 0),
}

await browser.close()

const approx = (a, b, tol = 0.08) => Number.isFinite(a) && Math.abs(a - b) <= tol
const hasLeft = (r) => /to right/.test(r.maskL)
const hasRight = (r) => /to left/.test(r.maskR)
const noLeft = (r) => !/to right/.test(r.maskL)
const noRight = (r) => !/to left/.test(r.maskR)

const checks = [
  ['LTR fade-start maps to physical left only', hasLeft(results.ltrStart0) && noRight(results.ltrStart0)],
  ['LTR fade-start starts inactive then reveals', approx(results.ltrStart0.l, 0) && approx(results.ltrStartMid.l, 1)],
  ['LTR fade-end maps to physical right only', hasRight(results.ltrEnd0) && noLeft(results.ltrEnd0)],
  ['LTR fade-end starts present then retracts at end', approx(results.ltrEnd0.r, 1) && approx(results.ltrEndMax.r, 0)],
  ['LTR fade-x uses both horizontal layers', hasLeft(results.ltrXMid) && hasRight(results.ltrXMid)],
  ['LTR fade-x is active in middle and inactive at opposite ends', approx(results.ltrX0.l, 0) && approx(results.ltrX0.r, 1) && approx(results.ltrXMid.l, 1) && approx(results.ltrXMid.r, 1) && approx(results.ltrXMax.r, 0)],
  ['RTL fade-start maps to physical right only', hasRight(results.rtlStart0) && noLeft(results.rtlStart0)],
  ['RTL fade-start starts inactive then reveals', approx(results.rtlStart0.r, 0) && approx(results.rtlStartMid.r, 1)],
  ['RTL fade-end maps to physical left only', hasLeft(results.rtlEnd0) && noRight(results.rtlEnd0)],
  ['RTL fade-end starts present then retracts at end', approx(results.rtlEnd0.l, 1) && approx(results.rtlEndMax.l, 0)],
  ['RTL fade-x uses both horizontal layers', hasLeft(results.rtlXMid) && hasRight(results.rtlXMid)],
  ['RTL fade-x is active in middle and inactive at opposite ends', approx(results.rtlX0.r, 0) && approx(results.rtlX0.l, 1) && approx(results.rtlXMid.l, 1) && approx(results.rtlXMid.r, 1) && approx(results.rtlXMax.l, 0)],
  ['nested dir override: LTR scroller inside RTL parent maps start to physical left', hasLeft(results.nestedLtrStart0) && noRight(results.nestedLtrStart0) && approx(results.nestedLtrStart0.l, 0) && approx(results.nestedLtrStartMid.l, 1)],
  ['non-scrollable horizontal content leaves both horizontal amounts inactive', approx(results.short.l, 0) && approx(results.short.r, 0)],
  ['horizontal timelines use scroll(self inline)', /scroll\(self inline\)/.test(results.ltrXMid.animationTimeline) && /scroll\(self inline\)/.test(results.rtlXMid.animationTimeline)],
]

console.log(JSON.stringify(results, null, 2))
console.log('\n=== HORIZONTAL RTL CHECKS ===')
let pass = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (ok) pass++
}
console.log(`\n${pass}/${checks.length} passed`)
process.exit(pass === checks.length ? 0 : 1)
