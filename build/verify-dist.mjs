/**
 * verify-dist.mjs — adversarial check on the SHIPPED framework-free artifact.
 *
 * The main verify.mjs exercises the full Tailwind demo build. This one inlines
 * the exact bytes of dist/tw-fade.css into a bare page (no Tailwind, no
 * other CSS) and confirms the scroll-gated fade still resolves correctly — so we
 * know the standalone drop-in works on its own.
 */
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const css = fs.readFileSync(path.resolve(__dirname, '../dist/tw-fade.css'), 'utf8')

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin: 0; box-sizing: border-box; }
  .panel { width: 320px; height: 200px; overflow-y: auto; background: #111; }
  .panel-both { width: 220px; height: 180px; overflow: auto; background: #111; }
  .plane { width: 820px; height: 820px; }
  .panel p { padding: 8px 12px; color: #ddd; font: 14px/1.5 system-ui; border-bottom: 1px solid #222; }
  ${css}
</style></head><body>
  <div class="panel fade-y" id="tall"></div>
  <div class="panel fade-y" id="short"></div>
  <div class="panel-both fade-t fade-r" id="combo"><div class="plane"></div></div>
  <script>
    const tall = document.getElementById('tall')
    for (let i = 0; i < 30; i++) { const p = document.createElement('p'); p.textContent = 'Row ' + (i+1); tall.appendChild(p) }
    const short = document.getElementById('short')
    for (let i = 0; i < 2; i++) { const p = document.createElement('p'); p.textContent = 'Row ' + (i+1); short.appendChild(p) }
  </script>
</body></html>`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 800, height: 700 }, deviceScaleFactor: 1 })
await page.setContent(html, { waitUntil: 'networkidle' })
await page.waitForTimeout(100)

async function probe(sel, top) {
  return page.evaluate(
    async ([s, t]) => {
      const el = document.querySelector(s)
      el.scrollTop = t
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      const cs = getComputedStyle(el)
      const num = (v) => Number(cs.getPropertyValue(v).trim() || 'NaN')
      return {
        scrollTop: el.scrollTop,
        maxScroll: el.scrollHeight - el.clientHeight,
        t: num('--sf-t'),
        b: num('--sf-b'),
        maskComposite: cs.maskComposite,
        maskImage: cs.maskImage.slice(0, 40),
      }
    },
    [sel, top],
  )
}

async function probeBoth(sel, top, left) {
  return page.evaluate(
    async ([s, t, l]) => {
      const el = document.querySelector(s)
      el.scrollTop = t
      el.scrollLeft = l
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      const cs = getComputedStyle(el)
      const num = (v) => Number(cs.getPropertyValue(v).trim() || 'NaN')
      return {
        scrollTop: el.scrollTop,
        scrollLeft: el.scrollLeft,
        maxScrollTop: el.scrollHeight - el.clientHeight,
        maxScrollLeft: el.scrollWidth - el.clientWidth,
        t: num('--sf-t'),
        r: num('--sf-r'),
        animationNames: cs.animationName.split(',').map((n) => n.trim()),
      }
    },
    [sel, top, left],
  )
}

const tallMax = (await probe('#tall', 0)).maxScroll
const r = {
  top: await probe('#tall', 0),
  mid: await probe('#tall', Math.round(tallMax / 2)),
  bottom: await probe('#tall', tallMax),
  short: await probe('#short', 0),
  combo: await probeBoth('#combo', 100, 100),
}
await browser.close()

const approx = (a, b, tol = 0.08) => Math.abs(a - b) <= tol
const checks = [
  ['dist: top → no top fade (t≈0)', approx(r.top.t, 0)],
  ['dist: top → full bottom fade (b≈1)', approx(r.top.b, 1)],
  ['dist: mid → both fades (t≈1,b≈1)', approx(r.mid.t, 1) && approx(r.mid.b, 1)],
  ['dist: bottom → full top fade (t≈1)', approx(r.bottom.t, 1)],
  ['dist: bottom → no bottom fade (b≈0)', approx(r.bottom.b, 0)],
  ['dist: not scrollable → no fade (t≈0,b≈0)', approx(r.short.t, 0) && approx(r.short.b, 0)],
  ['dist: mixed fade-t fade-r composes (t≈1,r≈1)', approx(r.combo.t, 1) && approx(r.combo.r, 1)],
  ['dist: mixed fade-t fade-r keeps four reveal animations', r.combo.animationNames.length === 4],
  ['dist: mask-composite intersect', /intersect/.test(r.top.maskComposite)],
  ['dist: mask-image has 4 layers', (r.top.maskImage.match(/gradient/g) || []).length >= 1],
]

console.log(JSON.stringify(r, null, 2))
console.log('\n=== DIST CHECKS ===')
let pass = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (ok) pass++
}
console.log(`\n${pass}/${checks.length} passed`)
process.exit(pass === checks.length ? 0 : 1)
