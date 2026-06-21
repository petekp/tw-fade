import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
import { demoDir } from './demo-static.mjs'

// The themed favicon must recolor with the surface theme in Chrome's tab. Three
// things have to hold, and each maps to a past failure mode:
//   1. It is a PNG data URL. Chrome's favicon pipeline ignores SVG data URLs,
//      so the tab icon stayed frozen even though the SVG rendered in an <img>.
//   2. Exactly one tab icon exists at runtime. The static .ico/.png fallbacks
//      otherwise compete and Chrome may paint one of those instead.
//   3. The <link> node is replaced (not href-mutated) on each switch, and the
//      rendered pixels match the active theme's bg + accent.

const failures = []
function assert(ok, label, detail = '') {
  if (!ok) failures.push(`${label}${detail ? ` (${detail})` : ''}`)
}
const sameRgb = (a, b) => Array.isArray(a) && Array.isArray(b) && a[0] === b[0] && a[1] === b[1] && a[2] === b[2]

async function markFavicon(page) {
  await page.evaluate(() => {
    const link = document.querySelector('[data-theme-favicon]')
    if (link) link.__faviconMarker = true
  })
}

// Render the favicon PNG and sample a known-dark cell (top-left) and a
// known-light cell (bottom-right), plus the theme's resolved bg/accent. All
// values come back as [r,g,b] so they compare exactly.
async function readFavicon(page) {
  return page.evaluate(async () => {
    const toRgb = (color, fallback) => {
      const ctx = document.createElement('canvas').getContext('2d')
      ctx.fillStyle = fallback
      ctx.fillStyle = color
      ctx.fillRect(0, 0, 1, 1)
      const d = ctx.getImageData(0, 0, 1, 1).data
      return [d[0], d[1], d[2]]
    }
    const cs = getComputedStyle(document.documentElement)
    const themeBg = toRgb(cs.getPropertyValue('--demo-page-bg').trim(), '#020617')
    const themeAccent = toRgb(cs.getPropertyValue('--demo-accent-text').trim(), '#f8fafc')
    const link = document.querySelector('[data-theme-favicon]')
    const href = link?.getAttribute('href') ?? ''
    const isPng = href.startsWith('data:image/png')
    const sample = isPng
      ? await new Promise((resolve) => {
          const img = new Image()
          img.onload = () => {
            const c = document.createElement('canvas')
            c.width = c.height = 64
            const ctx = c.getContext('2d')
            ctx.drawImage(img, 0, 0, 64, 64)
            const at = (x, y) => {
              const d = ctx.getImageData(x, y, 1, 1).data
              return [d[0], d[1], d[2]]
            }
            resolve({ darkPx: at(1, 1), lightPx: at(62, 62) })
          }
          img.onerror = () => resolve({ error: true })
          img.src = href
        })
      : {}
    return {
      surface: document.documentElement.dataset.surface,
      isPng,
      markerSurvived: Boolean(link?.__faviconMarker),
      iconLinkCount: document.querySelectorAll('link[rel~="icon"]').length,
      themeBg,
      themeAccent,
      ...sample,
    }
  })
}

async function switchSurface(page, surface) {
  await page.evaluate(() => {
    const palette = document.querySelector('[data-floating-surface-palette]')
    if (palette) {
      palette.dataset.visible = 'true'
      palette.setAttribute('aria-hidden', 'false')
    }
  })
  await page.locator(`[data-surface-option="${surface}"]`).first().click()
  await page.waitForTimeout(250)
}

const browser = await chromium.launch()
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 1100 },
    reducedMotion: 'no-preference',
  })
  await page.goto(pathToFileURL(path.join(demoDir, 'index.html')).href, { waitUntil: 'load' })
  await page.waitForTimeout(600)

  const initial = await readFavicon(page)
  assert(initial.isPng, 'initial favicon is a PNG data URL', String(initial.surface))
  assert(initial.iconLinkCount === 1, 'exactly one tab icon at runtime', String(initial.iconLinkCount))
  assert(sameRgb(initial.darkPx, initial.themeBg), 'initial favicon dark cell = theme bg', `${initial.darkPx} vs ${initial.themeBg}`)
  assert(sameRgb(initial.lightPx, initial.themeAccent), 'initial favicon light cell = theme accent', `${initial.lightPx} vs ${initial.themeAccent}`)

  for (const surface of ['cobalt', 'berry', 'pine']) {
    await markFavicon(page)
    const before = await readFavicon(page)
    await switchSurface(page, surface)
    const after = await readFavicon(page)

    assert(after.surface === surface, `surface switches to ${surface}`, String(after.surface))
    assert(after.isPng, `${surface}: favicon is a PNG data URL`)
    assert(after.iconLinkCount === 1, `${surface}: still exactly one tab icon`, String(after.iconLinkCount))
    assert(!after.markerSurvived, `${surface}: favicon <link> is replaced (forces repaint)`, 'marker survived')
    assert(!sameRgb(after.lightPx, before.lightPx), `${surface}: favicon accent changes from previous theme`, `${before.lightPx} -> ${after.lightPx}`)
    assert(sameRgb(after.darkPx, after.themeBg), `${surface}: favicon dark cell = theme bg`, `${after.darkPx} vs ${after.themeBg}`)
    assert(sameRgb(after.lightPx, after.themeAccent), `${surface}: favicon light cell = theme accent`, `${after.lightPx} vs ${after.themeAccent}`)
  }
} finally {
  await browser.close()
}

console.log('Theme favicon')
if (failures.length) {
  for (const failure of failures) console.log(`FAIL  ${failure}`)
  console.log(`\n0/${failures.length} failed checks resolved`)
  process.exit(1)
}

console.log('PASS  themed favicon is a single PNG link that repaints per theme')
