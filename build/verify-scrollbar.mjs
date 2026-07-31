/**
 * verify-scrollbar.mjs — pixel-level regression for `fade-scrollbar-safe-y`.
 *
 * The mask on a scroll container also masks that container's scrollbar: masking
 * applies after the element and its descendants are drawn to one temporary
 * canvas, and a "visible scrolling mechanism" is part of that canvas. Overlay
 * scrollbars are composited separately and escape, which is why the bug is
 * invisible on a Mac and obvious on Windows.
 *
 * `fade-scrollbar-safe-y` unions an opaque strip over the scrollbar's column. The
 * strip's width cannot be derived — the reserved gutter is inside the mask's
 * reference boxes by spec — so the utility PINS the bar via ::-webkit-scrollbar
 * and sizes the strip from the same custom property. Bar and strip are then
 * equal by construction.
 *
 * The failure this file exists to catch is the strip MISSING the gutter. A strip
 * wider than the gutter is not a cosmetic slip: it restores content to full
 * opacity with a hard vertical seam, inverting the plugin's whole purpose at the
 * exact edge it exists to soften. CSS-text assertions cannot see that; only
 * pixels can. Covered:
 *
 *   1. the pin holds — the used gutter equals the declared bar width exactly
 *   2. the scrollbar column is fully opaque while content beside it still fades
 *   3. base fades are untouched — a 0px strip contributes nothing, byte for byte
 *   4. no opaque column appears anywhere the gutter is 0 (the notch regression)
 *   5. the pin survives page zoom, where a NATIVE bar's CSS-px width drifts as
 *      1/zoom but two author-declared lengths scale together
 *   6. a unitless --tw-fade-scrollbar degrades to inert instead of invalidating
 *      mask-size and unioning an opaque layer over the entire element
 *   7. the strip follows the gutter through a border, because it is anchored to
 *      the padding box rather than the border box
 *   8. the axis suffix is the SCROLL axis: -y shields the vertical bar, -x the
 *      horizontal one, -xy both — and naming the axis is what keeps an x-only
 *      scroller from notching, since -x reserves no inline gutter
 *   9. the fade survives with @property stripped out, so the strips never make
 *      a registered property load-bearing for the whole plugin
 *  10. the entire opt-in -- pin included -- stands down on an engine without
 *      scroll gating, where the static fallback would otherwise pin fades on
 *      regardless of overflow and drop the strip onto content
 *  11. WebKit's non-overflowing residual is still exactly as documented, and
 *      overflow-y: scroll still closes it
 *  12. negative direct, theme-token, and arbitrary-utility widths clamp to 0px
 *      in both Chromium and WebKit, leaving mask-size valid and the fade intact
 *
 * Usage: node build/verify-scrollbar.mjs [path-to-css]   (defaults to dist)
 */
import { chromium, webkit } from 'playwright'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const cssPath = process.argv[2] || path.resolve(__dirname, '../dist/tw-fade.css')
const css = fs.readFileSync(cssPath, 'utf8')

const PIN = 15 // the utility's default declared bar width

/*
Headed on purpose. Headless Chromium RESERVES a scrollbar gutter but never
PAINTS the bar, so every pixel sampled in that column is content showing through
an unpainted track. A headless run of this file passes while asserting nothing
about a scrollbar — which is exactly the false green this file exists to avoid.

Worse on the block axis: headless reserves nothing at all for a horizontal
custom bar (measured offsetHeight - clientHeight === 0 on a container whose
vertical bar correctly takes 15px), so the -x assertions would not merely sample
the wrong pixels, they would have no row to sample.
*/
const HEADED = { headless: false }

/*
The bar is given loud, known colours so an assertion can say "the SCROLLBAR is
unfaded" instead of the much weaker "these pixels are opaque". Content is white
and the page is blue, so content bleeding into the gutter is equally legible.
`.bar` pins a classic bar WITHOUT the utility, giving a like-for-like control:
the only difference between control and subject is the shield itself.
*/
const TRACK = [0, 255, 0]
const HARNESS = `
  * { margin: 0; box-sizing: border-box; }
  html { font-size: 16px; }
  body { background: #00f; }
  .panel { width: 220px; height: 180px; overflow: auto; background: transparent; }
  .plane { width: 700px; height: 700px; background: #fff; }
  .bar::-webkit-scrollbar { width: ${PIN}px; height: ${PIN}px; }
  .panel::-webkit-scrollbar-track { background: rgb(${TRACK.join(' ')}); }
  .panel::-webkit-scrollbar-thumb { background: #f0f; }
`

const failures = []
const notes = []
const check = (ok, label, detail) => {
  if (ok) console.log(`  ok   ${label}`)
  else {
    console.log(`  FAIL ${label}\n       ${detail}`)
    failures.push(label)
  }
}

const browser = await chromium.launch(HEADED)

/**
 * Render `body`, scroll every panel to its midpoint so leading and trailing
 * fades are both active, then return per-panel geometry plus a luminance profile
 * of the last `n` px of a horizontal line `yOff` into the top fade band.
 *
 * Sampling inside the fade band is what makes the strip legible: out in the
 * un-faded middle of the panel, content and strip are both opaque and a misfire
 * is invisible.
 */
