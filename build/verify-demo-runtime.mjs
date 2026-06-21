import fs from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium, devices, webkit } from 'playwright'
import { demoDir, exportDemoStatic } from './demo-static.mjs'

const failures = []

function assert(ok, label, detail = '') {
  if (!ok) failures.push(`${label}${detail ? ` (${detail})` : ''}`)
}

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8'
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8'
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8'
  if (filePath.endsWith('.svg')) return 'image/svg+xml'
  if (filePath.endsWith('.png')) return 'image/png'
  if (filePath.endsWith('.ico')) return 'image/x-icon'
  if (filePath.endsWith('.webmanifest')) return 'application/manifest+json'
  return 'application/octet-stream'
}

async function withStaticServer(root, run) {
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1')
      const pathname = decodeURIComponent(url.pathname)
      let filePath = path.normalize(path.join(root, pathname))
      const relativePath = path.relative(root, filePath)
      if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        response.writeHead(403)
        response.end('Forbidden')
        return
      }
      const stat = await fs.stat(filePath).catch(() => null)
      if (stat?.isDirectory()) filePath = path.join(filePath, 'index.html')
      const body = await fs.readFile(filePath)
      response.writeHead(200, { 'content-type': contentType(filePath) })
      response.end(body)
    } catch {
      response.writeHead(404)
      response.end('Not found')
    }
  })

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  try {
    await run(`http://127.0.0.1:${port}`)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

async function exposePalette(page) {
  await page.locator('[data-floating-surface-palette]').evaluate((el) => {
    el.dataset.visible = 'true'
    el.setAttribute('aria-hidden', 'false')
    for (const button of el.querySelectorAll('[data-surface-option]')) {
      button.tabIndex = 0
    }
  })
}

async function readPageState(page) {
  return page.evaluate(() => {
    const rail = document.querySelector('[data-demo="rail"]')
    const cards = Array.from(rail?.querySelectorAll('.rail-card') ?? [])
    const selected = cards.find((card) => card.getAttribute('aria-selected') === 'true')
    const recede = cards.find((card) => card.querySelector('.rail-card-label')?.textContent.trim() === 'Recede')
    const railRect = rail?.getBoundingClientRect()
    const recedeRect = recede?.getBoundingClientRect()
    const masthead = document.querySelector('.masthead-lockup')
    const doc = document.documentElement
    const duplicateIds = Array.from(document.querySelectorAll('[id]'))
      .map((element) => element.id)
      .filter((id, index, ids) => ids.indexOf(id) !== index)
    const unnamedButtons = Array.from(document.querySelectorAll('button')).filter((button) => {
      return !button.textContent.trim() && !button.getAttribute('aria-label')
    })
    const waveBefore = getComputedStyle(document.body, '::before')
    const waveField = document.querySelector('[data-demo-wave-field]')
    const wavePath = document.querySelector('[data-demo-wave-path]')
    const wavePattern = document.querySelector('[data-demo-wave-pattern]')

    return {
      bodyIsScroller: document.body.scrollHeight > document.body.clientHeight + 8,
      scriptsLoaded: Boolean(window.demoAnimations?.animate),
      motionMode: doc.dataset.motionAnimations,
      mastheadMarginLeft: masthead ? getComputedStyle(masthead).marginLeft : '',
      selectedRail: selected?.querySelector('.rail-card-label')?.textContent.trim() ?? '',
      recedeLeftFromRail: railRect && recedeRect ? Number((recedeRect.left - railRect.left).toFixed(2)) : null,
      verticalRows: document.querySelectorAll('[data-demo="list"] .lexicon-row').length,
      advancedLabel: document.querySelector('[data-fade-option-label]')?.getAttribute('aria-label') ?? '',
      edgePressed: Array.from(document.querySelectorAll('[data-fade-edge-toggle]'))
        .map((button) => button.getAttribute('aria-pressed'))
        .join(','),
      easedLine: Boolean(document.querySelector('.eased-curve-active')),
      scrollAwareThumb: Boolean(document.querySelector('.scroll-aware-thumb')),
      composableTokens: document.querySelectorAll('.kin-tok').length,
      documentOverflowX: doc.scrollWidth - doc.clientWidth,
      duplicateIdCount: duplicateIds.length,
      unnamedButtonCount: unnamedButtons.length,
      railRole: rail?.getAttribute('role') ?? '',
      edgeGroupRole: document.querySelector('.edge-toggle-group')?.getAttribute('role') ?? '',
      waveMode: doc.dataset.waveField ?? '',
      waveBeforeImage: waveBefore.backgroundImage,
      waveBeforeDisplay: waveBefore.display,
      waveBeforeWillChange: waveBefore.willChange,
      waveFieldDisplay: waveField ? getComputedStyle(waveField).display : '',
      wavePathD: wavePath?.getAttribute('d') ?? '',
      wavePatternHeight: wavePattern?.getAttribute('height') ?? '',
      movingWillChange: {
        railCard: getComputedStyle(document.querySelector('.rail-card')).willChange,
        easedLine: getComputedStyle(document.querySelector('.eased-curve-active')).willChange,
        token: getComputedStyle(document.querySelector('.kin-tok')).willChange,
      },
    }
  })
}

async function runInteractions(page, label) {
  await exposePalette(page)
  await page.locator('[data-surface-option="graphite"]').focus()
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(180)
  const keyboardSurface = await page.evaluate(() => ({
    surface: document.documentElement.dataset.surface,
    cobaltChecked: document.querySelector('[data-surface-option="cobalt"]')?.getAttribute('aria-checked'),
  }))
  assert(
    keyboardSurface.surface === 'cobalt' && keyboardSurface.cobaltChecked === 'true',
    `${label}: surface radio keyboard navigation updates theme`,
    JSON.stringify(keyboardSurface),
  )

  await page.locator('.rail-card', { hasText: 'Dim' }).focus()
  await page.keyboard.press('Enter')
  await page.waitForTimeout(180)
  const railAfterKeyboard = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.rail-card')).find(
      (card) => card.getAttribute('aria-selected') === 'true',
    )?.querySelector('.rail-card-label')?.textContent.trim()
  })
  assert(railAfterKeyboard === 'Dim', `${label}: rail card activates from keyboard`, railAfterKeyboard)

  const depthBefore = await page.locator('[data-fade-depth-value]').textContent()
  await page.locator('[data-fade-depth-slider]').focus()
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(120)
  const depthAfter = await page.locator('[data-fade-depth-value]').textContent()
  assert(depthBefore !== depthAfter, `${label}: fade-depth slider updates from keyboard`, `${depthBefore} -> ${depthAfter}`)

  const topEdge = page.locator('[data-fade-edge-toggle="t"]')
  await topEdge.focus()
  await page.keyboard.press('Space')
  await page.waitForTimeout(160)
  const edgeAfterKeyboard = await topEdge.getAttribute('aria-pressed')
  assert(edgeAfterKeyboard === 'false', `${label}: edge toggle activates from keyboard`, edgeAfterKeyboard)
}

