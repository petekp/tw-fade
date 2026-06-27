/**
 * verify-fade.mjs — pixel-level regression: does the mask ACTUALLY render visible
 * transparency, on BOTH axes and at the correct band width?
 *
 * verify.mjs / verify-dist.mjs only read the numeric `--tw-fade-t/--tw-fade-b` amounts —
 * which were NEVER the broken part — so they stayed green straight through the
 * "only large fades" bug. This file rasters real panels in Chromium and samples
 * pixels, where the mask is baked into the bitmap. It covers:
 *
 *   1. vertical (fade-y), default size — top & bottom melt to background
 *   2. horizontal (fade-x), default size — left & right melt to background
 *   3. an overridden size (inline `--tw-fade-size`, exactly what `fade-size-[120px]`
 *      JIT-emits) — the fade band SCALES to the larger size, not the default
 *   4. a scoped edge size (`fade-size-bottom-lg`) — the bottom band scales without
 *      changing the top band
 *   5. nested isolation — a DEFAULT fade under an ancestor that sets a larger
 *      `--tw-fade-size` still renders the DEFAULT band, proving the `@property`
 *      `inherits: false` registration stops size/range leaking down (the cascade fix)
 *   6. mixed individual edges (fade-top fade-end) — arbitrary edge utilities compose
 *   7. nested single edge under a faded ancestor — mask layers do not leak down
 *
 * Usage: node build/verify-fade.mjs [path-to-css]   (defaults to the shipped dist)
 */
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const cssPath = process.argv[2] || path.resolve(__dirname, '../dist/tw-fade.css')
const css = fs.readFileSync(cssPath, 'utf8')

// Harness chrome: dark page behind TRANSPARENT panels (the real-world pattern — the
// mask masks the panel's own box, so a faded edge reveals whatever sits behind it).
const HARNESS = `
  * { margin: 0; box-sizing: border-box; }
  html { font-size: 16px; }
  body { background: #000; }
  .panel-v { width: 240px; height: 200px; overflow-y: auto; background: transparent; }
  .panel-h { width: 240px; height: 160px; overflow-x: auto; white-space: nowrap; background: transparent; }
  .panel-xy { width: 240px; height: 200px; overflow: auto; background: transparent; }
  .vb { height: 40px; background: #fff; }
  .hb { display: inline-block; width: 40px; height: 100%; background: #fff; }
  .xy-plane { width: 840px; height: 840px; background: #fff; }
`

const blocks = (cls, n) => Array.from({ length: n }, () => `<div class="${cls}"></div>`).join('')

const browser = await chromium.launch()

/**
 * Render `body`, scroll every `[data-scroll]` container to its midpoint (so BOTH
 * the leading and trailing fades are fully active), screenshot `innerSelector`,
 * and return the luminance profile along the center line of the scroll axis
 * (top→bottom for 'y', left→right for 'x'). The mask is rasterized into the
 * screenshot, so getImageData reads the real composited result.
 */
async function profileLine({ axis, body, innerSelector }) {
  const vertical = axis === 'y'
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${HARNESS}${css}</style></head><body>${body}</body></html>`

  const page = await browser.newPage({ viewport: { width: 600, height: 600 }, deviceScaleFactor: 1 })
  await page.setContent(html, { waitUntil: 'networkidle' })

  await page.evaluate(async (vert) => {
    for (const el of document.querySelectorAll('[data-scroll]')) {
      if (vert) el.scrollTop = Math.round((el.scrollHeight - el.clientHeight) / 2)
      else el.scrollLeft = Math.round((el.scrollWidth - el.clientWidth) / 2)
    }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  }, vertical)

  const shot = await page.locator(innerSelector).screenshot()
  const dataUrl = 'data:image/png;base64,' + shot.toString('base64')
  const lum = await page.evaluate(
    async ({ url, vert }) => {
      const img = new Image()
      img.src = url
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.width
      c.height = img.height
      const ctx = c.getContext('2d')
      ctx.drawImage(img, 0, 0)
      const out = []
      if (vert) {
        const x = Math.floor(img.width / 2)
        const d = ctx.getImageData(x, 0, 1, img.height).data
        for (let i = 0; i < img.height; i++) out.push((d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 3)
      } else {
        const y = Math.floor(img.height / 2)
        const d = ctx.getImageData(0, y, img.width, 1).data
        for (let i = 0; i < img.width; i++) out.push((d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 3)
      }
      return out
    },
    { url: dataUrl, vert: vertical },
  )

  await page.close()
  return lum
}

/** Render a two-axis scroller and sample top/right/middle luminance from pixels. */
async function samplePanel({ body, innerSelector }) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${HARNESS}${css}</style></head><body>${body}</body></html>`

  const page = await browser.newPage({ viewport: { width: 600, height: 600 }, deviceScaleFactor: 1 })
  await page.setContent(html, { waitUntil: 'networkidle' })

  await page.evaluate(async () => {
    for (const el of document.querySelectorAll('[data-scroll]')) {
      el.scrollTop = Math.round((el.scrollHeight - el.clientHeight) / 2)
      el.scrollLeft = Math.round((el.scrollWidth - el.clientWidth) / 2)
    }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  })

  const shot = await page.locator(innerSelector).screenshot()
  const dataUrl = 'data:image/png;base64,' + shot.toString('base64')
  const samples = await page.evaluate(async (url) => {
    const img = new Image()
    img.src = url
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.width
    c.height = img.height
    const ctx = c.getContext('2d')
    ctx.drawImage(img, 0, 0)
    const meanRect = (x0, y0, w, h) => {
      const d = ctx.getImageData(x0, y0, w, h).data
      let sum = 0
      for (let i = 0; i < d.length; i += 4) sum += (d[i] + d[i + 1] + d[i + 2]) / 3
      return sum / (d.length / 4)
    }
    return {
      top: meanRect(Math.floor(img.width * 0.45), 0, Math.floor(img.width * 0.1), 12),
      bottom: meanRect(Math.floor(img.width * 0.45), img.height - 12, Math.floor(img.width * 0.1), 12),
      right: meanRect(img.width - 12, Math.floor(img.height * 0.45), 12, Math.floor(img.height * 0.1)),
      mid: meanRect(Math.floor(img.width * 0.45), Math.floor(img.height * 0.45), Math.floor(img.width * 0.1), Math.floor(img.height * 0.1)),
    }
  }, dataUrl)

  await page.close()
  return samples
}

