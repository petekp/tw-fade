import fs from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium, devices, errors as playwrightErrors, webkit } from 'playwright'
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
  await page.evaluate(() => {
    document.body.scrollTop = 80
    document.body.dispatchEvent(new Event('scroll'))
  })
  await page.waitForFunction(() => document.querySelector('[data-floating-surface-palette]').dataset.visible === 'true')
}

async function readPaletteRovingState(page) {
  return page.evaluate(() => {
    const palette = document.querySelector('[data-floating-surface-palette]')
    const buttons = Array.from(palette.querySelectorAll('[data-surface-option]'))
    return {
      visible: palette.dataset.visible === 'true',
      selected: buttons.find((button) => button.getAttribute('aria-checked') === 'true')?.dataset.surfaceOption,
      tabStops: buttons.filter((button) => button.tabIndex === 0).map((button) => button.dataset.surfaceOption),
      focused: document.activeElement?.dataset.surfaceOption,
    }
  })
}

async function checkSurfacePickerRovingTab(page, label) {
  const hidden = await readPaletteRovingState(page)
  assert(!hidden.visible && hidden.selected === 'graphite' && hidden.tabStops.length === 0,
    `${label}: hidden palette keeps its selected swatch out of the Tab order`, JSON.stringify(hidden))

  const previous = page.locator('.footer-social-links a').last()
  await previous.evaluate((element) => element.focus({ preventScroll: true }))
  await exposePalette(page)
  const firstReveal = await readPaletteRovingState(page)
  assert(firstReveal.selected === 'graphite' && firstReveal.tabStops.join() === 'graphite',
    `${label}: first reveal keeps one Tab stop on the selected swatch`, JSON.stringify(firstReveal))
  await page.keyboard.press('Tab')
  const firstEntry = await readPaletteRovingState(page)
  assert(firstEntry.focused === 'graphite' && firstEntry.tabStops.join() === 'graphite',
    `${label}: Tab enters the first reveal on its selected swatch`, JSON.stringify(firstEntry))

  await page.locator('[data-surface-option="cobalt"]').click()
  await page.waitForFunction(() => document.documentElement.dataset.surface === 'cobalt')
  await page.evaluate(() => {
    document.body.scrollTop = 0
    document.body.dispatchEvent(new Event('scroll'))
  })
  await page.waitForFunction(() => document.querySelector('[data-floating-surface-palette]').dataset.visible === 'false')
  const hiddenAgain = await readPaletteRovingState(page)
  assert(hiddenAgain.selected === 'cobalt' && hiddenAgain.tabStops.length === 0,
    `${label}: hidden palette keeps the changed selection out of the Tab order`, JSON.stringify(hiddenAgain))

  await previous.evaluate((element) => element.focus({ preventScroll: true }))
  await exposePalette(page)
  const secondReveal = await readPaletteRovingState(page)
  assert(secondReveal.selected === 'cobalt' && secondReveal.tabStops.join() === 'cobalt',
    `${label}: second reveal keeps one Tab stop on the changed selection`, JSON.stringify(secondReveal))
  await page.keyboard.press('Tab')
  const secondEntry = await readPaletteRovingState(page)
  assert(secondEntry.focused === 'cobalt' && secondEntry.tabStops.join() === 'cobalt',
    `${label}: Tab enters the second reveal on its selected swatch`, JSON.stringify(secondEntry))

  await page.locator('[data-surface-option="graphite"]').click()
  await page.waitForFunction(() => document.documentElement.dataset.surface === 'graphite')
  await page.locator('[data-surface-option="graphite"]').evaluate((element) => element.blur())
  await page.evaluate(() => {
    document.body.scrollTop = 0
    document.body.dispatchEvent(new Event('scroll'))
  })
  await page.waitForFunction(() => document.querySelector('[data-floating-surface-palette]').dataset.visible === 'false')
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
      advancedScrollLeft: document.querySelector('[data-demo="type-specimen"]')?.scrollLeft,
      advancedScrollTop: document.querySelector('[data-demo="type-specimen"]')?.scrollTop,
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
    tabStops: Array.from(document.querySelectorAll('[data-surface-option]')).filter((button) => button.tabIndex === 0).map((button) => button.dataset.surfaceOption),
    focused: document.activeElement?.dataset.surfaceOption,
  }))
  assert(
    keyboardSurface.surface === 'cobalt' && keyboardSurface.cobaltChecked === 'true',
    `${label}: surface radio keyboard navigation updates theme`,
    JSON.stringify(keyboardSurface),
  )
  assert(keyboardSurface.tabStops.join() === 'cobalt' && keyboardSurface.focused === 'cobalt', `${label}: selected surface is the only palette Tab stop`, JSON.stringify(keyboardSurface))
  const focusStyle = await page.evaluate(() => {
    const button = document.activeElement
    const focused = { outline: getComputedStyle(button).outlineStyle, shadow: getComputedStyle(button).boxShadow }
    button.blur()
    const restingShadow = getComputedStyle(button).boxShadow
    button.focus()
    return { ...focused, restingShadow }
  })
  assert(focusStyle.outline !== 'none' || focusStyle.shadow !== focusStyle.restingShadow, `${label}: keyboard focus is visible on the surface picker`, JSON.stringify(focusStyle))

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

  const topEdge = page.locator('[data-fade-edge-toggle="top"]')
  await topEdge.focus()
  await page.keyboard.press('Space')
  await page.waitForTimeout(160)
  const edgeAfterKeyboard = await topEdge.getAttribute('aria-pressed')
  assert(edgeAfterKeyboard === 'false', `${label}: edge toggle activates from keyboard`, edgeAfterKeyboard)

  for (const [demo, key, axis] of [['chat', 'ArrowDown', 'scrollTop'], ['type-specimen', 'ArrowDown', 'scrollTop'], ['anybg', 'ArrowRight', 'scrollLeft']]) {
    const scroller = page.locator(`[data-demo="${demo}"]`)
    const initial = await scroller.evaluate((element, axis) => {
      element[axis] = 0
      return { tabindex: element.tabIndex, name: element.getAttribute('aria-label') || element.getAttribute('aria-labelledby') }
    }, axis)
    assert(initial.tabindex === 0 && Boolean(initial.name), `${label}: ${demo} provides named keyboard access`, JSON.stringify(initial))
    await scroller.focus()
    await page.keyboard.press(key)
    const moved = await page.waitForFunction(
      ({ demo, axis }) => document.querySelector(`[data-demo="${demo}"]`)[axis] > 0,
      { demo, axis },
      { timeout: 3000 },
    ).then(() => true, (error) => {
      if (error instanceof playwrightErrors.TimeoutError) return false
      throw error
    })
    assert(moved, `${label}: keyboard scrolls the ${demo} example`)
  }
}