async function smokePage(browser, options) {
  const {
    label,
    url,
    viewport,
    contextOptions = {},
    reducedMotion = false,
    checkRailInset = true,
    checkKeyboard = true,
  } = options
  const context = await browser.newContext({
    ...contextOptions,
    viewport,
    deviceScaleFactor: contextOptions.deviceScaleFactor ?? (viewport.width < 600 ? 2 : 1),
    reducedMotion: reducedMotion ? 'reduce' : 'no-preference',
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })

  await page.goto(url, { waitUntil: 'load' })
  await page.waitForTimeout(reducedMotion ? 500 : 1000)

  const state = await readPageState(page)
  assert(errors.length === 0, `${label}: no browser errors`, errors.join('; '))
  assert(state.bodyIsScroller, `${label}: body remains the page scroller`)
  assert(state.scriptsLoaded, `${label}: demo animation API loaded`)
  assert(
    reducedMotion
      ? state.motionMode === 'reduced'
      : state.motionMode === 'local-spring',
    `${label}: motion runtime state is valid`,
    state.motionMode,
  )
  assert(state.mastheadMarginLeft === '16px', `${label}: masthead keeps ml-4 inset`, state.mastheadMarginLeft)
  assert(state.selectedRail === 'Recede', `${label}: Recede selected by default`, state.selectedRail)
  if (checkRailInset) {
    assert(
      Math.abs((state.recedeLeftFromRail ?? 0) - 140) <= 1,
      `${label}: Recede starts 140px from rail edge`,
      String(state.recedeLeftFromRail),
    )
  }
  assert(state.verticalRows >= 5, `${label}: vertical list rendered`, String(state.verticalRows))
  assert(state.advancedLabel === 'fade-y fade-size-2xl fade-range-2xl', `${label}: advanced controls initialize class readout`, state.advancedLabel)
  assert(state.edgePressed === 'true,false,true,false', `${label}: top and bottom edge toggles initialize on`, state.edgePressed)
  assert(state.easedLine && state.scrollAwareThumb && state.composableTokens >= 3, `${label}: key animated graphics rendered`)
  assert(state.documentOverflowX <= 1, `${label}: no document-level horizontal overflow`, String(state.documentOverflowX))
  assert(state.duplicateIdCount === 0, `${label}: no duplicate IDs`, String(state.duplicateIdCount))
  assert(state.unnamedButtonCount === 0, `${label}: all buttons have accessible names`, String(state.unnamedButtonCount))
  assert(state.railRole === 'listbox', `${label}: rail uses listbox role`, state.railRole)
  assert(state.edgeGroupRole === 'group', `${label}: edge toggles are grouped`, state.edgeGroupRole)
  assert(state.waveBeforeImage !== 'none', `${label}: CSS wave layer renders`)
  assert(/transform/.test(state.waveBeforeWillChange), `${label}: wave layer is transform composited`, state.waveBeforeWillChange)
  if (reducedMotion) {
    assert(state.waveMode !== 'svg', `${label}: reduced motion keeps procedural wave disabled`, state.waveMode)
    assert(state.waveBeforeDisplay === 'block', `${label}: reduced motion keeps static wave fallback`, state.waveBeforeDisplay)
    assert(state.waveFieldDisplay === 'none', `${label}: reduced motion hides SVG wave field`, state.waveFieldDisplay)
  } else {
    assert(state.waveMode === 'svg', `${label}: procedural SVG wave field activates`, state.waveMode)
    assert(state.waveBeforeDisplay === 'none', `${label}: procedural wave hides static fallback`, state.waveBeforeDisplay)
    assert(state.waveFieldDisplay === 'block', `${label}: SVG wave field renders`, state.waveFieldDisplay)
    assert(state.wavePathD.startsWith('M64 0C90'), `${label}: SVG wave starts at top geometry`, state.wavePathD.slice(0, 20))
    assert(state.wavePatternHeight === '1158', `${label}: SVG wave pattern starts at top wavelength`, state.wavePatternHeight)
  }
  assert(/transform/.test(state.movingWillChange.railCard), `${label}: rail cards are composited`, state.movingWillChange.railCard)
  assert(/transform/.test(state.movingWillChange.easedLine), `${label}: eased line is composited`, state.movingWillChange.easedLine)
  assert(/opacity/.test(state.movingWillChange.token), `${label}: composable tokens expose compositor hints`, state.movingWillChange.token)

  await page.evaluate(() => {
    document.body.scrollTo({
      top: Math.min(900, document.body.scrollHeight - document.body.clientHeight),
      left: 0,
      behavior: 'instant',
    })
  })
  await page.waitForTimeout(240)
  assert(await page.evaluate(() => Boolean(document.body)), `${label}: page survives scroll-linked animation probe`)
  if (!reducedMotion) {
    const waveAfterScroll = await page.evaluate(() => ({
      d: document.querySelector('[data-demo-wave-path]')?.getAttribute('d') ?? '',
      height: document.querySelector('[data-demo-wave-pattern]')?.getAttribute('height') ?? '',
    }))
    assert(waveAfterScroll.d && waveAfterScroll.d !== state.wavePathD, `${label}: wave path geometry changes with scroll`, waveAfterScroll.d.slice(0, 32))
    assert(waveAfterScroll.height !== state.wavePatternHeight, `${label}: wave wavelength changes with scroll`, `${state.wavePatternHeight} -> ${waveAfterScroll.height}`)
  }
  await page.evaluate(() => {
    document.body.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  })
  await page.waitForTimeout(120)

  if (checkKeyboard) await runInteractions(page, label)
  await context.close()
}