const mean = (a, lo, hi) => a.slice(lo, hi).reduce((x, y) => x + y, 0) / (hi - lo)

/**
 * Depth (in px from the leading edge) at which the fade first crosses into "bright"
 * content. That's ~the 50%-alpha point of the smoothstep, i.e. ≈ size/2 — a direct,
 * monotonic proxy for the rendered band width. Deeper crossing = wider band.
 */
function crossing(lum) {
  for (let i = 0; i < lum.length; i++) if (lum[i] > 127) return i
  return lum.length
}

// 1. Vertical default size.
const vLum = await profileLine({
  axis: 'y',
  innerSelector: '#v',
  body: `<div id="v" data-scroll class="fade-y panel-v">${blocks('vb', 40)}</div>`,
})
const vTop = mean(vLum, 0, 12)
const vMid = mean(vLum, Math.floor(vLum.length * 0.45), Math.floor(vLum.length * 0.55))
const vBot = mean(vLum, vLum.length - 12, vLum.length)
const vCross = crossing(vLum)

// 2. Horizontal default size (the axis verify.mjs never sampled at pixel level).
const hLum = await profileLine({
  axis: 'x',
  innerSelector: '#h',
  body: `<div id="h" data-scroll class="fade-x panel-h">${blocks('hb', 40)}</div>`,
})
const hLeft = mean(hLum, 0, 12)
const hMid = mean(hLum, Math.floor(hLum.length * 0.45), Math.floor(hLum.length * 0.55))
const hRight = mean(hLum, hLum.length - 12, hLum.length)

// 3. Overridden size. Inline `--tw-fade-size: 120px` is exactly what Tailwind's JIT
//    emits for `fade-size-[120px]`; the band must scale to it, not collapse
//    or stick at the default — the very thing an unset --tw-fade-size used to break.
const bigLum = await profileLine({
  axis: 'y',
  innerSelector: '#big',
  body: `<div id="big" data-scroll class="fade-y panel-v" style="--tw-fade-size: 120px">${blocks('vb', 40)}</div>`,
})
const bigCross = crossing(bigLum)

// 4. Scoped edge size. Bottom should grow while top stays at the default size.
const scopedLum = await profileLine({
  axis: 'y',
  innerSelector: '#scoped',
  body: `<div id="scoped" data-scroll class="fade-y fade-size-bottom-lg panel-v">${blocks('vb', 40)}</div>`,
})
const scopedTopCross = crossing(scopedLum)
const scopedBottomCross = crossing([...scopedLum].reverse())

// 5. Nested isolation. An ancestor sets a larger --tw-fade-size (as a fade-size-*
//    ancestor would); the inner DEFAULT fade must render the DEFAULT band. If
//    --tw-fade-size still inherited, the inner band would balloon to ~120px. The
//    @property `inherits: false` registration is what prevents the leak.
const nestLum = await profileLine({
  axis: 'y',
  innerSelector: '#inner',
  body: `<div style="--tw-fade-size: 120px; --tw-fade-ramp: 96px"><div id="inner" data-scroll class="fade-y panel-v">${blocks('vb', 40)}</div></div>`,
})
const nestCross = crossing(nestLum)