async function checkChatEffects(page, label) {
  const chat = page.locator('[data-demo="chat"]')
  const controls = page.locator('[data-chat-effects]')
  const blur = controls.locator('input[value="blur"]')
  if (!(await blur.isEnabled())) {
    assert(await controls.locator('input[value="both"]').isDisabled(), `${label}: unavailable blur disables both blur options`)
    assert(await page.locator('[data-chat-blur-support]').isVisible(), `${label}: unavailable blur has an explanation`)
    assert(await controls.locator('input[value="fade"]').isChecked(), `${label}: unavailable blur keeps fading selected`)
    return
  }
  const position = await chat.evaluate((element) => {
    element.scrollTop = Math.floor((element.scrollHeight - element.clientHeight) / 2)
    return element.scrollTop
  })
  for (const [mode, code, opacity, blurred] of [
    ['Blur', 'fade-blur-y', false, true],
    ['Both', 'fade-y fade-blur-y', true, true],
    ['Fade', 'fade-y', true, false],
  ]) {
    await controls.getByText(mode, { exact: true }).click()
    const effectsReady = await page.waitForFunction(({ opacity, blurred }) => {
      const chat = document.querySelector('[data-demo="chat"]')
      const host = getComputedStyle(chat)
      const overlay = getComputedStyle(chat, '::after')
      const faded = ['t', 'b'].some((edge) => Number(host.getPropertyValue(`--tw-fade-opacity-${edge}`)) > 0)
      return faded === opacity && (overlay.content !== 'none' && overlay.backdropFilter !== 'none') === blurred
    }, { opacity, blurred }, { timeout: 3000 }).then(() => true, (error) => {
      if (error instanceof playwrightErrors.TimeoutError) return false
      throw error
    })
    const state = await chat.evaluate((element) => ({
      top: element.scrollTop,
      faded: ['t', 'b'].some((edge) => Number(getComputedStyle(element).getPropertyValue(`--tw-fade-opacity-${edge}`)) > 0),
      blurred: getComputedStyle(element, '::after').content !== 'none' && getComputedStyle(element, '::after').backdropFilter !== 'none',
    }))
    assert(effectsReady && state.faded === opacity && state.blurred === blurred, `${label}: chat ${mode} selects the requested effects`, JSON.stringify(state))
    assert(Math.abs(state.top - position) <= 1, `${label}: chat ${mode} preserves scroll position`, JSON.stringify(state))
    assert(await page.locator('[data-chat-class]').textContent() === code, `${label}: chat ${mode} shows its public classes`)
  }
  await controls.locator('input[value="fade"]').focus()
  await page.keyboard.press('ArrowRight')
  assert(await blur.isChecked(), `${label}: chat effects support native radio keyboard selection`)
  assert(await page.locator('[data-chat-class]').textContent() === 'fade-blur-y', `${label}: keyboard selection updates the chat effect`)
  await controls.getByText('Fade', { exact: true }).click()
}

