/**
 * verify-page.mjs — regression for the whole-page fade (the demo applies
 * `fade-y` to <body> itself).
 *
 * The fragile part of fading the page body is NOT the mask (verify-fade.mjs
 * already proves masks render) — it's that <body> must become a REAL scroll
 * container for `animation-timeline: scroll(self block)` to attach. If `html`
 * still had `overflow: visible`, the browser would propagate body's overflow to
 * the viewport, body would never scroll, and the amounts would stay pinned at 0.
 * So we drive the actual demo page in Chromium and assert, at the variable level:
 *   - body is genuinely the scroller (scrollHeight > clientHeight)
 *   - the surface sits on <html> and body is transparent (mask reveals into it)
 *   - the mask utility applied to body (mask-composite: intersect)
 *   - the scroll-driven amounts gate correctly: top→no top fade, mid→both,
 *     bottom→no bottom fade — proving the timeline tracks body's own scroll.
 *
 * Usage: node build/verify-page.mjs
 */
import { chromium } from 'playwright'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const demoUrl = pathToFileURL(path.resolve(__dirname, '../demo/index.html')).href

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
    maskComposite: cs.maskComposite || cs.webkitMaskComposite,
    bodyBg: cs.backgroundColor,
    htmlBg,
  }
})

// Read body's animated amounts at a given scroll position.
async function amounts(where) {
  return page.evaluate(async (w) => {
    const b = document.body
    const max = b.scrollHeight - b.clientHeight
    b.scrollTop = w === 'mid' ? Math.round(max / 2) : w === 'max' ? max : 0
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const cs = getComputedStyle(b)
    return {
      t: parseFloat(cs.getPropertyValue('--sf-t')) || 0,
      b: parseFloat(cs.getPropertyValue('--sf-b')) || 0,
    }
  }, where)
}

const top = await amounts('top')
const mid = await amounts('mid')
const bot = await amounts('max')

await browser.close()

const approx = (v, target, tol = 0.2) => Math.abs(v - target) <= tol
const transparent = (c) => c === 'rgba(0, 0, 0, 0)' || c === 'transparent'

const checks = [
  ['body is the real scroll container', structure.bodyIsScroller, String(structure.bodyIsScroller)],
  ['surface is on <html> (non-transparent)', !transparent(structure.htmlBg), structure.htmlBg],
  ['body is transparent (mask reveals the surface)', transparent(structure.bodyBg), structure.bodyBg],
  ['mask applied to body (composite: intersect)', /intersect/.test(structure.maskComposite || ''), structure.maskComposite],
  ['top of page: no top fade (t≈0)', approx(top.t, 0), `t≈${top.t.toFixed(2)}`],
  ['top of page: bottom fade present (b≈1)', approx(top.b, 1), `b≈${top.b.toFixed(2)}`],
  ['mid scroll: both fades present (t≈1,b≈1)', approx(mid.t, 1) && approx(mid.b, 1), `t≈${mid.t.toFixed(2)},b≈${mid.b.toFixed(2)}`],
  ['bottom of page: top fade present (t≈1)', approx(bot.t, 1), `t≈${bot.t.toFixed(2)}`],
  ['bottom of page: no bottom fade (b≈0)', approx(bot.b, 0), `b≈${bot.b.toFixed(2)}`],
]

console.log('Demo page: <body class="fade-y fade-size-[8.75rem] …">')
console.log(
  `structure — scroller:${structure.bodyIsScroller} htmlBg:${structure.htmlBg} bodyBg:${structure.bodyBg} composite:${structure.maskComposite}`,
)
console.log(`amounts — top{t:${top.t.toFixed(2)},b:${top.b.toFixed(2)}} mid{t:${mid.t.toFixed(2)},b:${mid.b.toFixed(2)}} bottom{t:${bot.t.toFixed(2)},b:${bot.b.toFixed(2)}}`)
console.log('\n=== PAGE-BODY FADE CHECKS ===')
let pass = 0
for (const [label, ok, detail] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  (${detail})`)
  if (ok) pass++
}
console.log(`\n${pass}/${checks.length} passed`)
process.exit(pass === checks.length ? 0 : 1)
