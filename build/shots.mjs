import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const demo = 'file://' + path.resolve(__dirname, '../demo/index.html')
const shots = path.resolve(__dirname, '../demo/shots')
fs.mkdirSync(shots, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 1500 }, deviceScaleFactor: 2 })
await page.goto(demo, { waitUntil: 'networkidle' })
await page.waitForTimeout(150)

async function setScroll(sel, top) {
  await page.evaluate(
    async ([s, t]) => {
      const el = document.querySelector(s)
      el.scrollTop = t
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    },
    [sel, top],
  )
}

// Full overview.
await page.screenshot({ path: path.join(shots, 'overview.png'), fullPage: true })

// Close-up of the vertical both-edges panel at three scroll states.
const ySection = page.locator('section', { hasText: 'Vertical · both edges' })
await setScroll('[data-demo="y"]', 0)
await ySection.screenshot({ path: path.join(shots, 'y-top.png') })
await setScroll('[data-demo="y"]', 575)
await ySection.screenshot({ path: path.join(shots, 'y-mid.png') })
await setScroll('[data-demo="y"]', 1151)
await ySection.screenshot({ path: path.join(shots, 'y-bottom.png') })

// Side-by-side: faded vs not (mid scroll on both).
await setScroll('[data-demo="none"]', 575)
const grid = page.locator('div.grid').first()
await grid.screenshot({ path: path.join(shots, 'grid.png') })

// Horizontal.
const xSection = page.locator('section', { hasText: 'Horizontal · both edges' })
await page.evaluate(async () => {
  const el = document.querySelector('[data-demo="x"]')
  el.scrollLeft = el.scrollWidth / 2 - el.clientWidth / 2
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
})
await xSection.screenshot({ path: path.join(shots, 'x-mid.png') })

await browser.close()
console.log('shots written to', shots)