async function checkInstallCopy(page, label) {
  await page.evaluate(() => {
    window.__copiedCommand = null
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async () => { throw new Error('Clipboard unavailable') } },
    })
    window.__originalCopyCommand = document.execCommand
    document.execCommand = () => false
  })
  try {
    const button = page.locator('[data-copy-install]')
    await button.focus()
    await page.keyboard.press('Enter')
    await page.waitForFunction(() => !document.querySelector('[data-copy-install-error]').hidden)
    assert(await button.evaluate((element) => document.activeElement === element), `${label}: failed fallback copy preserves keyboard focus`)
    const copyFailure = await page.evaluate(() => {
      const visible = document.querySelector('[data-copy-install-error]').textContent.replace(/\s+/g, ' ').trim()
      const status = document.querySelector('[data-copy-install-status]')
      return { visible, announcement: status.textContent.replace(/\s+/g, ' ').trim(), live: status.getAttribute('aria-live') }
    })
    assert(await page.locator('[data-copy-install-error]').isVisible(), `${label}: failed install copy displays recovery feedback`)
    assert(copyFailure.live === 'polite' && copyFailure.visible.length > 0 && copyFailure.announcement.includes(copyFailure.visible),
      `${label}: live failure announcement includes the visible recovery action`, JSON.stringify(copyFailure))
    await page.evaluate(() => {
      navigator.clipboard.writeText = async (text) => { window.__copiedCommand = text }
    })
    await button.click()
    await page.waitForFunction(() => document.querySelector('[data-copy-install]').dataset.copied === 'true')
    assert(await page.evaluate(() => document.querySelector('[data-copy-install-error]').hidden && window.__copiedCommand === document.querySelector('[data-install-command]').textContent.trim()), `${label}: a successful retry copies the command and clears the error`)
  } finally {
    await page.evaluate(() => { document.execCommand = window.__originalCopyCommand })
  }
}

// Touch must not drive the lexicon's hover/press springs. On Android the
// browser fires pointerenter/pointerdown on the finger's target BEFORE it knows
// the gesture is a scroll, so ungated hover/press feedback springs every word a
// flick grazes ("chars dancing") and strands enlarged words mid-list. Assert a
// touch pointer leaves the word scale inert, while a real mouse pointer still
// animates it and a tap still selects — so the guard can't pass by simply
// disabling the springs.
async function checkTouchHoverInert(page, label) {
  const result = await page.evaluate(async () => {
    const rows = Array.from(document.querySelectorAll('.lexicon-row'))
    const idle = rows.find((r) => r.getAttribute('aria-selected') !== 'true')
    const word = idle.querySelector('.lexicon-word')
    const scale = () => parseFloat(getComputedStyle(word).getPropertyValue('--lex-word-scale')) || 1
    const frame = () => new Promise((res) => requestAnimationFrame(res))
    const peakDeviation = async (pointerType) => {
      const rest = scale()
      idle.dispatchEvent(new PointerEvent('pointerenter', { pointerType, bubbles: true }))
      idle.dispatchEvent(new PointerEvent('pointerdown', { pointerType, bubbles: true }))
      let peak = 0
      for (let i = 0; i < 18; i++) {
        peak = Math.max(peak, Math.abs(scale() - rest))
        await frame()
      }
      // Release and clear state so the next probe starts from rest.
      idle.dispatchEvent(new PointerEvent('pointerup', { pointerType, bubbles: true }))
      idle.dispatchEvent(new PointerEvent('pointerleave', { pointerType, bubbles: true }))
      for (let i = 0; i < 18; i++) await frame()
      return peak
    }
    const touch = await peakDeviation('touch')
    const mouse = await peakDeviation('mouse')
    const tapTarget = rows.find((r) => r.getAttribute('aria-selected') !== 'true')
    tapTarget.click()
    return { touch, mouse, tapSelected: tapTarget.getAttribute('aria-selected') === 'true' }
  })
  assert(result.touch < 0.005, `${label}: touch does not spring lexicon hover/press`, `peak ${result.touch.toFixed(3)}`)
  assert(result.mouse > 0.005, `${label}: mouse still springs lexicon hover/press`, `peak ${result.mouse.toFixed(3)}`)
  assert(result.tapSelected, `${label}: tap still selects a lexicon row`)
}