async function sample({
  body,
  ids,
  yOff = 6,
  n = 24,
  zoom = 1,
  xOff = 6,
  m = 24,
  layout = '',
  extraCss = '',
  browserInstance = browser,
}) {
  // `layout` exists so a section that samples near a panel's BLOCK END can lay
  // the panels out in a row. Stacked, the third panel falls below the 400px
  // viewport and getImageData returns zeros — which read as "not content" and
  // pass vacuously. Same false-green shape as running this file headless.
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${HARNESS}${css}${extraCss}${layout}</style></head><body>${body}</body></html>`
  const page = await browserInstance.newPage({ viewport: { width: 1000, height: 400 }, deviceScaleFactor: 1 })
  await page.setContent(html, { waitUntil: 'load' })
  if (zoom !== 1) await page.evaluate((z) => { document.documentElement.style.zoom = String(z) }, zoom)
  await page.evaluate(async (list) => {
    for (const id of list) {
      const el = document.getElementById(id)
      if (!el) continue
      el.scrollTop = (el.scrollHeight - el.clientHeight) / 2
      el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2
    }
    await new Promise((r) => setTimeout(r, 120))
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  }, ids)

  const geo = await page.evaluate((list) => {
    const o = {}
    for (const id of list) {
      const el = document.getElementById(id)
      if (!el) continue
      const r = el.getBoundingClientRect()
      // offsetWidth/clientWidth are integers, which under page zoom rounds a
      // fractional gutter by up to a full CSS px. Measure the scrollport from a
      // width:100% child instead, whose rect is fractional.
      const probe = el.querySelector('[data-probe]')
      const zoomFactor = parseFloat(document.documentElement.style.zoom || '1')
      const exact = probe ? (r.width - probe.getBoundingClientRect().width) / zoomFactor : null
      const style = getComputedStyle(el)
      const scrollbarStyle = getComputedStyle(el, '::-webkit-scrollbar')
      o[id] = {
        x: r.x, y: r.y, w: r.width, h: r.height,
        gutter: Math.round((el.offsetWidth - el.clientWidth) * 1000) / 1000,
        exactGutter: exact === null ? null : Math.round(exact * 1000) / 1000,
        maskSize: style.maskSize,
        scrollbarGutter: style.scrollbarGutter,
        scrollbarWidth: scrollbarStyle.width,
        scrollbarHeight: scrollbarStyle.height,
        scrollbarStrip: style.getPropertyValue('--tw-fade-scrollbar').trim(),
      }
    }
    return o
  }, ids)

  const shot = await page.screenshot({ type: 'png' })
  const prof = await page.evaluate(
    async ([b64, g, list, yo, count, xo, mCount]) => {
      const img = new Image()
      img.src = 'data:image/png;base64,' + b64
      await img.decode()
      const cv = document.createElement('canvas')
      cv.width = img.width
      cv.height = img.height
      const ctx = cv.getContext('2d')
      ctx.drawImage(img, 0, 0)
      const rgb = (x, y) => {
        const d = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data
        return [d[0], d[1], d[2]]
      }
      const o = {}
      for (const id of list) {
        if (!g[id]) continue
        const row = []
        for (let i = count - 1; i >= 0; i--) row.push(rgb(g[id].x + g[id].w - 1 - i, g[id].y + yo))
        // ...and a vertical column running up from the block end, for the
        // horizontal bar. Taken near the inline start so it never crosses the
        // vertical bar's column or the scrollbar corner.
        const col = []
        for (let i = mCount - 1; i >= 0; i--) col.push(rgb(g[id].x + xo, g[id].y + g[id].h - 1 - i))
        const center = rgb(g[id].x + g[id].w / 2, g[id].y + yo)
        o[id] = { row, col, center }
      }
      return o
    },
    [shot.toString('base64'), geo, ids, yOff, n, xOff, m],
  )
  await page.close()
  return {
    geo,
    prof: mapVals(prof, (v) => v.row),
    col: mapVals(prof, (v) => v.col),
    center: mapVals(prof, (v) => v.center),
  }
}

const mapVals = (o, f) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, f(v)]))

const panel = (id, cls, extra = '') =>
  `<div class="panel ${cls}" id="${id}" style="${extra}">` +
  `<div data-probe style="width:100%;height:0"></div><div class="plane"></div></div>`

// Distance from the known track colour: 0 = the bar is painted at full strength,
// large = the bar has been faded toward the page behind it.
const trackDelta = (px) =>
  Math.max(Math.abs(px[0] - TRACK[0]), Math.abs(px[1] - TRACK[1]), Math.abs(px[2] - TRACK[2]))
const isContent = (px) => px[0] > 200 && px[1] > 200 && px[2] > 200
const fmt = (row) => row.map((p) => p.join(',')).join('  ')

/*
Tailwind accepts -5px as an arbitrary [length], so the runtime must sanitize it
rather than relying on the compiler or @property to reject it. The unit test
proves Tailwind emits this exact setter; the verifier repeats it here because the
framework-free dist intentionally excludes arbitrary utilities.
*/
const NEGATIVE_ARBITRARY_CSS =
  '.fade-scrollbar-width-\\[-5px\\] { --tw-fade-scrollbar-width: -5px; }'

async function verifyNegativeWidths(browserInstance, engine) {
  const cases = [
    ['negative-direct', 'direct --tw-fade-scrollbar-width'],
    ['negative-theme', 'negative --fade-scrollbar-width-md theme token'],
    ['negative-arbitrary', 'negative arbitrary width utility'],
  ]
  const common = 'fade-y fade-always-y fade-scrollbar-safe-y'
  const { geo, center } = await sample({
    body:
      panel('zero', common, '--tw-fade-scrollbar-width:0px') +
      panel('negative-direct', common, '--tw-fade-scrollbar-width:-5px') +
      panel('negative-theme', `${common} fade-scrollbar-width-md`, '--fade-scrollbar-width-md:-5px') +
      panel('negative-arbitrary', `${common} fade-scrollbar-width-[-5px]`),
    ids: ['zero', ...cases.map(([id]) => id)],
    layout: 'body { display: flex; }',
    extraCss: NEGATIVE_ARBITRARY_CSS,
    browserInstance,
  })

  // White content over a blue page: the center pixel's red channel is the
  // rendered mask alpha, sampled well away from the scrollbar.
  // Assert the baseline is genuinely faded before comparing the negative cases
  // to it, or an all-opaque false green would pass every equality below.
  const baseline = center.zero[0]
  check(
    baseline < 160,
    `${engine}: the zero-width control still renders the fade`,
    `control center pixel was ${baseline}/255 red — the control is opaque, so comparisons prove nothing`,
  )

  for (const [id, label] of cases) {
    check(
      geo[id].scrollbarStrip === '0px' && geo[id].gutter === 0,
      `${engine}: ${label} clamps bar and strip to 0px`,
      `strip computed to "${geo[id].scrollbarStrip}" and gutter to ${geo[id].gutter}px`,
    )
    check(
      !geo[id].maskSize.includes('auto'),
      `${engine}: ${label} leaves the six-layer mask-size valid`,
      `mask-size computed to "${geo[id].maskSize}" — one negative component invalidated every layer`,
    )
    const rendered = center[id][0]
    check(
      Math.abs(rendered - baseline) <= 4,
      `${engine}: ${label} leaves the fade intact`,
      `center pixel was ${rendered}/255 red vs the ${baseline}/255 zero-width control`,
    )
  }
}

/* ------------------------------------------------------------------ *
 * 1 + 2. The pin holds, and the bar itself survives the fade.
 *
 * `bare` has an identical pinned bar but no shield, so it reproduces the bug
 * and proves the assertion below can fail.
 * ------------------------------------------------------------------ */
console.log('\nthe pin, and what it shields')
{
  const { geo, prof } = await sample({
    body:
      panel('bare', 'bar fade-y fade-always-y') +
      panel('safe', 'fade-y fade-always-y fade-scrollbar-safe-y'),
    ids: ['bare', 'safe'],
  })

  check(
    geo.safe.gutter === PIN,
    `the declared bar width is the used gutter (${PIN}px)`,
    `gutter measured ${geo.safe.gutter}px — ::-webkit-scrollbar was cancelled, or the pin did not apply`,
  )

  // Sample the middle of the track column, deep inside the top fade band.
  const at = (row) => row[row.length - Math.ceil(PIN / 2)]
  const safeDelta = trackDelta(at(prof.safe))
  const bareDelta = trackDelta(at(prof.bare))

  check(
    bareDelta > 40,
    'the control reproduces the bug (an unshielded bar fades)',
    `unshielded bar was only ${bareDelta} from full strength — the control is not exercising the bug, ` +
      `so the next assertion proves nothing`,
  )
  check(
    safeDelta <= 8,
    'the shielded scrollbar keeps its colour through the fade band',
    `shielded bar was ${safeDelta} away from the track colour (want <= 8): ${at(prof.safe).join(',')}`,
  )
  // Just inside the strip, content must still be dissolving toward the page. If
  // the strip overhangs the gutter it restores content to pure white instead.
  const inside = prof.safe[prof.safe.length - PIN - 1]
  check(
    !isContent(inside),
    'content immediately inside the strip is still faded',
    `the pixel inside the strip is un-faded content (${inside.join(',')}) — the strip overhangs the gutter`,
  )
  notes.push(`  bare (bug):  ${fmt(prof.bare.slice(-14))}`)
  notes.push(`  safe (fix):  ${fmt(prof.safe.slice(-14))}`)
}

/* ------------------------------------------------------------------ *
 * 2b. The inline-end ramp completes ON THE CONTENT EDGE.
 *
 * Second symptom of the same root cause: mask percentages resolve against the
 * border box, so a right-edge ramp authored to reach zero at 100% reaches zero
 * inside the gutter and never finishes over visible content. `bar` is the
 * control — same pinned bar, no utility — and shows the truncation.
 * ------------------------------------------------------------------ */
console.log('\nthe inline-end ramp')
{
  const { geo, prof } = await sample({
    body:
      panel('trunc', 'bar fade-x fade-always-x') +
      panel('full', 'fade-x fade-always-x fade-scrollbar-safe-y'),
    ids: ['trunc', 'full'],
    yOff: 90, // mid-height, clear of the vertical fade bands
    n: 24,
  })
  // Content is white on a blue page, so the red channel reads as the alpha the
  // fade left behind. The last content pixel sits `gutter` columns in from the
  // border-box edge.
  const lastContent = (id) => prof[id][prof[id].length - 1 - geo[id].gutter][0]
  check(
    lastContent('trunc') > 25,
    'the control reproduces the truncated ramp',
    `control faded to ${lastContent('trunc')}/255 at the content edge — nothing left to fix`,
  )
  check(
    lastContent('full') <= 12,
    'the ramp reaches transparent at the content edge under the utility',
    `still ${lastContent('full')}/255 opaque at the last content pixel (want <= 12) — ` +
      `the inline-end layer is not inset by the gutter`,
  )
  notes.push(`  ramp at last content px:  without utility ${lastContent('trunc')}/255, with utility ${lastContent('full')}/255`)
}

/* ------------------------------------------------------------------ *
 * 3. Base fades are untouched by the two always-present strip layers.
 *
 * Both strips sit on every masked element, so their inert default is what keeps
 * the plugin's normal rendering byte-identical. The block strip is listed first
 * (100% x 0px), then the inline strip (0px x 100%); a zero extent in either
 * axis covers nothing, so `add` contributes nothing.
 * ------------------------------------------------------------------ */
console.log('\nthe inert strips')
{
  const { geo, prof } = await sample({
    body: panel('a', 'fade') + panel('b', 'fade-y') + panel('c', 'fade-x') + panel('d', 'fade-top'),
    ids: ['a', 'b', 'c', 'd'],
  })
  for (const id of ['a', 'b', 'c', 'd']) {
    check(
      geo[id].maskSize.startsWith('100% 0px, 0px 100%'),
      `${id}: both strips are 0px without the utility`,
      `mask-size was ${geo[id].maskSize}`,
    )
  }
  for (const id of ['a', 'b', 'c']) {
    const edge = prof[id][prof[id].length - 1]
    check(
      !isContent(edge),
      `${id}: no un-faded column at the inline end without the utility`,
      `trailing pixel is un-faded content (${edge.join(',')}) — the inert strip is painting`,
    )
  }
}

/* ------------------------------------------------------------------ *
 * 4. The notch regression: no strip may appear where no gutter exists.
 *
 * `scrollbar-gutter: stable` reserves only where a scrollbar can appear. An
 * x-only scroller (overflow-y: hidden) is the adversarial case — if the gutter
 * is 0 there, a strip would sit on content.
 * ------------------------------------------------------------------ */
console.log('\nthe strip never restores content')
{
  const { geo, prof } = await sample({
    body:
      panel('xonly', 'fade-x fade-always-x fade-scrollbar-safe-y', 'overflow-y:hidden;overflow-x:auto') +
      panel('bothaxes', 'fade fade-always fade-scrollbar-safe-y', 'overflow:auto') +
      panel('yonly', 'fade-y fade-always-y fade-scrollbar-safe-y', 'overflow-y:auto;overflow-x:hidden') +
      panel('scrollprop', 'fade-y fade-always-y fade-scrollbar-safe-y', 'overflow:scroll'),
    ids: ['xonly', 'bothaxes', 'yonly', 'scrollprop'],
  })
  const restored = (id) => prof[id].slice(-PIN).filter(isContent).length

  for (const id of ['bothaxes', 'yonly', 'scrollprop']) {
    // The invariant wherever a vertical bar is actually painted: the shield may
    // reveal the scrollbar, but it must NEVER hand back un-faded content. That
    // is the notch, and it is the one outcome worse than the bug it fixes.
    check(
      restored(id) === 0,
      `${id} (gutter ${geo[id].gutter}px): no un-faded content in the strip`,
      `${restored(id)} of ${PIN} columns are un-faded content — this is the notch: ${fmt(prof[id].slice(-PIN))}`,
    )
  }

  /*
  Characterisation of the WRONG CLASS, not a defect. With `overflow-y: hidden`
  Chromium still RESERVES the inline-end gutter for `scrollbar-gutter: stable`
  but never paints a bar into it — and content is clipped to the padding box,
  which per CSS Overflow 3 counts that reserved space as padding. So content
  paints beneath an empty gutter and the inline shield restores it. This is what
  -y does on a container that has no vertical bar; the fix is to name the axis
  you actually scroll. Asserted so it stays a known quantity — if an engine ever
  stops reserving here, this flips and the docs should follow.
  */
  check(
    restored('xonly') > 0,
    'the -y class still notches an x-only scroller (wrong class, documented)',
    'x-only no longer notches under -y — an engine changed behaviour; update README',
  )
}

/* ------------------------------------------------------------------ *
 * 4b. Naming the axis is what removes the notch.
 *
 * This is the whole reason the API is per-axis rather than one class plus an
 * add-on. -x asserts "my bar is the horizontal one": no inline strip, and no
 * scrollbar-gutter either, since that property only reserves on the inline axis
 * and would be reserving for a vertical bar the author just said is absent. The
 * same container that notches under -y must come out clean under -x.
 * ------------------------------------------------------------------ */
console.log('\nnaming the axis removes the notch')
{
  const { geo, prof } = await sample({
    body:
      panel('nx', 'fade-x fade-always-x fade-scrollbar-safe-x', 'overflow-y:hidden;overflow-x:auto') +
      panel('ny', 'fade-x fade-always-x fade-scrollbar-safe-y', 'overflow-y:hidden;overflow-x:auto'),
    ids: ['nx', 'ny'],
  })
  const restored = (id) => prof[id].slice(-PIN).filter(isContent).length

  check(
    restored('nx') === 0,
    'an x-only scroller under -x restores no content',
    `${restored('nx')} of ${PIN} columns came back as un-faded content: ${fmt(prof.nx.slice(-PIN))}`,
  )
  check(
    geo.nx.gutter === 0,
    '-x reserves no inline gutter (that axis has no bar to reserve for)',
    `the inline gutter measured ${geo.nx.gutter}px — is -x setting scrollbar-gutter?`,
  )
  // The comparison is the point: same markup, same container, different class.
  check(
    restored('ny') > 0 && restored('nx') === 0,
    'the axis suffix is what makes the difference, not the container',
    `-y restored ${restored('ny')} columns and -x restored ${restored('nx')} — expected the first to notch ` +
      `and the second not to; if both are clean the per-axis split has stopped earning its keep`,
  )
}

/* ------------------------------------------------------------------ *
 * 5. Zoom. A native bar holds constant physical size, so its CSS-px width goes
 *    as 1/zoom; a declared one does not. The strip is a declared length, so only
 *    a declared bar stays aligned with it.
 * ------------------------------------------------------------------ */
console.log('\nzoom invariance')
for (const zoom of [0.75, 1.25, 1.5, 2]) {
  // The profile is in DEVICE px while PIN is CSS px, so the sampling window has
  // to be sized for the zoomed bar. A fixed window silently truncates the run
  // below and reads as "a faded sliver remains" — a phantom failure that only
  // appears once PIN * zoom exceeds it.
  const band = Math.ceil(PIN * zoom)
  const { geo, prof } = await sample({
    body: panel('z', 'fade-y fade-always-y fade-scrollbar-safe-y'),
    ids: ['z'],
    zoom,
    n: band + 10,
  })
  // The bar is snapped to whole device pixels while the strip is an exact CSS
  // length, so they can disagree by a sub-pixel at fractional zooms. Tolerate
  // less than one CSS px of drift; anything more is a visible seam.
  const drift = Math.abs(geo.z.exactGutter - PIN)
  check(
    drift < 1,
    `zoom ${zoom}x: gutter holds ${PIN}px (measured ${geo.z.exactGutter}px)`,
    `drifted ${drift.toFixed(3)}px — strip and bar no longer agree`,
  )
  // What actually matters: the bar keeps its colour, and no content is restored.
  // Count the longest run of true track colour rather than one anchored to the
  // final pixel — at fractional zoom the panel edge lands off-grid, so the
  // outermost sample can fall on the page background.
  const trackRun = (() => {
    let best = 0
    let n = 0
    for (const px of prof.z) {
      n = trackDelta(px) <= 8 ? n + 1 : 0
      if (n > best) best = n
    }
    return best
  })()
  check(
    trackRun >= Math.floor(PIN * zoom) - 2,
    `zoom ${zoom}x: the bar stays unfaded across its full width (${trackRun} device px)`,
    `only ${trackRun} device px held the track colour, expected about ${Math.round(PIN * zoom)} — ` +
      `a faded sliver remains over the bar`,
  )
  // A nominal 15px strip can land one device pixel wider than the rasterized
  // bar (for example, 18.75px rounds to an 18px gutter at 1.25x). Permit that
  // single boundary pixel; two would be a real opaque slab over content.
  const restored = prof.z.slice(-band).filter(isContent).length
  check(
    restored <= 1,
    `zoom ${zoom}x: strip overhang stays within one rounded boundary pixel`,
    `${restored} content pixels were restored at this zoom: ${fmt(prof.z.slice(-band))}`,
  )
}

/* ------------------------------------------------------------------ *
 * 5b. An author-chosen width must move the BAR and the STRIP together.
 *
 * This is the one failure the pin exists to make impossible, and it is easy to
 * reintroduce: the strip is read from the element, where any declaration is
 * visible, but the bar is pinned from ::-webkit-scrollbar — a pseudo-element,
 * which only sees a custom property by INHERITING it. Registered with
 * inherits:false the pin silently used the initial value while the strip used
 * the author's, so declaring 24px gave a 15px bar under a 24px strip: a 9px
 * opaque slab over content. Asserting the gutter alone would not catch it
 * either — the gutter follows the bar, so the slab is only visible in pixels.
 * ------------------------------------------------------------------ */
console.log('\nan author-chosen width moves bar and strip together')
for (const width of [7, 18, 24]) {
  const { geo, prof } = await sample({
    body: panel('w', 'fade-y fade-always-y fade-scrollbar-safe-y', `--tw-fade-scrollbar-width:${width}px`),
    ids: ['w'],
    n: 34,
  })
  check(
    geo.w.gutter === width,
    `--tw-fade-scrollbar-width: ${width}px pins the bar to ${width}px`,
    `the gutter measured ${geo.w.gutter}px — the declared width is not reaching ::-webkit-scrollbar ` +
      `(is --tw-fade-scrollbar-width registered with inherits:false?)`,
  )
  // The decisive check: no fully-opaque content anywhere in the shielded band.
  // A strip wider than the bar shows up here and nowhere else.
  check(
    prof.w.slice(-width).filter(isContent).length === 0,
    `${width}px: the strip covers the bar exactly, with no slab over content`,
    `the strip overhangs the bar by ${prof.w.slice(-width).filter(isContent).length}px: ${fmt(prof.w.slice(-width))}`,
  )
  const barRun = prof.w.slice(-width).filter((px) => trackDelta(px) <= 8).length
  check(
    barRun >= width - 1,
    `${width}px: the whole bar stays unfaded`,
    `only ${barRun} of ${width}px held the track colour — the strip is narrower than the bar`,
  )
}

/* ------------------------------------------------------------------ *
 * 5c. The public utility, on the element and on an ancestor.
 *
 * 5b declares the custom property directly; this asserts the shipped API reaches
 * the same place. The ancestor case is the reason the property inherits at all —
 * one declaration high up should set a house style for every opted-in scroller
 * below it. And the setter must stay INERT on its own: it is applied to page
 * wrappers, and a setter that also enabled would pin their bars or paint a
 * strip. Native classic scrollbars may still consume space on their own.
 * ------------------------------------------------------------------ */
console.log('\nthe fade-scrollbar-width-* utility')
{
  const { geo } = await sample({
    body:
      panel('onself', 'fade-y fade-always-y fade-scrollbar-safe-y fade-scrollbar-width-lg') +
      `<div class="fade-scrollbar-width-sm">${panel('inherited', 'fade-y fade-always-y fade-scrollbar-safe-y')}</div>` +
      panel('setteronly', 'fade-y fade-always-y fade-scrollbar-width-lg'),
    ids: ['onself', 'inherited', 'setteronly'],
  })
  check(
    geo.onself.gutter === 17,
    'fade-scrollbar-width-lg pins the bar to its token value (17px)',
    `the gutter measured ${geo.onself.gutter}px — the token or the utility is not resolving`,
  )
  check(
    geo.inherited.gutter === 11,
    'the width set on an ancestor reaches the scroller below it (11px)',
    `the gutter measured ${geo.inherited.gutter}px, not the ancestor's 11px — is the property still inherits:true?`,
  )
  check(
    geo.setteronly.scrollbarWidth === 'auto' &&
      geo.setteronly.scrollbarHeight === 'auto' &&
      geo.setteronly.scrollbarGutter === 'auto' &&
      geo.setteronly.scrollbarStrip === '0px' &&
      geo.setteronly.maskSize.startsWith('100% 0px, 0px 100%'),
    'the setter alone turns nothing on — no author pin, stable gutter, or strip',
    `native gutter ${geo.setteronly.gutter}px, ` +
      `::-webkit-scrollbar ${geo.setteronly.scrollbarWidth} × ${geo.setteronly.scrollbarHeight}, ` +
      `scrollbar-gutter ${geo.setteronly.scrollbarGutter}, strip ${geo.setteronly.scrollbarStrip}, ` +
      `mask-size ${geo.setteronly.maskSize}`,
  )
}