// 6. Mixed individual edges. This catches the cascade failure where one utility's
//    animation shorthand used to overwrite the other edge's ramp animation.
const combo = await samplePanel({
  innerSelector: '#combo',
  body: `<div id="combo" data-scroll class="fade-top fade-end panel-xy"><div class="xy-plane"></div></div>`,
})

// 7. A page-level/body-level fade used to leak its mask layer variables into
//    nested single-edge examples. The child should fade only at the top.
const nestedSingle = await samplePanel({
  innerSelector: '#nested-single',
  body: `<div class="fade-y" style="padding: 120px 0"><div id="nested-single" data-scroll class="fade-top panel-v">${blocks('vb', 40)}</div></div>`,
})

await browser.close()

const checks = [
  ['vertical default: top edge masked toward background', vTop < 60, `top≈${vTop.toFixed(0)}`],
  ['vertical default: middle stays bright (content visible)', vMid > 200, `mid≈${vMid.toFixed(0)}`],
  ['vertical default: bottom edge masked toward background', vBot < 60, `bot≈${vBot.toFixed(0)}`],
  ['vertical default: clear top fade contrast (mid ≫ top)', vMid - vTop > 120, `Δ≈${(vMid - vTop).toFixed(0)}`],

  ['horizontal default: left edge masked toward background', hLeft < 60, `left≈${hLeft.toFixed(0)}`],
  ['horizontal default: middle stays bright (content visible)', hMid > 200, `mid≈${hMid.toFixed(0)}`],
  ['horizontal default: right edge masked toward background', hRight < 60, `right≈${hRight.toFixed(0)}`],

  [
    'override size: fade band scales deeper than the default',
    bigCross > vCross + 18,
    `big≈${bigCross}px vs default≈${vCross}px`,
  ],

  [
    'scoped bottom size: top keeps the default band',
    Math.abs(scopedTopCross - vCross) <= 4,
    `top≈${scopedTopCross}px vs default≈${vCross}px`,
  ],
  [
    'scoped bottom size: bottom band is wider than top',
    scopedBottomCross > scopedTopCross + 6,
    `bottom≈${scopedBottomCross}px vs top≈${scopedTopCross}px`,
  ],

  [
    'nested isolation: inner keeps the DEFAULT band (inherits:false)',
    nestCross < (vCross + bigCross) / 2,
    `inner≈${nestCross}px (default≈${vCross}px, leaked≈${bigCross}px)`,
  ],

  ['mixed fade-top fade-end: top edge masked toward background', combo.top < 60, `top≈${combo.top.toFixed(0)}`],
  ['mixed fade-top fade-end: right edge masked toward background', combo.right < 60, `right≈${combo.right.toFixed(0)}`],
  ['mixed fade-top fade-end: middle stays bright', combo.mid > 200, `mid≈${combo.mid.toFixed(0)}`],
  ['nested fade-top: top edge masked toward background', nestedSingle.top < 60, `top≈${nestedSingle.top.toFixed(0)}`],
  ['nested fade-top: bottom edge remains unmasked', nestedSingle.bottom > 200, `bottom≈${nestedSingle.bottom.toFixed(0)}`],
  ['nested fade-top: middle stays bright', nestedSingle.mid > 200, `mid≈${nestedSingle.mid.toFixed(0)}`],
]

console.log(`CSS: ${path.relative(path.resolve(__dirname, '..'), cssPath)}`)
console.log(
  `vertical — top:${vTop.toFixed(0)} mid:${vMid.toFixed(0)} bot:${vBot.toFixed(0)} | ` +
    `horizontal — left:${hLeft.toFixed(0)} mid:${hMid.toFixed(0)} right:${hRight.toFixed(0)} | ` +
    `crossings — default:${vCross} big:${bigCross} scoped-top:${scopedTopCross} scoped-bottom:${scopedBottomCross} nested:${nestCross} | ` +
    `combo — top:${combo.top.toFixed(0)} right:${combo.right.toFixed(0)} mid:${combo.mid.toFixed(0)} | ` +
    `nested fade-top — top:${nestedSingle.top.toFixed(0)} bottom:${nestedSingle.bottom.toFixed(0)} mid:${nestedSingle.mid.toFixed(0)}`,
)
console.log('\n=== FADE PIXEL CHECKS ===')
let pass = 0
for (const [label, ok, detail] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  (${detail})`)
  if (ok) pass++
}
console.log(`\n${pass}/${checks.length} passed`)
process.exit(pass === checks.length ? 0 : 1)
