import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
import { demoDir } from './demo-static.mjs'

// The themed favicon changes color with the surface theme. The runtime must do
// more than rewrite the existing <link>'s href: browsers cache the favicon by
// element identity and frequently skip a repaint when only .href mutates. This
// test asserts the runtime swaps in a FRESH <link> node on each theme change
// (the mechanism that forces a re-read) and that the new icon encodes the
// active theme's --demo-page-bg / --demo-accent-text.

const failures = []
function assert(ok, label, detail = '') {
  if (!ok) failures.push(`${label}${detail ? ` (${detail})` : ''}`)
}

// Mark the current themed favicon link with a JS-only property. cloneNode (and
// a fresh createElement) do not copy JS properties, so if the runtime replaces
// the node the marker is gone; if it mutates in place the marker survives.
async function markFavicon(page) {
  await page.evaluate(() => {
    const link = document.querySelector('[data-theme-favicon]')
    if (link) link.__faviconMarker = true
  })
}

async function readFavicon(page) {
  return page.evaluate(() => {
    const link = document.querySelector('[data-theme-favicon]')
    const href = link?.getAttribute('href') ?? ''
    const decoded = decodeURIComponent(href.replace(/^data:image\/svg\+xml,/, ''))
    const match = decoded.match(/\.favicon-dark\{fill:([^}]+)\}\.favicon-light\{fill:([^}]+)\}/)
    const resolved = (name) =>
      getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    return {
      surface: document.documentElement.dataset.surface,
      isData: href.startsWith('data:image/svg+xml,'),
      markerSurvived: Boolean(link?.__faviconMarker),
      dark: match?.[1] ?? null,
      light: match?.[2] ?? null,
      themeBg: resolved('--demo-page-bg'),
      themeAccent: resolved('--demo-accent-text'),
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

  // Initial paint: the static .svg link should be upgraded to a themed data URI.
  const initial = await readFavicon(page)
  assert(initial.isData, 'initial favicon is a themed data URI', String(initial.surface))
  assert(
    initial.dark === initial.themeBg && initial.light === initial.themeAccent,
    'initial favicon encodes the active theme colors',
    `${initial.dark}/${initial.light} vs ${initial.themeBg}/${initial.themeAccent}`,
  )

  for (const surface of ['cobalt', 'berry', 'pine']) {
    await markFavicon(page)
    const before = await readFavicon(page)
    await switchSurface(page, surface)
    const after = await readFavicon(page)

    assert(after.surface === surface, `surface switches to ${surface}`, String(after.surface))
    assert(
      !after.markerSurvived,
      `${surface}: favicon <link> is replaced (forces repaint)`,
      'marker survived → href mutated in place',
    )
    assert(after.isData, `${surface}: favicon is a themed data URI`)
    assert(
      after.dark !== before.dark || after.light !== before.light,
      `${surface}: favicon colors change from previous theme`,
      `${before.dark}/${before.light} -> ${after.dark}/${after.light}`,
    )
    assert(
      after.dark === after.themeBg && after.light === after.themeAccent,
      `${surface}: favicon encodes the theme bg + accent`,
      `${after.dark}/${after.light} vs ${after.themeBg}/${after.themeAccent}`,
    )
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

console.log('PASS  themed favicon swaps a fresh link node and tracks theme colors')
