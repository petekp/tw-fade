const root = document.documentElement
const signalTemplate = document.querySelector('#signal-template')
const syncScrollports = Array.from(document.querySelectorAll('[data-sync-scroll]'))
const selectionClasses = {
  opacity: ['fade', 'fade-y', 'fade-x', 'fade-top', 'fade-bottom', 'fade-start', 'fade-end'],
  blur: ['fade-blur', 'fade-blur-y', 'fade-blur-x', 'fade-blur-top', 'fade-blur-bottom', 'fade-blur-start', 'fade-blur-end'],
}
const blurFrames = () =>
  Array.from(document.querySelectorAll(selectionClasses.blur.map((name) => `.${name}`).join(', ')))
const variantEffects = {
  baseline: ['opacity'],
  single: ['opacity', 'blur'],
  progressive: ['opacity', 'blur'],
  'blur-only': ['blur'],
}

const scenarios = {
  vertical: {
    opacity: ['fade-y'],
    blur: ['fade-blur-y'],
    axis: 'y',
    title: 'Vertical detail',
    note: 'Fine text, hairlines, color boundaries, and checker detail.',
  },
  horizontal: {
    opacity: ['fade-x'],
    blur: ['fade-blur-x'],
    axis: 'x',
    title: 'Horizontal rail',
    note: 'Long color runs expose unequal start and end strength.',
  },
  mixed: {
    opacity: ['fade-top', 'fade-end'],
    blur: ['fade-blur-top', 'fade-blur-end'],
    axis: 'both',
    title: 'Top + logical end',
    note: 'Only two named edges should change. RTL moves end to the left.',
  },
  all: {
    opacity: ['fade'],
    blur: ['fade-blur'],
    axis: 'both',
    title: 'All four edges',
    note: 'Checker corners expose seams, double blur, and bright halos.',
  },
  nooverflow: {
    opacity: ['fade-y'],
    blur: ['fade-blur-y'],
    axis: 'y',
    title: 'No overflow',
    note: 'With scroll timelines, content that fits has no fade or blur. Otherwise opacity uses a static fade.',
  },
}

const synchronizedPositions = new WeakMap()
let scrollProgress = 50
let edgeClicks = 0

function cloneSignalContent() {
  if (!signalTemplate) return
  for (const mount of document.querySelectorAll('[data-signal-mount]')) {
    mount.replaceChildren(signalTemplate.content.cloneNode(true))
  }
}

function supportsBlur() {
  return (
    CSS.supports('anchor-name: --tw-fade-blur') &&
    CSS.supports('position-anchor: --tw-fade-blur') &&
    CSS.supports('anchor-scope: --tw-fade-blur') &&
    CSS.supports('backdrop-filter: blur(1px)') &&
    CSS.supports('animation-timeline: scroll()') &&
    CSS.supports('timeline-scope: --tw-fade-y') &&
    CSS.supports('selector(:nth-child(1 of .fade-blur-layer))')
  )
}

function setSupportStatus() {
  const status = document.querySelector('[data-support-status]')
  if (!status) return
  const supported = supportsBlur()
  status.dataset.supported = String(supported)
  status.textContent = supported
    ? 'Required CSS syntax detected. Check blur rendering below.'
    : 'Required CSS syntax unavailable. Opacity fades remain; blur-only content stays clear.'
}

function setPressedState(control, value) {
  for (const button of document.querySelectorAll(`[data-control="${control}"]`)) {
    button.setAttribute('aria-pressed', String(button.dataset.value === value))
  }
}

function selectedClasses(variant) {
  const scenario = scenarios[root.dataset.scenario]
  return variantEffects[variant].flatMap((effect) => scenario[effect])
}

function updateApiLabels() {
  const size = root.dataset.size === 'auto' ? '' : ` fade-size-${root.dataset.size}`
  const preset = `fade-blur-${root.dataset.preset}`
  for (const [variant, effects] of Object.entries(variantEffects)) {
    const label = document.querySelector(`[data-api-label="${variant}"]`)
    if (!label) continue
    const strength = effects.includes('blur') ? ` ${preset}` : ''
    const layers = variant === 'progressive' ? ' + 4 layers' : ''
    label.textContent = `fade-blur-frame ${selectedClasses(variant).join(' ')}${size}${strength}${layers}`
  }
}

function logicalScrollLeft(scrollport, progress) {
  const max = Math.max(0, scrollport.scrollWidth - scrollport.clientWidth)
  return root.dataset.direction === 'rtl' ? -max * progress : max * progress
}