async function checkTouchSurfacePickerIsSteady(page, label) {
  const result = await page.evaluate(async () => {
    const palette = document.querySelector('[data-floating-surface-palette]')
    const cobalt = document.querySelector('[data-surface-option="cobalt"]')
    if (!palette || !cobalt) return null

    palette.dataset.visible = 'true'
    palette.setAttribute('aria-hidden', 'false')
    for (const button of palette.querySelectorAll('[data-surface-option]')) {
      button.tabIndex = 0
    }

    const readScale = () => ({
      button: parseFloat(getComputedStyle(cobalt).getPropertyValue('--surface-button-scale')) || 1,
      swatch: parseFloat(getComputedStyle(cobalt).getPropertyValue('--surface-swatch-scale')) || 0,
    })
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve))

    cobalt.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }))
    cobalt.click()

    const first = readScale()
    let maxButtonDrift = 0
    let maxSwatchDrift = 0
    for (let i = 0; i < 18; i++) {
      await frame()
      const current = readScale()
      maxButtonDrift = Math.max(maxButtonDrift, Math.abs(current.button - first.button))
      maxSwatchDrift = Math.max(maxSwatchDrift, Math.abs(current.swatch - first.swatch))
    }

    return {
      surface: document.documentElement.dataset.surface,
      checked: cobalt.getAttribute('aria-checked'),
      buttonScale: first.button,
      swatchScale: first.swatch,
      maxButtonDrift,
      maxSwatchDrift,
    }
  })

  assert(result, `${label}: touch surface picker exists`)
  if (!result) return
  assert(
    result.surface === 'cobalt' && result.checked === 'true',
    `${label}: touch tap changes surface`,
    JSON.stringify(result),
  )
  assert(
    result.maxButtonDrift < 0.005 && result.maxSwatchDrift < 0.005,
    `${label}: touch tap keeps surface picker scale steady`,
    JSON.stringify(result),
  )
}