const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tw-fade-runtime-'))
const exportRoot = path.join(tmpRoot, 'public')
await exportDemoStatic({ outDir: exportRoot })

const browser = await chromium.launch()
const webkitBrowser = await webkit.launch()
try {
  await smokePage(browser, {
    label: 'file desktop',
    url: pathToFileURL(path.join(demoDir, 'index.html')).href,
    viewport: { width: 1280, height: 1100 },
  })

  await withStaticServer(exportRoot, async (baseUrl) => {
    await smokePage(browser, {
      label: 'export desktop',
      url: `${baseUrl}/tw-fade`,
      viewport: { width: 1280, height: 1100 },
    })
    await smokePage(browser, {
      label: 'export mobile',
      url: `${baseUrl}/tw-fade`,
      viewport: { width: 390, height: 844 },
      checkRailInset: false,
      checkKeyboard: false,
    })
    await smokePage(browser, {
      label: 'export reduced motion',
      url: `${baseUrl}/tw-fade`,
      viewport: { width: 1280, height: 1100 },
      reducedMotion: true,
      checkKeyboard: false,
    })
    await smokePage(webkitBrowser, {
      label: 'export WebKit iPhone',
      url: `${baseUrl}/tw-fade`,
      viewport: devices['iPhone 15 Pro'].viewport,
      contextOptions: devices['iPhone 15 Pro'],
      checkRailInset: false,
      checkKeyboard: false,
    })
  })
} finally {
  await browser.close()
  await webkitBrowser.close()
  await fs.rm(tmpRoot, { recursive: true, force: true })
}

console.log('Demo runtime smoke')
if (failures.length) {
  for (const failure of failures) console.log(`FAIL  ${failure}`)
  console.log(`\n0/${failures.length} failed checks resolved`)
  process.exit(1)
}

console.log('PASS  file, exported, mobile, WebKit iPhone, reduced-motion, keyboard, accessibility, and compositing checks')