function normalizedHorizontalProgress(scrollport) {
  const max = Math.max(0, scrollport.scrollWidth - scrollport.clientWidth)
  if (!max) return 0
  return Math.min(1, Math.max(0, Math.abs(scrollport.scrollLeft) / max))
}

function normalizedVerticalProgress(scrollport) {
  const max = Math.max(0, scrollport.scrollHeight - scrollport.clientHeight)
  if (!max) return 0
  return Math.min(1, Math.max(0, scrollport.scrollTop / max))
}

function updateScrollReadout(value) {
  const rounded = Math.round(value)
  const output = document.querySelector('[data-scroll-output]')
  const slider = document.querySelector('[data-scroll-slider]')
  const name = document.querySelector('[data-scroll-name]')
  if (output) output.value = `${rounded}%`
  if (slider && Number(slider.value) !== rounded) slider.value = String(rounded)

  if (!name) return
  if (root.dataset.scenario === 'nooverflow') {
    name.textContent = CSS.supports('animation-timeline: scroll()')
      ? 'No overflow · no active edge'
      : 'No overflow · static opacity fade'
    return
  }
  if (rounded === 0) name.textContent = 'Start · leading edge inactive'
  else if (rounded <= 8) name.textContent = 'Onset · watch for a pop'
  else if (rounded < 45) name.textContent = 'Early travel · band growing'
  else if (rounded <= 55) name.textContent = 'Middle · both edges active'
  else if (rounded < 92) name.textContent = 'Late travel · band holding'
  else if (rounded < 100) name.textContent = 'Release · trailing edge clearing'
  else name.textContent = 'End · trailing edge inactive'
}

function setScrollProgress(value) {
  const progress = Math.min(100, Math.max(0, Number(value))) / 100
  const axis = scenarios[root.dataset.scenario].axis
  scrollProgress = progress * 100
  for (const scrollport of syncScrollports) {
    if (axis === 'x' || axis === 'both') {
      scrollport.scrollLeft = logicalScrollLeft(scrollport, progress)
    }
    if (axis === 'y' || axis === 'both') {
      const max = Math.max(0, scrollport.scrollHeight - scrollport.clientHeight)
      scrollport.scrollTop = max * progress
    }
    synchronizedPositions.set(scrollport, { top: scrollport.scrollTop, left: scrollport.scrollLeft })
  }
  updateScrollReadout(scrollProgress)
}

function syncFrom(source) {
  const expected = synchronizedPositions.get(source)
  synchronizedPositions.delete(source)
  if (expected && Math.abs(source.scrollTop - expected.top) <= 1 && Math.abs(source.scrollLeft - expected.left) <= 1) return
  const axis = scenarios[root.dataset.scenario].axis
  const x = normalizedHorizontalProgress(source)
  const y = normalizedVerticalProgress(source)

  for (const scrollport of syncScrollports) {
    if (scrollport === source) continue
    if (axis === 'x' || axis === 'both') scrollport.scrollLeft = logicalScrollLeft(scrollport, x)
    if (axis === 'y' || axis === 'both') {
      const max = Math.max(0, scrollport.scrollHeight - scrollport.clientHeight)
      scrollport.scrollTop = max * y
    }
    synchronizedPositions.set(scrollport, { top: scrollport.scrollTop, left: scrollport.scrollLeft })
  }

  const primary = axis === 'x' ? x : axis === 'y' ? y : (x + y) / 2
  scrollProgress = primary * 100
  updateScrollReadout(scrollProgress)
}

function updateScenario(value) {
  root.dataset.scenario = value
  const scenario = scenarios[value]
  for (const scrollport of syncScrollports) {
    scrollport.parentElement.classList.remove(...selectionClasses.opacity, ...selectionClasses.blur)
    scrollport.parentElement.classList.add(...selectedClasses(scrollport.dataset.variant))
  }
  const title = document.querySelector('[data-scenario-title]')
  const note = document.querySelector('[data-scenario-note]')
  if (title) title.textContent = scenario.title
  if (note) {
    note.dataset.warning = 'false'
    note.textContent = scenario.note
  }
  setPressedState('scenario', value)
  updateApiLabels()
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      setScrollProgress(scrollProgress)
      window.setTimeout(updateScenarioHealth, 300)
    }),
  )
}

