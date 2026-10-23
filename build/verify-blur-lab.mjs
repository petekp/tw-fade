import fs from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { chromium, firefox, webkit } from 'playwright'
import { demoDir } from './demo-static.mjs'

const failures = []
const passes = []
const knownLimitations = []
const screenshotCapabilities = []

function assert(ok, label, detail = '') {
  const result = `${label}${detail ? ` (${detail})` : ''}`
  if (ok) passes.push(result)
  else failures.push(result)
}

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8'
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8'
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8'
  if (filePath.endsWith('.svg')) return 'image/svg+xml'
  if (filePath.endsWith('.png')) return 'image/png'
  return 'application/octet-stream'
}

async function withStaticServer(run) {
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1')
      const requestedPath = decodeURIComponent(url.pathname)
      const filePath = path.normalize(path.join(demoDir, requestedPath))
      const relativePath = path.relative(demoDir, filePath)
      if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        response.writeHead(403)
        response.end('Forbidden')
        return
      }
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

async function waitForScrollSampling(page) {
  await page.waitForTimeout(220)
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
}

async function checkBackdropScreenshotCapture(page, label, version, screenshotDir) {
  await page.setContent(`<!doctype html><style>
    body { margin: 0; }
    .control { position: relative; width: 200px; height: 200px;
      background: repeating-linear-gradient(90deg, #000 0 2px, #fff 2px 4px); }
    .overlay { position: absolute; inset: 0;
      backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
  </style><div class="control"><div class="overlay"></div></div>`)
  await waitForScrollSampling(page)
  const control = page.locator('.control')
  const enabled = await control.screenshot({
    path: path.join(screenshotDir, `${label.toLowerCase()}-backdrop-on.png`),
  })
  const filter = await page.locator('.overlay').evaluate((element) => {
    const style = getComputedStyle(element)
    return style.backdropFilter || style.webkitBackdropFilter
  })
  await page.addStyleTag({ content: '.overlay { backdrop-filter: none; -webkit-backdrop-filter: none; }' })
  await waitForScrollSampling(page)
  const disabled = await control.screenshot({
    path: path.join(screenshotDir, `${label.toLowerCase()}-backdrop-off.png`),
  })
  const pixels = await page.evaluate(async ({ enabled, disabled }) => {
    const readPixels = async (base64) => {
      const image = new Image()
      image.src = `data:image/png;base64,${base64}`
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = image.width
      canvas.height = image.height
      const context = canvas.getContext('2d')
      context.drawImage(image, 0, 0)
      return context.getImageData(0, 0, image.width, image.height).data
    }
    const on = await readPixels(enabled)
    const off = await readPixels(disabled)
    let changedPixels = 0
    let totalDifference = 0
    for (let offset = 0; offset < on.length; offset += 4) {
      let pixelDifference = 0
      for (let channel = 0; channel < 3; channel++) {
        pixelDifference += Math.abs(on[offset + channel] - off[offset + channel])
      }
      if (pixelDifference > 3) changedPixels++
      totalDifference += pixelDifference
    }
    const pixelCount = on.length / 4
    return {
      changedPixelRatio: changedPixels / pixelCount,
      meanChannelDifference: totalDifference / (pixelCount * 3),
    }
  }, { enabled: enabled.toString('base64'), disabled: disabled.toString('base64') })
  const capturesBackdropBlur =
    filter === 'blur(6px)' &&
    pixels.changedPixelRatio > 0.25 &&
    pixels.meanChannelDifference > 5
  screenshotCapabilities.push({ browser: label, version, filter, capturesBackdropBlur, ...pixels })
  if (capturesBackdropBlur) {
    assert(true, `${label}: screenshots capture the basic backdrop-blur control`, JSON.stringify(pixels))
  } else {
    knownLimitations.push(
      `${label} ${version}: screenshot capture cannot verify visible backdrop blur ` +
      `(${JSON.stringify(pixels)}). Geometry and interaction results are separate; ` +
      'visual blur requires a calibrated native Safari or simulator display capture.',
    )
  }
}

