import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const demo = 'file://' + path.resolve(__dirname, '../demo/index.html')
const shots = path.resolve(__dirname, '../demo/shots')

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 1400 }, deviceScaleFactor: 2 })
await page.goto(demo, { waitUntil: 'networkidle' })
await page.waitForTimeout(150)

// Helper: set a panel's scrollTop, settle, read its computed fade amounts.
async function probe(selector, scrollTop) {
  return page.evaluate(
    async ([sel, top]) => {
      const el = document.querySelector(sel)
      el.scrollTop = top
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      const cs = getComputedStyle(el)
      const num = (v) => Number(cs.getPropertyValue(v).trim() || 'NaN')
      return {
        scrollTop: el.scrollTop,
        maxScroll: el.scrollHeight - el.clientHeight,
        t: num('--sf-t'),
        b: num('--sf-b'),
        maskImage: cs.maskImage.slice(0, 60),
        maskComposite: cs.maskComposite || cs.webkitMaskComposite,
      }
    },
    [selector, scrollTop],
  )
}

const results = {}

// 1. Vertical both-edges panel at top / middle / bottom.
const yMax = (await probe('[data-demo="y"]', 0)).maxScroll
results.y_top = await probe('[data-demo="y"]', 0)
results.y_mid = await probe('[data-demo="y"]', Math.round(yMax / 2))
results.y_bottom = await probe('[data-demo="y"]', yMax)
// Partial reveal: exactly half the 50px range should give t≈0.5.
results.y_quarter = await probe('[data-demo="y"]', 25)

// 2. Not-scrollable panel — must show NO fade (base value, inactive timeline).
results.short = await probe('[data-demo="short"]', 0)

// 3. Single edges.
results.t_top = await probe('[data-demo="t"]', 0)
results.t_scrolled = await probe('[data-demo="t"]', 200)
results.b_top = await probe('[data-demo="b"]', 0)

await browser.close()

// Assertions.
const approx = (a, b, tol = 0.08) => Math.abs(a - b) <= tol
const checks = [
  ['y at top: no top fade (t≈0)', approx(results.y_top.t, 0)],
  ['y at top: full bottom fade (b≈1)', approx(results.y_top.b, 1)],
  ['y at 25px: top half-revealed (t≈0.5)', approx(results.y_quarter.t, 0.5, 0.12)],
  ['y mid: both fades present (t≈1,b≈1)', approx(results.y_mid.t, 1) && approx(results.y_mid.b, 1)],
  ['y at bottom: full top fade (t≈1)', approx(results.y_bottom.t, 1)],
  ['y at bottom: no bottom fade (b≈0)', approx(results.y_bottom.b, 0)],
  ['not scrollable: no top fade (t≈0)', approx(results.short.t, 0)],
  ['not scrollable: no bottom fade (b≈0)', approx(results.short.b, 0)],
  ['top-only at top: t≈0', approx(results.t_top.t, 0)],
  ['top-only scrolled: t≈1', approx(results.t_scrolled.t, 1)],
  ['mask-composite is intersect', /intersect/.test(results.y_top.maskComposite)],
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