/* ------------------------------------------------------------------ *
 * 6. A bad value must degrade to inert, not invalidate mask-size.
 *
 * mask-size is one declaration: a single component that fails to parse makes
 * ALL layers fall back to `auto`, which on a gradient is the full positioning
 * area — an opaque layer over the whole element, with the fade silently gone.
 * The typed @property registration is what prevents this.
 * ------------------------------------------------------------------ */
console.log('\nbad values degrade to inert')
{
  const { geo, prof } = await sample({
    body:
      panel('ok', 'fade-y fade-always-y') +
      panel('unitless', 'fade-y fade-always-y', '--tw-fade-scrollbar:11') +
      panel('garbage', 'fade-y fade-always-y', '--tw-fade-scrollbar:banana'),
    ids: ['ok', 'unitless', 'garbage'],
  })
  for (const id of ['unitless', 'garbage']) {
    check(
      !geo[id].maskSize.includes('auto'),
      `--tw-fade-scrollbar: ${id === 'unitless' ? '11' : 'banana'} does not invalidate mask-size`,
      `mask-size computed to "${geo[id].maskSize}" — the fade is disabled entirely`,
    )
    const lum = (row) =>
      Math.round(row.reduce((a, p) => a + 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2], 0) / row.length)
    const mean = lum(prof[id])
    const okMean = lum(prof.ok)
    check(
      Math.abs(mean - okMean) < 25,
      `--tw-fade-scrollbar: ${id === 'unitless' ? '11' : 'banana'} renders as the unshielded fade`,
      `mean luminance ${mean} vs baseline ${okMean}`,
    )
  }
}