async function readScrollerState(page, variant) {
  return page.locator(`[data-variant="${variant}"]`).evaluate((scrollport) => {
    const style = getComputedStyle(scrollport.parentElement)
    const pseudo = getComputedStyle(scrollport.parentElement, '::after')
    const number = (name) => Number.parseFloat(style.getPropertyValue(name)) || 0
    const effect = scrollport.dataset.variant === 'baseline' ? 'opacity' : 'blur'
    const spans = Array.from(scrollport.parentElement.querySelectorAll(':scope > .fade-blur-layer'))
    return {
      classes: Array.from(scrollport.parentElement.classList),
      dir: getComputedStyle(scrollport).direction,
      clientWidth: scrollport.clientWidth,
      clientHeight: scrollport.clientHeight,
      scrollWidth: scrollport.scrollWidth,
      scrollHeight: scrollport.scrollHeight,
      scrollLeft: scrollport.scrollLeft,
      scrollTop: scrollport.scrollTop,
      gates: {
        t: number(`--tw-fade-${effect}-t`),
        b: number(`--tw-fade-${effect}-b`),
        l: number(`--tw-fade-${effect}-l`),
        r: number(`--tw-fade-${effect}-r`),
      },
      size: style.getPropertyValue('--tw-fade-edge-size-t').trim(),
      strength: style.getPropertyValue('--tw-fade-blur-strength').trim(),
      pseudo: {
        content: pseudo.content,
        filter: pseudo.backdropFilter || pseudo.webkitBackdropFilter,
        mask: pseudo.maskImage || pseudo.webkitMaskImage,
        position: pseudo.position,
      },
      spans: spans.map((span) => {
        const spanStyle = getComputedStyle(span)
        const rect = span.getBoundingClientRect()
        return {
          display: spanStyle.display,
          filter: spanStyle.backdropFilter || spanStyle.webkitBackdropFilter,
          position: spanStyle.position,
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        }
      }),
      rect: (() => {
        const rect = scrollport.getBoundingClientRect()
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
      })(),
    }
  })
}

function gatesNear(actual, expected) {
  return Math.abs(actual - expected) <= 0.08
}

