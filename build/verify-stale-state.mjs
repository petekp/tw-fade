/**
 * verify-stale-state.mjs — regression for a mounted scrollport whose content
 * changes from scrollable to non-scrollable after a fade has already sampled.
 *
 * The important repro shape is one stable `.fade-y` / `.fade-x` DOM node:
 *   1. render tall/wide content;
 *   2. scroll far enough to activate the leading fade;
 *   3. replace the content with short content without replacing the scrollport;
 *   4. assert the selected fade amounts return to 0 when the axis no longer scrolls.
 */
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const cssPath = process.argv[2] || path.resolve(__dirname, '../dist/tw-fade.css')
const css = fs.readFileSync(cssPath, 'utf8')

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin: 0; box-sizing: border-box; }
  body { padding: 24px; background: #111; color: #eee; font: 14px/1.4 system-ui; }
  .v {
    width: 320px;
    height: 240px;
    overflow-x: hidden;
    overflow-y: auto;
    background: #fff;
  }
  .h {
    width: 320px;
    height: 160px;
    overflow-x: auto;
    overflow-y: hidden;
    white-space: nowrap;
    line-height: 0;
    background: #fff;
  }
  .v-row { height: 48px; border-bottom: 1px solid #ddd; }
  .v-short { height: 80px; }
  .h-strip { display: inline-block; vertical-align: top; width: 1600px; height: 100%; }
  .h-short { display: inline-block; vertical-align: top; width: 120px; height: 100%; }
  ${css}
</style></head><body>
  <div id="v" class="v fade-y"></div>
  <div id="h-ltr" class="h fade-x" dir="ltr"></div>
  <div id="h-rtl" class="h fade-x" dir="rtl"></div>
  <script>
    const v = document.getElementById('v')
    const hLtr = document.getElementById('h-ltr')
    const hRtl = document.getElementById('h-rtl')

    window.__setVerticalTall = () => {
      v.innerHTML = Array.from({ length: 40 }, (_, i) => '<div class="v-row">Row ' + (i + 1) + '</div>').join('')
    }
    window.__setVerticalShort = () => {
      v.innerHTML = '<div class="v-short">Short</div>'
    }
    window.__setHorizontalWide = () => {
      hLtr.innerHTML = '<div class="h-strip"></div>'
      hRtl.innerHTML = '<div class="h-strip"></div>'
    }
    window.__setHorizontalShort = () => {
      hLtr.innerHTML = '<div class="h-short"></div>'
      hRtl.innerHTML = '<div class="h-short"></div>'
    }

    window.__setVerticalTall()
    window.__setHorizontalWide()
  </script>
</body></html>`

const waitForAnimations = (page) =>
  page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))

async function snap(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) throw new Error(`Missing selector: ${sel}`)
    const cs = getComputedStyle(el)
    const num = (name) => Number(cs.getPropertyValue(name).trim() || 'NaN')
    return {
      scrollTop: el.scrollTop,
      scrollLeft: el.scrollLeft,
      scrollHeight: el.scrollHeight,
      scrollWidth: el.scrollWidth,
      clientHeight: el.clientHeight,
      clientWidth: el.clientWidth,
      maxScrollTop: el.scrollHeight - el.clientHeight,
      maxScrollLeft: el.scrollWidth - el.clientWidth,
      t: num('--tw-fade-t'),
      b: num('--tw-fade-b'),
      l: num('--tw-fade-l'),
      r: num('--tw-fade-r'),
      animationName: cs.animationName,
      animationRangeStart: cs.animationRangeStart,
      animationRangeEnd: cs.animationRangeEnd,
    }
  }, selector)
}

const approx = (actual, expected, tolerance = 0.08) =>
  Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance

const zero = (actual) => approx(actual, 0, 0.01)

async function setVerticalScroll(page, position) {
  await page.evaluate((pos) => {
    const el = document.getElementById('v')
    if (pos === 'top') el.scrollTop = 0
    else if (pos === 'mid') el.scrollTop = 420
    else if (pos === 'bottom') el.scrollTop = el.scrollHeight - el.clientHeight
  }, position)
}

async function setHorizontalScroll(page, selector, position) {
  await page.evaluate(
    ([sel, pos]) => {
      const el = document.querySelector(sel)
      const max = el.scrollWidth - el.clientWidth
      const target = pos * max
      el.scrollLeft = getComputedStyle(el).direction === 'rtl' ? -target : target
    },
    [selector, position],
  )
}

async function runVerticalMutation(page, position) {
  await page.evaluate(() => window.__setVerticalTall())
  await waitForAnimations(page)
  await setVerticalScroll(page, position)
  await waitForAnimations(page)
  const before = await snap(page, '#v')
  await page.evaluate(() => window.__setVerticalShort())
  await waitForAnimations(page)
  const after = await snap(page, '#v')
  return { before, after }
}

async function runHorizontalMutation(page, selector, position) {
  await page.evaluate(() => window.__setHorizontalWide())
  await waitForAnimations(page)
  await setHorizontalScroll(page, selector, position)
  await waitForAnimations(page)
  const before = await snap(page, selector)
  await page.evaluate(() => window.__setHorizontalShort())
  await waitForAnimations(page)
  const after = await snap(page, selector)
  return { before, after }
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 900, height: 700 }, deviceScaleFactor: 1 })
await page.setContent(html, { waitUntil: 'networkidle' })
const version = await browser.version()

const results = {
  verticalTop: await runVerticalMutation(page, 'top'),
  verticalMid: await runVerticalMutation(page, 'mid'),
  verticalBottom: await runVerticalMutation(page, 'bottom'),
  ltrStart: await runHorizontalMutation(page, '#h-ltr', 0),
  ltrMid: await runHorizontalMutation(page, '#h-ltr', 0.5),
  ltrEnd: await runHorizontalMutation(page, '#h-ltr', 1),
  rtlStart: await runHorizontalMutation(page, '#h-rtl', 0),
  rtlMid: await runHorizontalMutation(page, '#h-rtl', 0.5),
  rtlEnd: await runHorizontalMutation(page, '#h-rtl', 1),
}

await page.close()
await browser.close()

const checks = [
  ['vertical top starts scrollable with bottom fade only', results.verticalTop.before.maxScrollTop > 0 && approx(results.verticalTop.before.t, 0) && approx(results.verticalTop.before.b, 1)],
  ['vertical mid starts with both fades active', approx(results.verticalMid.before.t, 1) && approx(results.verticalMid.before.b, 1)],
  ['vertical bottom starts with top fade only', approx(results.verticalBottom.before.t, 1) && approx(results.verticalBottom.before.b, 0)],
  ['vertical top collapse leaves no vertical fades', results.verticalTop.after.maxScrollTop === 0 && results.verticalTop.after.scrollTop === 0 && zero(results.verticalTop.after.t) && zero(results.verticalTop.after.b)],
  ['vertical mid collapse leaves no vertical fades', results.verticalMid.after.maxScrollTop === 0 && results.verticalMid.after.scrollTop === 0 && zero(results.verticalMid.after.t) && zero(results.verticalMid.after.b)],
  ['vertical bottom collapse leaves no vertical fades', results.verticalBottom.after.maxScrollTop === 0 && results.verticalBottom.after.scrollTop === 0 && zero(results.verticalBottom.after.t) && zero(results.verticalBottom.after.b)],

  ['LTR start starts with right fade only', approx(results.ltrStart.before.l, 0) && approx(results.ltrStart.before.r, 1)],
  ['LTR mid starts with both horizontal fades active', approx(results.ltrMid.before.l, 1) && approx(results.ltrMid.before.r, 1)],
  ['LTR end starts with left fade only', approx(results.ltrEnd.before.l, 1) && approx(results.ltrEnd.before.r, 0)],
  ['LTR collapse leaves no horizontal fades', results.ltrMid.after.maxScrollLeft === 0 && zero(results.ltrStart.after.l) && zero(results.ltrStart.after.r) && zero(results.ltrMid.after.l) && zero(results.ltrMid.after.r) && zero(results.ltrEnd.after.l) && zero(results.ltrEnd.after.r)],

  ['RTL start starts with left fade only', approx(results.rtlStart.before.l, 1) && approx(results.rtlStart.before.r, 0)],
  ['RTL mid starts with both horizontal fades active', approx(results.rtlMid.before.l, 1) && approx(results.rtlMid.before.r, 1)],
  ['RTL end starts with right fade only', approx(results.rtlEnd.before.l, 0) && approx(results.rtlEnd.before.r, 1)],
  ['RTL collapse leaves no horizontal fades', results.rtlMid.after.maxScrollLeft === 0 && zero(results.rtlStart.after.l) && zero(results.rtlStart.after.r) && zero(results.rtlMid.after.l) && zero(results.rtlMid.after.r) && zero(results.rtlEnd.after.l) && zero(results.rtlEnd.after.r)],
]

console.log(JSON.stringify({ css: path.relative(path.resolve(__dirname, '..'), cssPath), browser: `chromium ${version}`, results }, null, 2))
console.log('\n=== STALE STATE CHECKS ===')
let pass = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (ok) pass++
}
console.log(`\n${pass}/${checks.length} passed`)
process.exit(pass === checks.length ? 0 : 1)