/* ------------------------------------------------------------------ *
 * 7. Borders. The strip is anchored to the PADDING box, not the border box.
 *
 * The gutter lies between the padding and border edges, so a border-box-anchored
 * strip is displaced outward by the border width and straddles it — shielding
 * the border (which never needed it) while leaving that many pixels of actual
 * scrollbar still faded. Padding-box is exactly right because CSS Overflow 3
 * §5.1 folds the reserved gutter into the padding area for painting, making the
 * padding box's inline-end edge the gutter's outer edge.
 * ------------------------------------------------------------------ */
console.log('\nthe strip tracks the gutter through a border')
{
  const BORDER = 6
  const { geo, prof } = await sample({
    body: panel('bordered', 'fade-y fade-always-y fade-scrollbar-safe-y', `border-right:${BORDER}px solid #ff0`),
    ids: ['bordered'],
  })

  check(
    geo.bordered.gutter === PIN + BORDER,
    `border + bar occupy ${PIN + BORDER}px`,
    `measured ${geo.bordered.gutter}px — the harness is not exercising a bordered scroller`,
  )

  // Walk inward past the border; every pixel of track must be at full strength.
  const row = prof.bordered
  const track = row.slice(row.length - BORDER - PIN, row.length - BORDER)
  const worst = Math.max(...track.map(trackDelta))
  check(
    worst <= 8,
    `all ${PIN}px of track stay unfaded behind a ${BORDER}px border`,
    `worst track pixel was ${worst} from full strength — the strip is anchored to the border box, ` +
      `so it covers the border and misses the innermost ${BORDER}px of the bar. Track sampled: ${fmt(track)}`,
  )
}