async function checkSurfacePickerMotion(browser, url, {
  label,
  slowFrames = false,
  motionUnavailable = false,
}) {
  const context = await browser.newContext({ viewport: { width: 900, height: 700 } })
  if (slowFrames) {
    await context.addInitScript(() => {
      window.requestAnimationFrame = (callback) => {
        return window.setTimeout(() => callback(performance.now()), 1000 / 30)
      }
      window.cancelAnimationFrame = (id) => window.clearTimeout(id)
    })
  }
  if (motionUnavailable) {
    await context.route('https://cdn.jsdelivr.net/npm/motion@*/dist/motion.js', (route) => {
      return route.fulfill({ contentType: 'application/javascript', body: '' })
    })
  }
  const page = await context.newPage()
  try {
    await page.goto(url, { waitUntil: 'load' })
    await exposePalette(page)
    const result = await page.evaluate(async () => {
      const buttons = [...document.querySelectorAll('[data-surface-option]')]
      const find = (theme) => buttons.find((button) => button.dataset.surfaceOption === theme)
      const cobalt = find('cobalt')
      const read = (button) => {
        const style = getComputedStyle(button)
        return {
          button: Number(style.getPropertyValue('--surface-button-scale')),
          swatch: Number(style.getPropertyValue('--surface-swatch-scale')),
        }
      }
      const pointer = (button, type, pointerType = 'mouse') => {
        button.dispatchEvent(new PointerEvent(type, { pointerType, bubbles: true }))
      }
      const mouseSelect = (button) => {
        buttons
          .filter((other) => other !== button)
          .forEach((other) => pointer(other, 'pointerleave'))
        pointer(button, 'pointerenter')
        pointer(button, 'pointerdown')
        pointer(button, 'pointerup')
        button.click()
      }
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
      const samples = []
      let frame = 0
      const sample = () => {
        samples.push(...buttons.map(read))
        frame = requestAnimationFrame(sample)
      }
      sample()
      try {
        mouseSelect(cobalt)
        await wait(550)
        pointer(cobalt, 'pointerleave')
        pointer(find('pine'), 'pointerdown', 'touch')
        find('pine').click()

        const hoverStart = read(cobalt).swatch
        const hoverSamples = []
        pointer(cobalt, 'pointerenter')
        for (let i = 0; i < 9; i++) {
          await new Promise((resolve) => requestAnimationFrame(resolve))
          hoverSamples.push(read(cobalt).swatch)
        }

        for (const theme of ['berry', 'graphite', 'pine', 'cobalt']) {
          mouseSelect(find(theme))
          await wait(55)
        }
        await wait(700)
        return {
          motionLoaded: typeof window.Motion?.animate === 'function',
          stable: samples.every(({ button, swatch }) => (
            Number.isFinite(button) && button > 0.85 && button < 1.18 &&
            Number.isFinite(swatch) && swatch > 0.4 && swatch < 1.15
          )),
          scaleRange: {
            button: [
              Math.min(...samples.map((sample) => sample.button)),
              Math.max(...samples.map((sample) => sample.button)),
            ],
            swatch: [
              Math.min(...samples.map((sample) => sample.swatch)),
              Math.max(...samples.map((sample) => sample.swatch)),
            ],
          },
          hoverResumesFromTouch: Math.abs(hoverStart - 0.54) < 0.005 &&
            hoverSamples.every((value) => value >= 0.53 && value <= 0.72),
          hoverAnimated: Math.max(...hoverSamples) - Math.min(...hoverSamples) > 0.002,
          finalSurface: document.documentElement.dataset.surface,
          settled: buttons.every((button) => {
            const current = read(button)
            const selected = button.getAttribute('aria-checked') === 'true'
            return Math.abs(current.button - (selected ? 1.05 : 1)) < 0.005 &&
              Math.abs(current.swatch - (selected ? 0.92 : 0.54)) < 0.005
          }),
        }
      } finally {
        cancelAnimationFrame(frame)
      }
    })
    assert(result.motionLoaded === !motionUnavailable, `${label}: Motion availability matches the scenario`, JSON.stringify(result))
    assert(result.stable, `${label}: rapid selections keep scales bounded`, JSON.stringify(result))
    assert(result.hoverResumesFromTouch, `${label}: mouse hover resumes from the visible touch state`, JSON.stringify(result))
    assert(result.hoverAnimated === !motionUnavailable, `${label}: hover animates when Motion is available`, JSON.stringify(result))
    assert(result.finalSurface === 'cobalt' && result.settled, `${label}: final selection settles correctly`, JSON.stringify(result))
  } finally {
    await context.close()
  }
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

  const railAligned = !checkRailInset || await page.waitForFunction(() => {
    const rail = document.querySelector('[data-demo="rail"]')
    const recede = Array.from(rail?.querySelectorAll('.rail-card') ?? [])
      .find((card) => card.querySelector('.rail-card-label')?.textContent.trim() === 'Recede')
    return rail && recede && Math.abs(recede.getBoundingClientRect().left - rail.getBoundingClientRect().left - 140) <= 1
  }, null, { timeout: 3000 }).then(() => true, (error) => {
    if (error instanceof playwrightErrors.TimeoutError) return false
    throw error
  })

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
      railAligned && Math.abs((state.recedeLeftFromRail ?? 0) - 140) <= 1,
      `${label}: Recede starts 140px from rail edge`,
      String(state.recedeLeftFromRail),
    )
  }
  assert(state.verticalRows >= 5, `${label}: vertical list rendered`, String(state.verticalRows))
  assert(state.advancedLabel === 'fade fade-size-2xl fade-travel-lg', `${label}: advanced controls initialize class readout`, state.advancedLabel)
  assert(state.edgePressed === 'true,true,true,true', `${label}: all edge toggles initialize on`, state.edgePressed)
  assert(state.advancedScrollLeft === 100 && state.advancedScrollTop === 100, `${label}: advanced content starts scrolled 100px on both axes`, `${state.advancedScrollLeft},${state.advancedScrollTop}`)
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
    assert(state.wavePathD.startsWith('M64 0C75.781'), `${label}: SVG wave starts at top geometry`, state.wavePathD.slice(0, 24))
    assert(state.wavePatternHeight === '1629', `${label}: SVG wave pattern starts at top wavelength`, state.wavePatternHeight)
  }
  assert(/transform/.test(state.movingWillChange.railCard), `${label}: rail cards are composited`, state.movingWillChange.railCard)
  assert(/transform/.test(state.movingWillChange.easedLine), `${label}: eased line is composited`, state.movingWillChange.easedLine)
  assert(/opacity/.test(state.movingWillChange.token), `${label}: composable tokens expose compositor hints`, state.movingWillChange.token)
  if (checkKeyboard) await checkSurfacePickerRovingTab(page, label)

  // Drive the scroll-linked wave field and confirm it morphs. Set scrollTop
  // directly (the most portable scroll primitive) and dispatch the `scroll`
  // event the field listens for: headless Linux WebKit does not always emit a
  // native scroll event for a *programmatic* position change on an overflow
  // body the way macOS WebKit does, which would otherwise freeze the wave and
  // fail this check only in CI. Then poll for the morph (rAF-driven) instead
  // of betting on a single fixed delay.
  const waveAfterScroll = await page.evaluate(
    async ({ initialD, initialHeight, reduced }) => {
      const body = document.body
      body.scrollTop = Math.min(900, body.scrollHeight - body.clientHeight)
      body.dispatchEvent(new Event('scroll'))
      const sample = () => ({
        d: document.querySelector('[data-demo-wave-path]')?.getAttribute('d') ?? '',
        height: document.querySelector('[data-demo-wave-pattern]')?.getAttribute('height') ?? '',
        bodyAlive: Boolean(document.body),
      })
      if (reduced) return sample()
      const deadline = performance.now() + 3000
      let current = sample()
      while (
        performance.now() < deadline &&
        current.height === initialHeight &&
        current.d === initialD
      ) {
        await new Promise((resolve) => requestAnimationFrame(resolve))
        current = sample()
      }
      return current
    },
    { initialD: state.wavePathD, initialHeight: state.wavePatternHeight, reduced: reducedMotion },
  )
  assert(waveAfterScroll.bodyAlive, `${label}: page survives scroll-linked animation probe`)
  if (!reducedMotion) {
    assert(waveAfterScroll.d && waveAfterScroll.d !== state.wavePathD, `${label}: wave path geometry changes with scroll`, waveAfterScroll.d.slice(0, 32))
    assert(waveAfterScroll.height !== state.wavePatternHeight, `${label}: wave wavelength changes with scroll`, `${state.wavePatternHeight} -> ${waveAfterScroll.height}`)
  }
  await page.evaluate(() => {
    document.body.scrollTop = 0
    document.body.dispatchEvent(new Event('scroll'))
  })
  await page.waitForTimeout(120)

  await checkTouchHoverInert(page, label)
  await checkTouchSurfacePickerIsSteady(page, label)

  if (checkKeyboard) {
    await runInteractions(page, label)
    await checkInstallCopy(page, label)
  }
  await checkChatEffects(page, label)
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
      label: 'export WebKit desktop',
      url: `${baseUrl}/tw-fade`,
      viewport: { width: 1280, height: 1100 },
    })
    await smokePage(webkitBrowser, {
      label: 'export WebKit iPhone',
      url: `${baseUrl}/tw-fade`,
      viewport: devices['iPhone 15 Pro'].viewport,
      contextOptions: devices['iPhone 15 Pro'],
      checkRailInset: false,
      checkKeyboard: false,
    })
    for (const [engine, label] of [[browser, 'Chromium'], [webkitBrowser, 'WebKit']]) {
      await checkSurfacePickerMotion(engine, `${baseUrl}/tw-fade`, {
        label: `${label} theme picker at 30 fps`,
        slowFrames: true,
      })
      await checkSurfacePickerMotion(engine, `${baseUrl}/tw-fade`, {
        label: `${label} theme picker without Motion`,
        motionUnavailable: true,
      })
    }
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

console.log('PASS  file, exported, mobile, WebKit iPhone, reduced-motion, keyboard, accessibility, compositing, and theme-picker Motion checks')