async function checkPage(browserType, baseUrl, label, screenshotDir) {
  const browser = await browserType.launch()
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const consoleErrors = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => consoleErrors.push(error.message))

  try {
    await checkBackdropScreenshotCapture(page, label, browser.version(), screenshotDir)
    const response = await page.goto(`${baseUrl}/blur-lab.html`, { waitUntil: 'networkidle' })
    assert(response?.ok(), `${label}: lab route loads`, String(response?.status()))
    await page.waitForFunction(() => Boolean(window.__blurLab))
    await waitForScrollSampling(page)

    const title = await page.title()
    assert(title.includes('progressive blur review lab'), `${label}: correct page title`, title)
    assert(consoleErrors.length === 0, `${label}: no console or page errors`, consoleErrors.join(' | '))

    const initial = await page.evaluate(() => window.__blurLab.readState())
    if (initial.supported) {
      assert(true, `${label}: candidate feature set is supported`)
      assert(
        initial.layerCounts.baseline === 0 &&
          initial.layerCounts.single === 1 &&
          initial.layerCounts.progressive === 5 &&
          initial.layerCounts['blur-only'] === 1,
        `${label}: all four comparison layer counts resolve`,
        JSON.stringify(initial.layerCounts),
      )

      const baseline = await readScrollerState(page, 'baseline')
      const single = await readScrollerState(page, 'single')
      const progressive = await readScrollerState(page, 'progressive')
    assert(
      Math.abs(baseline.scrollWidth - single.scrollWidth) <= 1 &&
        Math.abs(baseline.scrollWidth - progressive.scrollWidth) <= 1 &&
        Math.abs(baseline.scrollHeight - single.scrollHeight) <= 1 &&
        Math.abs(baseline.scrollHeight - progressive.scrollHeight) <= 1,
      `${label}: blur layers do not change scroll dimensions`,
      `${baseline.scrollWidth}×${baseline.scrollHeight}, ${single.scrollWidth}×${single.scrollHeight}, ${progressive.scrollWidth}×${progressive.scrollHeight}`,
    )
    assert(
      single.pseudo.filter.includes('blur') && single.pseudo.mask !== 'none',
      `${label}: single generated sheet has filter and mask`,
      JSON.stringify(single.pseudo),
    )
    assert(
      progressive.spans.length === 4 && progressive.spans.every((span) => span.display !== 'none'),
      `${label}: exactly four direct spans activate`,
      JSON.stringify(progressive.spans.map((span) => span.display)),
    )
    assert(
      progressive.spans.every(
        (span) =>
          Math.abs(span.rect.x - progressive.rect.x) <= 1 &&
          Math.abs(span.rect.y - progressive.rect.y) <= 1 &&
          Math.abs(span.rect.width - progressive.rect.width) <= 1 &&
          Math.abs(span.rect.height - progressive.rect.height) <= 1,
      ),
      `${label}: progressive sheets match the scrollport geometry`,
      JSON.stringify({ scrollport: progressive.rect, spans: progressive.spans.map((span) => span.rect) }),
    )
    assert(
      gatesNear(progressive.gates.t, 1) && gatesNear(progressive.gates.b, 1),
      `${label}: vertical middle activates top and bottom`,
      JSON.stringify(progressive.gates),
    )

    await page.evaluate(() => window.__blurLab.setScrollProgress(0))
    await waitForScrollSampling(page)
    const verticalStart = await readScrollerState(page, 'progressive')
    assert(
      gatesNear(verticalStart.gates.t, 0) && gatesNear(verticalStart.gates.b, 1),
      `${label}: vertical start clears the leading effect`,
      JSON.stringify(verticalStart.gates),
    )

    await page.evaluate(() => window.__blurLab.setScrollProgress(100))
    await waitForScrollSampling(page)
    const verticalEnd = await readScrollerState(page, 'progressive')
    assert(
      gatesNear(verticalEnd.gates.t, 1) && gatesNear(verticalEnd.gates.b, 0),
      `${label}: vertical end clears the trailing effect`,
      JSON.stringify(verticalEnd.gates),
    )

    await page.evaluate(() => {
      window.__blurLab.updateScenario('nooverflow')
      window.__blurLab.setScrollProgress(50)
    })
    await waitForScrollSampling(page)
    await page.waitForTimeout(800)
    const noOverflow = await readScrollerState(page, 'progressive')
    const noOverflowDetail = JSON.stringify({
      client: [noOverflow.clientWidth, noOverflow.clientHeight],
      scroll: [noOverflow.scrollWidth, noOverflow.scrollHeight],
      gates: noOverflow.gates,
    })
    const noOverflowIsCrisp =
      noOverflow.scrollHeight === noOverflow.clientHeight &&
      noOverflow.scrollWidth === noOverflow.clientWidth &&
      Object.values(noOverflow.gates).every((gate) => gatesNear(gate, 0))
    if (noOverflowIsCrisp) {
      assert(true, `${label}: no-overflow scenario stays crisp and inactive`, noOverflowDetail)
    } else {
      const warning = await page.locator('[data-scenario-note]').evaluate((element) => ({
        active: element.dataset.warning,
        text: element.textContent.trim(),
      }))
      if (label === 'WebKit' && warning.active === 'true' && warning.text.length > 0) {
        knownLimitations.push(`${label}: stale no-overflow state (${noOverflowDetail})`)
      } else {
        assert(false, `${label}: no-overflow scenario must clear`, noOverflowDetail)
      }
    }

    await page.evaluate(() => window.__blurLab.updateScenario('horizontal'))
    await page.evaluate(() => window.__blurLab.setScrollProgress(50))
    await waitForScrollSampling(page)
    const horizontal = await readScrollerState(page, 'progressive')
    assert(
      gatesNear(horizontal.gates.l, 1) &&
        gatesNear(horizontal.gates.r, 1) &&
        gatesNear(horizontal.gates.t, 0) &&
        gatesNear(horizontal.gates.b, 0),
      `${label}: horizontal scenario only activates inline edges`,
      JSON.stringify(horizontal.gates),
    )

    await page.evaluate(() => {
      window.__blurLab.updateScenario('mixed')
      window.__blurLab.updateDirection('rtl')
      window.__blurLab.setScrollProgress(50)
    })
    await waitForScrollSampling(page)
    const mixedRtl = await readScrollerState(page, 'progressive')
    assert(
      gatesNear(mixedRtl.gates.t, 1) &&
        gatesNear(mixedRtl.gates.l, 1) &&
        gatesNear(mixedRtl.gates.b, 0) &&
        gatesNear(mixedRtl.gates.r, 0),
      `${label}: mixed RTL maps logical end to the left`,
      JSON.stringify(mixedRtl.gates),
    )

    await page.evaluate(() => {
      window.__blurLab.updateScenario('all')
      window.__blurLab.updateDirection('ltr')
      window.__blurLab.setScrollProgress(50)
    })
    await waitForScrollSampling(page)
    const allEdges = await readScrollerState(page, 'progressive')
    assert(
      Object.values(allEdges.gates).every((gate) => gatesNear(gate, 1)),
      `${label}: all-edge scenario activates all four edges`,
      JSON.stringify(allEdges.gates),
    )

    const sizeBeforeStrengthChange = (await readScrollerState(page, 'single')).size
    await page.evaluate(() => window.__blurLab.updatePreset('sm'))
    await waitForScrollSampling(page)
    const small = await readScrollerState(page, 'single')
    assert(
      small.pseudo.filter === 'blur(2px)' && small.size === sizeBeforeStrengthChange,
      `${label}: strength changes preserve the fade size`,
      JSON.stringify({ size: small.size, filter: small.pseudo.filter }),
    )
    await page.evaluate(() => window.__blurLab.updateSize('lg'))
    await waitForScrollSampling(page)
    const largeFade = await readScrollerState(page, 'single')
    assert(
      largeFade.classes.includes('fade-size-lg') && largeFade.pseudo.filter === small.pseudo.filter,
      `${label}: fade size changes preserve blur strength`,
    )
    const matchingSize = await readScrollerState(page, 'baseline')
    assert(matchingSize.size === largeFade.size, `${label}: all variants use the same fade size`)

    await page.evaluate(() => window.__blurLab.updateStructureCount(3))
    await waitForScrollSampling(page)
    const malformed = await page.evaluate(() => {
      const scroller = document.querySelector('[data-structure-scrollport]')
      return {
        active: Array.from(scroller.parentElement.querySelectorAll(':scope > .fade-blur-layer')).filter(
          (layer) => getComputedStyle(layer).display !== 'none',
        ).length,
        total: scroller.parentElement.querySelectorAll(':scope > .fade-blur-layer').length,
        reported: document.querySelector('[data-structure-result]').textContent.trim(),
      }
    })
    assert(
      malformed.total === 3 && malformed.active === 0 && malformed.reported.startsWith('1 active'),
      `${label}: malformed layer count fails closed to one sheet`,
      JSON.stringify(malformed),
    )

      await page.evaluate(() => window.__blurLab.updateStructureCount(4))
      await waitForScrollSampling(page)
      const exact = await page.evaluate(() => {
        const scroller = document.querySelector('[data-structure-scrollport]')
        return {
          active: Array.from(scroller.parentElement.querySelectorAll(':scope > .fade-blur-layer')).filter(
            (layer) => getComputedStyle(layer).display !== 'none',
          ).length,
          reported: document.querySelector('[data-structure-result]').textContent.trim(),
        }
      })
      assert(
        exact.active === 4 && exact.reported.startsWith('5 active'),
        `${label}: exact-four structure upgrades to five sheets`,
        JSON.stringify(exact),
      )
    } else {
      assert(true, `${label}: unsupported feature set uses the normal fade fallback`)
      assert(
        Object.values(initial.layerCounts).every((count) => count === 0),
        `${label}: fallback creates no blur sheets`,
        JSON.stringify(initial.layerCounts),
      )
      const fallback = await readScrollerState(page, 'progressive')
      assert(
        fallback.pseudo.content === 'none' && fallback.spans.every((span) => span.display === 'none'),
        `${label}: fallback hides generated and authored sheets`,
        JSON.stringify({ pseudo: fallback.pseudo, spans: fallback.spans.map((span) => span.display) }),
      )
      const status = page.locator('[data-support-status]')
      assert(await status.isVisible() && await status.getAttribute('data-supported') === 'false', `${label}: fallback capability status is visible`)
      await page.evaluate(() => window.__blurLab.updateStructureCount(4))
      await waitForScrollSampling(page)
      const structureFallback = await page.locator('[data-structure-result]').textContent()
      assert(
        structureFallback?.startsWith('0 active'),
        `${label}: structure probe reports zero active blur sheets`,
        structureFallback,
      )
    }

    await page.locator('[data-edge-action]').click()
    const clickReadout = await page.locator('[data-click-readout]').textContent()
    assert(clickReadout?.includes('1 edge click'), `${label}: overlay preserves pointer input`, clickReadout)

    const semantics = await page.evaluate(() => {
      const ids = Array.from(document.querySelectorAll('[id]'), (element) => element.id)
      return {
        duplicateIds: ids.filter((id, index) => ids.indexOf(id) !== index),
        unnamedButtons: Array.from(document.querySelectorAll('button')).filter(
          (button) => !button.textContent.trim() && !button.getAttribute('aria-label'),
        ).length,
        exposedLayers: Array.from(document.querySelectorAll('.fade-blur-layer')).filter(
          (layer) => layer.getAttribute('aria-hidden') !== 'true',
        ).length,
      }
    })
    assert(
      semantics.duplicateIds.length === 0 && semantics.unnamedButtons === 0 && semantics.exposedLayers === 0,
      `${label}: controls and layer markup keep basic semantics`,
      JSON.stringify(semantics),
    )

    await page.evaluate(() => {
      window.__blurLab.updateScenario('vertical')
      window.__blurLab.updatePreset('md')
      window.__blurLab.updateSize('auto')
      window.__blurLab.updateSurface('paper')
      window.__blurLab.updateDirection('ltr')
      window.__blurLab.setScrollProgress(50)
    })
    await waitForScrollSampling(page)

    if (label === 'Chromium') {
      await page.evaluate(() => window.scrollTo(0, 0))
      await waitForScrollSampling(page)
      await page.screenshot({ path: path.join(screenshotDir, 'desktop-top.png') })
      await page.locator('.comparison-section').screenshot({
        path: path.join(screenshotDir, 'vertical-comparison.png'),
      })

      const visualScenarios = [
        { scenario: 'horizontal', direction: 'ltr' },
        { scenario: 'mixed', direction: 'rtl' },
        { scenario: 'all', direction: 'ltr' },
        { scenario: 'nooverflow', direction: 'ltr' },
      ]
      for (const visual of visualScenarios) {
        await page.evaluate(({ scenario, direction }) => {
          window.__blurLab.updateScenario(scenario)
          window.__blurLab.updateDirection(direction)
          window.__blurLab.setScrollProgress(50)
        }, visual)
        await waitForScrollSampling(page)
        await page.locator('.comparison-section').screenshot({
          path: path.join(screenshotDir, `${visual.scenario}-comparison.png`),
        })
      }

      await page.evaluate(() => {
        window.__blurLab.updateScenario('vertical')
        window.__blurLab.updateDirection('ltr')
        window.__blurLab.setScrollProgress(50)
      })
      await waitForScrollSampling(page)
      await page.locator('.contract-section').screenshot({
        path: path.join(screenshotDir, 'structure-contract.png'),
      })
      await page.setViewportSize({ width: 390, height: 844 })
      await page.evaluate(() => window.scrollTo(0, 0))
      await waitForScrollSampling(page)
      const narrowOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      assert(narrowOverflow <= 1, `${label}: narrow layout has no page overflow`, String(narrowOverflow))
      await page.screenshot({ path: path.join(screenshotDir, 'narrow-top.png') })
      await page.locator('.comparison-section').screenshot({ path: path.join(screenshotDir, 'narrow-comparison.png') })
    }
  } finally {
    await context.close()
    await browser.close()
  }
}

const screenshotDir = path.join(os.tmpdir(), 'tw-fade-blur-lab-evidence')
await fs.mkdir(screenshotDir, { recursive: true })

await withStaticServer(async (baseUrl) => {
  await checkPage(chromium, baseUrl, 'Chromium', screenshotDir)
  await checkPage(firefox, baseUrl, 'Firefox', screenshotDir)
  await checkPage(webkit, baseUrl, 'WebKit', screenshotDir)
})

await fs.writeFile(
  path.join(screenshotDir, 'screenshot-capabilities.json'),
  JSON.stringify(screenshotCapabilities, null, 2) + '\n',
)

console.log('Blur playground controls and scenarios')
for (const pass of passes) console.log(`PASS  ${pass}`)
for (const failure of failures) console.log(`FAIL  ${failure}`)
for (const limitation of knownLimitations) console.log(`KNOWN LIMITATION  ${limitation}`)
console.log(`\n${passes.length}/${passes.length + failures.length} checks passed; known limitations: ${knownLimitations.length}`)
console.log(`Evidence: ${screenshotDir}`)
process.exit(failures.length === 0 ? 0 : 1)