/* ------------------------------------------------------------------ *
 * 8. The block axis is opt-in, and works when opted into.
 *
 * The pin makes the horizontal bar classic too — the custom-scrollbar opt-in is
 * per-element, not per-axis — so a container that scrolls both ways gets a
 * manufactured horizontal bar that the block-end fade would otherwise erase.
 * fade-scrollbar-safe-xy shields it. It cannot be the default: the block
 * gutter is only reserved when content actually overflows horizontally, so a
 * blind block strip would slab over content on every vertical-only scroller.
 * ------------------------------------------------------------------ */
console.log('\nthe block-axis strip')
{
  const { geo, col } = await sample({
    body:
      panel('hbare', 'fade fade-always fade-scrollbar-safe-y') +
      panel('hboth', 'fade fade-always fade-scrollbar-safe-xy') +
      panel('honly', 'fade fade-always fade-scrollbar-safe-x') +
      panel('vonly', 'fade fade-always fade-scrollbar-safe-xy', 'overflow-x:hidden'),
    ids: ['hbare', 'hboth', 'honly', 'vonly'],
    layout: 'body { display: flex; }',
  })

  const at = (c) => c[c.length - Math.ceil(PIN / 2)]
  check(
    trackDelta(at(col.hbare)) > 40,
    '-y alone leaves the manufactured horizontal bar faded',
    `it measured ${trackDelta(at(col.hbare))} from full strength — if the block-end bar is already ` +
      `protected, the -x axis has nothing to do and should be removed`,
  )
  check(
    trackDelta(at(col.hboth)) <= 8,
    '-xy shields the horizontal bar',
    `block-end bar was ${trackDelta(at(col.hboth))} from full strength. Column sampled: ${fmt(col.hboth)}`,
  )
  // -x on a two-axis scroller: the horizontal bar is shielded and the vertical
  // one is deliberately left alone. Proves the axes are genuinely independent
  // rather than -x being a synonym for -xy.
  check(
    trackDelta(at(col.honly)) <= 8,
    '-x shields the horizontal bar without opting into the inline axis',
    `block-end bar was ${trackDelta(at(col.honly))} from full strength: ${fmt(col.honly)}`,
  )
  // Measured via the PROPERTY, not the gutter: on a scroller that really does
  // overflow vertically the bar is present and occupies 15px whatever
  // scrollbar-gutter says, so a gutter measurement here proves nothing.
  check(
    geo.honly.scrollbarGutter === 'auto' && geo.hboth.scrollbarGutter === 'stable',
    '-x does not stabilize an inline gutter; -xy does',
    `-x computed scrollbar-gutter:${geo.honly.scrollbarGutter}, -xy computed ${geo.hboth.scrollbarGutter}`,
  )

  // And the cost of opting in wrongly, stated as a test so it stays honest: with
  // no horizontal overflow there is no block gutter, so the strip lands on
  // content. This is the reason it is not the default.
  check(
    geo.vonly.maskSize.startsWith(`100% ${PIN}px`) && col.vonly.some(isContent),
    'opting in without horizontal overflow slabs content (documented cost)',
    `expected the block strip to sit on content when there is no bar to shield; ` +
      `mask-size was ${geo.vonly.maskSize}`,
  )
}

