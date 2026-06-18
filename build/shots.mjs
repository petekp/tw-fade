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

async function setRail(left) {
  await page.evaluate(async (l) => {
    const el = document.querySelector('[data-demo="rail"]')
    el.scrollLeft = l
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  }, left)
}

await page.screenshot({ path: path.join(shots, 'overview.png'), fullPage: true })

const examplesSection = page.locator('[aria-label="Scroll fade examples"]')
await setScroll('[data-demo="list"]', 0)
await examplesSection.screenshot({ path: path.join(shots, 'y-top.png') })
await setScroll('[data-demo="list"]', 120)
await examplesSection.screenshot({ path: path.join(shots, 'y-mid.png') })
await setScroll('[data-demo="list"]', 9999)
await examplesSection.screenshot({ path: path.join(shots, 'y-bottom.png') })

await setScroll('[data-demo="list"]', 120)
await examplesSection.screenshot({ path: path.join(shots, 'grid.png') })

const railSection = page.locator('[aria-label="Horizontal item list demo"]')
await setRail(280)
await railSection.screenshot({ path: path.join(shots, 'x-mid.png') })

await browser.close()
console.log('shots written to', shots)