function updateScenarioHealth() {
  if (root.dataset.scenario !== 'nooverflow') return
  const note = document.querySelector('[data-scenario-note]')
  const scrollport = document.querySelector('[data-variant="progressive"]')
  if (!note || !scrollport || !supportsBlur()) return
  const style = getComputedStyle(scrollport.parentElement)
  const gates = ['--tw-fade-t', '--tw-fade-b', '--tw-fade-l', '--tw-fade-r'].map(
    (name) => Number.parseFloat(style.getPropertyValue(name)) || 0,
  )
  const hasResidue = gates.some((gate) => gate > 0.05)
  note.dataset.warning = String(hasResidue)
  note.textContent = hasResidue
    ? 'This engine retains scroll progress after content stops overflowing. Use fade-none-y fade-blur-none-y to disable both effects when the content is known to fit.'
    : scenarios.nooverflow.note
}

function updatePreset(value) {
  root.dataset.preset = value
  for (const scrollport of blurFrames()) {
    scrollport.classList.remove('fade-blur-sm', 'fade-blur-md', 'fade-blur-lg')
    scrollport.classList.add(`fade-blur-${value}`)
  }

  setPressedState('preset', value)
  updateApiLabels()
  requestAnimationFrame(updateLayerCounts)
}

function updateSize(value) {
  root.dataset.size = value
  for (const scrollport of [...syncScrollports, document.querySelector('[data-structure-scrollport]')]) {
    if (!scrollport) continue
    scrollport.parentElement.classList.remove('fade-size-sm', 'fade-size-lg')
    if (value !== 'auto') scrollport.parentElement.classList.add(`fade-size-${value}`)
  }
  document.querySelector('[data-size-value]').textContent = value === 'auto' ? 'auto' : `fade-size-${value}`
  setPressedState('size', value)
  updateApiLabels()
  requestAnimationFrame(updateLayerCounts)
}

function updateGuides() {
  for (const scrollport of syncScrollports) {
    const guide = scrollport.parentElement.querySelector('.effect-guides')
    const style = getComputedStyle(scrollport.parentElement)
    guide?.style.setProperty('--lab-guide-band-y', style.getPropertyValue('--tw-fade-edge-size-t'))
    guide?.style.setProperty('--lab-guide-band-x', style.getPropertyValue('--tw-fade-edge-size-l'))
  }
}

function updateSurface(value) {
  root.dataset.surface = value
  setPressedState('surface', value)
}

function updateDirection(value) {
  root.dataset.direction = value
  for (const scrollport of [...syncScrollports, document.querySelector('[data-structure-scrollport]')]) {
    if (scrollport) scrollport.parentElement.dir = value
  }
  setPressedState('direction', value)
  requestAnimationFrame(() => requestAnimationFrame(() => setScrollProgress(scrollProgress)))
}

function countActiveBlurSheets(scrollport) {
  if (!scrollport) return 0
  const pseudo = getComputedStyle(scrollport.parentElement, '::after')
  const pseudoFilter = pseudo.backdropFilter || pseudo.webkitBackdropFilter || ''
  const pseudoActive = pseudo.content !== 'none' && pseudoFilter !== 'none' ? 1 : 0
  const activeChildren = Array.from(
    scrollport.parentElement.querySelectorAll(':scope > .fade-blur-layer'),
  ).filter((layer) => getComputedStyle(layer).display !== 'none').length
  return pseudoActive + activeChildren
}

function updateLayerCounts() {
  for (const variant of ['baseline', 'single', 'progressive', 'blur-only']) {
    const scrollport = document.querySelector(`[data-variant="${variant}"]`)
    const output = document.querySelector(`[data-layer-count="${variant}"]`)
    if (!output) continue
    const count = countActiveBlurSheets(scrollport)
    output.textContent = `${count} blur ${count === 1 ? 'sheet' : 'sheets'}`
  }
  const single = document.querySelector('[data-variant=single]')
  document.querySelector('[data-strength-value]').textContent = getComputedStyle(single.parentElement).getPropertyValue('--tw-fade-blur-strength').trim()
  updateGuides()
  updateStructureReadout()
}

function updateStructureCount(value) {
  const scrollport = document.querySelector('[data-structure-scrollport]')
  if (!scrollport) return
  for (const layer of scrollport.parentElement.querySelectorAll(':scope > .fade-blur-layer')) layer.remove()
  for (let index = 0; index < value; index += 1) {
    const layer = document.createElement('span')
    layer.className = 'fade-blur-layer'
    layer.setAttribute('aria-hidden', 'true')
    scrollport.parentElement.append(layer)
  }
  for (const button of document.querySelectorAll('[data-structure-count]')) {
    button.setAttribute('aria-pressed', String(Number(button.dataset.structureCount) === value))
  }
  requestAnimationFrame(() => {
    scrollport.scrollTop = (scrollport.scrollHeight - scrollport.clientHeight) / 2
    updateStructureReadout()
  })
}