/* ------------------------------------------------------------------ *
 * 9. The strips must not make @property load-bearing for the WHOLE plugin.
 *
 * mask-size references --tw-fade-scrollbar, but that property is only ever
 * DECLARED inside @supports selector(::-webkit-scrollbar). On every other engine
 * its value comes solely from the @property initial-value. Without @property
 * support the reference is a guaranteed-invalid value, which makes the entire
 * mask-size declaration invalid at computed-value time -> all six layers fall
 * back to `auto` -> the two 0px strips become full-size opaque layers -> `add`
 * paints over everything and the fade silently VANISHES.
 *
 * That is a total, silent loss of the plugin's only feature on Safari 15.4-16.3
 * and Firefox < 128, which 0.7.1 rendered fine. Every var() in a load-bearing
 * declaration therefore carries an explicit fallback, and this proves it: strip
 * the @property blocks out of the shipped CSS and the fade must still render.
 * Holding the engine constant isolates the mechanism instead of hunting old
 * browser builds.
 * ------------------------------------------------------------------ */
console.log('\nthe fade survives without @property')
{
  const stripped = css.replace(/@property\s+[^{]+\{[^}]*\}\s*/g, '')
  const page = await browser.newPage({ viewport: { width: 300, height: 260 }, deviceScaleFactor: 1 })
  await page.setContent(
    `<!doctype html><html><head><meta charset="utf-8"><style>${HARNESS}${stripped}</style></head>` +
      `<body>${panel('np', 'fade-y fade-always-y')}</body></html>`,
    { waitUntil: 'load' },
  )
  await page.evaluate(() => { document.getElementById('np').scrollTop = 300 })
  await page.waitForTimeout(120)
  const maskSize = await page.evaluate(() => getComputedStyle(document.getElementById('np')).maskSize)
  const shot = await page.screenshot({ type: 'png' })
  const band = await page.evaluate(async (b64) => {
    const img = new Image()
    img.src = 'data:image/png;base64,' + b64
    await img.decode()
    const cv = document.createElement('canvas')
    cv.width = img.width
    cv.height = img.height
    cv.getContext('2d').drawImage(img, 0, 0)
    const ctx = cv.getContext('2d')
    const out = []
    for (let y = 0; y < 16; y += 2) out.push(ctx.getImageData(100, y, 1, 1).data[0])
    return out
  }, shot.toString('base64'))
  await page.close()

  check(
    !maskSize.includes('auto'),
    'mask-size survives with @property removed',
    `mask-size computed to "${maskSize}" — a var() in the mask block is missing its fallback, ` +
      `so the whole declaration went invalid at computed-value time`,
  )
  check(
    band[0] < 120,
    'the fade still renders with @property removed',
    `the top of the fade band measured ${band[0]}/255 (opaque) — the fade is gone: ${band.join(' ')}`,
  )
}