function updateStructureReadout() {
  const scrollport = document.querySelector('[data-structure-scrollport]')
  const count = scrollport?.parentElement.querySelectorAll(':scope > .fade-blur-layer').length ?? 0
  const active = countActiveBlurSheets(scrollport)
  const state = document.querySelector('[data-structure-state]')
  const result = document.querySelector('[data-structure-result]')
  const code = document.querySelector('[data-structure-code]')
  const enhanced = count === 4 && active === 5
  if (state) {
    state.textContent = !supportsBlur()
      ? 'Normal fade fallback'
      : enhanced
        ? 'Progressive blur'
        : 'Single blur'
  }
  if (result) result.textContent = `${active} active blur ${active === 1 ? 'sheet' : 'sheets'}`
  if (code) {
    code.textContent = enhanced
      ? '4 spans → all five sheets active'
      : count === 0
        ? '0 spans → generated sheet only'
        : `${count} spans → incomplete layers hidden`
  }
}

async function copyMarkup(button) {
  const code = document.querySelector('[data-markup-code]')?.textContent ?? ''
  try {
    await navigator.clipboard.writeText(code)
    button.textContent = 'Copied'
  } catch {
    button.textContent = 'Select code'
  }
  window.setTimeout(() => {
    button.textContent = 'Copy'
  }, 1400)
}

function bindControls() {
  for (const button of document.querySelectorAll('[data-control]')) {
    button.addEventListener('click', () => {
      const { control, value } = button.dataset
      if (control === 'scenario') updateScenario(value)
      else if (control === 'preset') updatePreset(value)
      else if (control === 'size') updateSize(value)
      else if (control === 'surface') updateSurface(value)
      else if (control === 'direction') updateDirection(value)
    })
  }

  const slider = document.querySelector('[data-scroll-slider]')
  slider?.addEventListener('input', () => setScrollProgress(slider.value))

  for (const button of document.querySelectorAll('[data-scroll-jump]')) {
    button.addEventListener('click', () => setScrollProgress(button.dataset.scrollJump))
  }

  for (const scrollport of syncScrollports) {
    scrollport.addEventListener('scroll', () => syncFrom(scrollport), { passive: true })
  }

  document.querySelector('[data-guide-toggle]')?.addEventListener('change', (event) => {
    root.dataset.guides = String(event.currentTarget.checked)
  })

  for (const button of document.querySelectorAll('[data-structure-count]')) {
    button.addEventListener('click', () => updateStructureCount(Number(button.dataset.structureCount)))
  }

  document.querySelector('[data-copy-markup]')?.addEventListener('click', (event) => {
    copyMarkup(event.currentTarget)
  })

  document.querySelector('[data-edge-action]')?.addEventListener('click', () => {
    edgeClicks += 1
    document.querySelector('[data-click-readout]').value = `${edgeClicks} edge ${edgeClicks === 1 ? 'click' : 'clicks'}`
  })

  window.addEventListener('resize', () => {
    setScrollProgress(scrollProgress)
    updateGuides()
  }, { passive: true })
}

function readState() {
  return {
    scenario: root.dataset.scenario,
    preset: root.dataset.preset,
    size: root.dataset.size,
    surface: root.dataset.surface,
    direction: root.dataset.direction,
    progress: scrollProgress,
    supported: supportsBlur(),
    layerCounts: Object.fromEntries(
      ['baseline', 'single', 'progressive', 'blur-only'].map((variant) => [
        variant,
        countActiveBlurSheets(document.querySelector(`[data-variant="${variant}"]`)),
      ]),
    ),
  }
}

cloneSignalContent()
bindControls()
setSupportStatus()
updateScenario(root.dataset.scenario)
updatePreset(root.dataset.preset)
updateSize(root.dataset.size)
updateSurface(root.dataset.surface)
updateDirection(root.dataset.direction)
updateStructureCount(3)

requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    setScrollProgress(50)
    updateLayerCounts()
  })
})

window.__blurLab = {
  readState,
  setScrollProgress,
  updateScenario,
  updatePreset,
  updateSize,
  updateSurface,
  updateDirection,
  updateStructureCount,
}