/* ------------------------------------------------------------------ *
 * 10. The whole opt-in stands down when scroll gating is unavailable.
 *
 * Without animation-timeline: scroll() the plugin takes its static fallback,
 * which pins every selected fade ON regardless of overflow. A faded container
 * that is not overflowing has no reserved gutter, so the strip lands on content:
 * measured in WebKit before this gate existed, a plain `overflow-auto fade-y
 * fade-scrollbar-safe-y` whose content did not overflow faded its inline end to
 * fully transparent and then painted a hard 15px opaque band of content beyond
 * it -- on markup that never mentions fade-always.
 *
 * Dropping only the strip is not enough. The pin is what makes the bar classic,
 * so pinned-but-unshielded is worse than never opting in: it manufactures a
 * space-consuming bar on macOS and then lets the fade dim it. The entire
 * utility therefore stands down together.
 *
 * No engine reachable from here lacks scroll-driven animations, so the branch is
 * unreachable at runtime and would otherwise ship untested. Rewriting the
 * feature query in the shipped CSS makes every @supports gate on it flip at
 * once -- one substitution puts a modern engine into the old engine's branch.
 * ------------------------------------------------------------------ */
console.log('\nthe opt-in stands down without scroll gating')
{
  // Only ever appears inside @supports conditions; the real declaration uses
  // var(--tw-fade-timeline-*), so this touches nothing but the feature queries.
  const gates = (css.match(/animation-timeline: scroll\(\)/g) || []).length
  const noSda = css.replace(/animation-timeline: scroll\(\)/g, 'animation-timeline: tw-fade-no-such-timeline()')
  const page = await browser.newPage({ viewport: { width: 300, height: 260 }, deviceScaleFactor: 1 })
  await page.setContent(
    `<!doctype html><html><head><meta charset="utf-8"><style>${HARNESS}${noSda}</style></head>` +
      `<body><div class="panel fade-y fade-scrollbar-safe-y" id="sd">` +
      `<div style="width:100%;height:20px;background:#fff"></div></div></body></html>`,
    { waitUntil: 'load' },
  )
  await page.waitForTimeout(120)
  const got = await page.evaluate(() => {
    const el = document.getElementById('sd')
    const cs = getComputedStyle(el)
    return {
      gutter: el.offsetWidth - el.clientWidth,
      maskSize: cs.maskSize,
      scrollbarGutter: cs.scrollbarGutter,
      // the fallback is expected to still pin the fade on -- that is the
      // premise this gate exists to defuse, so assert it rather than assume it
      amounts: ['t', 'b', 'l', 'r'].map((k) => cs.getPropertyValue(`--tw-fade-${k}`).trim()).join('/'),
    }
  })
  await page.close()

  check(gates >= 2, 'the feature query is present to flip', `found ${gates} occurrences — the substitution is a no-op`)
  check(
    got.amounts === '1/1/1/1',
    'the static fallback still pins fades on regardless of overflow',
    `amounts were ${got.amounts} — the premise of this section no longer holds, re-derive it`,
  )
  check(
    got.scrollbarGutter === 'auto',
    'no gutter is reserved without scroll gating',
    `scrollbar-gutter computed to "${got.scrollbarGutter}" — the opt-in did not stand down`,
  )
  check(
    got.gutter === 0,
    'the bar is not pinned classic without scroll gating',
    `the container reserved ${got.gutter}px — a pinned but unshielded bar is worse than no opt-in`,
  )
  check(
    !got.maskSize.includes(`${PIN}px`),
    'no strip is declared without scroll gating',
    `mask-size computed to "${got.maskSize}" — a strip is live on an engine that cannot reserve a gutter for it`,
  )
}

console.log('\nnegative public widths clamp safely in Chromium')
await verifyNegativeWidths(browser, 'Chromium')

await browser.close()

/* ------------------------------------------------------------------ *
 * 11. WebKit: the residual, and the escape hatch that closes it.
 *
 * Blink honours scrollbar-gutter: stable for a custom bar and reserves the
 * gutter even when the content does not overflow. WebKit does not, so a
 * container that is faded but not currently overflowing has a 15px strip and no
 * gutter for it to land on. That residual cannot be fixed in CSS -- the gutter's
 * existence is not queryable -- so it is documented, and this section pins BOTH
 * halves of that documentation so neither can rot:
 *
 *   - overflow-y: scroll forces the gutter in WebKit too, which is the mitigation
 *     the README hands the reader
 *   - overflow-y: auto on a non-overflowing container does NOT, which is the
 *     limitation the README admits to
 *
 * Playwright's WebKit is a WebKit build, not Safari -- the same category of
 * error as reading Firefox behaviour off Nightly. It is the right tool for
 * pinning engine mechanics; it does not speak for a shipping Safari version.
 * ------------------------------------------------------------------ */
console.log('\nWebKit: the non-overflowing residual')
{
  const wk = await webkit.launch()
  const page = await wk.newPage({ viewport: { width: 700, height: 300 }, deviceScaleFactor: 1 })
  const shortPanel = (id, extra) =>
    `<div class="panel fade-y fade-always-y fade-scrollbar-safe-y" id="${id}" style="${extra}">` +
    `<div style="width:100%;height:20px;background:#fff"></div></div>`
  await page.setContent(
    `<!doctype html><html><head><meta charset="utf-8"><style>${HARNESS}body{display:flex;gap:20px}${css}</style></head>` +
      `<body>${shortPanel('wkauto', 'overflow:auto')}${shortPanel('wkscroll', 'overflow-y:scroll')}</body></html>`,
    { waitUntil: 'load' },
  )
  await page.waitForTimeout(150)
  const got = await page.evaluate(() => ({
    sda: CSS.supports('animation-timeline', 'scroll()'),
    auto: (() => { const e = document.getElementById('wkauto'); return e.offsetWidth - e.clientWidth })(),
    scroll: (() => { const e = document.getElementById('wkscroll'); return e.offsetWidth - e.clientWidth })(),
  }))
  await page.close()

  check(
    got.sda,
    'this WebKit build gates on scroll, so the utility is live in it',
    'WebKit reported no scroll-driven animations — section 10 covers that path, not this one',
  )
  check(
    got.auto === 0,
    'WebKit still reserves no gutter for a non-overflowing overflow-auto container',
    `it reserved ${got.auto}px — WebKit now honours scrollbar-gutter: stable for custom bars, so the ` +
      `README's Safari limitation is stale and should be relaxed`,
  )
  check(
    got.scroll === PIN,
    'overflow-y: scroll closes the residual in WebKit',
    `overflow-y: scroll reserved ${got.scroll}px, expected ${PIN} — the mitigation the README ` +
      `recommends to Safari users no longer works`,
  )

  console.log('\nnegative public widths clamp safely in WebKit')
  await verifyNegativeWidths(wk, 'WebKit')
  await wk.close()
}

if (notes.length) {
  console.log(`\nr,g,b across the last 14px, deep in the top fade band (track is ${TRACK.join(',')}):`)
  notes.forEach((n) => console.log(n))
}

if (failures.length) {
  console.error(`\nverify-scrollbar: ${failures.length} failure(s)`)
  failures.forEach((f) => console.error(`  - ${f}`))
  process.exit(1)
}
console.log('\nverify-scrollbar: all checks passed')
