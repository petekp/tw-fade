import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { chromium } from 'playwright'

const execFileP = promisify(execFile)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const demoDir = path.join(root, 'demo')

// The OG card reuses the live masthead verbatim: the page's compiled Tailwind
// (styles.css) and its inline <style> block are inlined so the wordmark depth
// stack, eyebrow, tokens, and wave background render byte-identically to the
// real hero — no hand-maintained approximation to drift out of sync.
const indexHtml = await fs.readFile(path.join(demoDir, 'index.html'), 'utf8')
const inlineStyleRaw = indexHtml.match(/<style>([\s\S]*?)<\/style>/)[1]
const stylesCss = await fs.readFile(path.join(demoDir, 'styles.css'), 'utf8')

// The OG card shows the wave background statically (the scroll-driven morph JS
// never runs here), so bump the wave stroke opacity +15% (0.065 -> 0.075) for a
// touch more presence. OG-only — the live page's inline style is untouched.
const inlineStyle = inlineStyleRaw.replace("stroke-opacity%3D'0.065'", "stroke-opacity%3D'0.075'")

const bayer8 = [
  [0, 48, 12, 60, 3, 51, 15, 63],
  [32, 16, 44, 28, 35, 19, 47, 31],
  [8, 56, 4, 52, 11, 59, 7, 55],
  [40, 24, 36, 20, 43, 27, 39, 23],
  [2, 50, 14, 62, 1, 49, 13, 61],
  [34, 18, 46, 30, 33, 17, 45, 29],
  [10, 58, 6, 54, 9, 57, 5, 53],
  [42, 26, 38, 22, 41, 25, 37, 21],
]

function ditherSvg(size = 256, cells = 32) {
  const cellSize = size / cells
  const rects = []

  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const diagonal = (x + y) / (2 * (cells - 1))
      const value = Math.max(0, Math.min(1, (diagonal - 0.22) / 0.52))
      const threshold = (bayer8[y % 8][x % 8] + 0.5) / 64
      const color = value >= threshold ? '#f8fafc' : '#020617'
      rects.push(
        `<rect x="${(x * cellSize).toFixed(3)}" y="${(y * cellSize).toFixed(3)}" width="${cellSize.toFixed(3)}" height="${cellSize.toFixed(3)}" fill="${color}" />`,
      )
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Dithered fade square">`,
    `<rect width="${size}" height="${size}" fill="#020617" />`,
    ...rects,
    '</svg>',
  ].join('')
}

function encodeSvg(svg) {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

function iconDocument(svg, size) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html,
      body {
        width: ${size}px;
        height: ${size}px;
        margin: 0;
        overflow: hidden;
        background: transparent;
      }

      img {
        display: block;
        width: ${size}px;
        height: ${size}px;
      }
    </style>
  </head>
  <body>
    <img src="${encodeSvg(svg)}" alt="" />
  </body>
</html>`
}

// The masthead wordmark: a 14-layer static depth extrusion (--hero-scroll: 0)
// capped by the main glyph, copied verbatim from the live hero so the OG glow
// matches the page exactly.
const heroWordmark = `<h1 class="hero-title hero-title-stack text-neutral-50" aria-label="tw-fade">
        <span class="hero-title-depth" style="--depth-y: 0.292em; --depth-scale: 0.91; --depth-opacity: 0.01; --depth-scroll-x: -0.014em; --depth-scroll-y: 0.22em; --depth-scroll-scale: 0.034; --depth-scroll-opacity: 0.04; filter: blur(0.017em);" aria-hidden="true">tw-fade</span>
        <span class="hero-title-depth" style="--depth-y: 0.26954em; --depth-scale: 0.91658; --depth-opacity: 0.02023; --depth-scroll-x: -0.01298em; --depth-scroll-y: 0.20392em; --depth-scroll-scale: 0.0315; --depth-scroll-opacity: 0.03708; filter: blur(0.01715em);" aria-hidden="true">tw-fade</span>
        <span class="hero-title-depth" style="--depth-y: 0.24708em; --depth-scale: 0.92315; --depth-opacity: 0.03046; --depth-scroll-x: -0.01195em; --depth-scroll-y: 0.18785em; --depth-scroll-scale: 0.029; --depth-scroll-opacity: 0.03415; filter: blur(0.01731em);" aria-hidden="true">tw-fade</span>
        <span class="hero-title-depth" style="--depth-y: 0.22462em; --depth-scale: 0.92973; --depth-opacity: 0.04069; --depth-scroll-x: -0.01093em; --depth-scroll-y: 0.17177em; --depth-scroll-scale: 0.0265; --depth-scroll-opacity: 0.03123; filter: blur(0.01746em);" aria-hidden="true">tw-fade</span>
        <span class="hero-title-depth" style="--depth-y: 0.20215em; --depth-scale: 0.93631; --depth-opacity: 0.05092; --depth-scroll-x: -0.00991em; --depth-scroll-y: 0.15569em; --depth-scroll-scale: 0.024; --depth-scroll-opacity: 0.02831; filter: blur(0.01762em);" aria-hidden="true">tw-fade</span>
        <span class="hero-title-depth" style="--depth-y: 0.17969em; --depth-scale: 0.94288; --depth-opacity: 0.06115; --depth-scroll-x: -0.00888em; --depth-scroll-y: 0.13962em; --depth-scroll-scale: 0.0215; --depth-scroll-opacity: 0.02538; filter: blur(0.01777em);" aria-hidden="true">tw-fade</span>
        <span class="hero-title-depth" style="--depth-y: 0.15723em; --depth-scale: 0.94946; --depth-opacity: 0.07138; --depth-scroll-x: -0.00786em; --depth-scroll-y: 0.12354em; --depth-scroll-scale: 0.019; --depth-scroll-opacity: 0.02246; filter: blur(0.01792em);" aria-hidden="true">tw-fade</span>
        <span class="hero-title-depth" style="--depth-y: 0.13477em; --depth-scale: 0.95604; --depth-opacity: 0.08162; --depth-scroll-x: -0.00684em; --depth-scroll-y: 0.10746em; --depth-scroll-scale: 0.0165; --depth-scroll-opacity: 0.01954; filter: blur(0.01808em);" aria-hidden="true">tw-fade</span>
        <span class="hero-title-depth" style="--depth-y: 0.11231em; --depth-scale: 0.96262; --depth-opacity: 0.09185; --depth-scroll-x: -0.00582em; --depth-scroll-y: 0.09138em; --depth-scroll-scale: 0.014; --depth-scroll-opacity: 0.01662; filter: blur(0.01823em);" aria-hidden="true">tw-fade</span>
        <span class="hero-title-depth" style="--depth-y: 0.08985em; --depth-scale: 0.96919; --depth-opacity: 0.10208; --depth-scroll-x: -0.00479em; --depth-scroll-y: 0.07531em; --depth-scroll-scale: 0.0115; --depth-scroll-opacity: 0.01369; filter: blur(0.01838em);" aria-hidden="true">tw-fade</span>
        <span class="hero-title-depth" style="--depth-y: 0.06738em; --depth-scale: 0.97577; --depth-opacity: 0.11231; --depth-scroll-x: -0.00377em; --depth-scroll-y: 0.05923em; --depth-scroll-scale: 0.009; --depth-scroll-opacity: 0.01077; filter: blur(0.01854em);" aria-hidden="true">tw-fade</span>
        <span class="hero-title-depth" style="--depth-y: 0.04492em; --depth-scale: 0.98235; --depth-opacity: 0.12254; --depth-scroll-x: -0.00275em; --depth-scroll-y: 0.04315em; --depth-scroll-scale: 0.0065; --depth-scroll-opacity: 0.00785; filter: blur(0.01869em);" aria-hidden="true">tw-fade</span>
        <span class="hero-title-depth" style="--depth-y: 0.02246em; --depth-scale: 0.98892; --depth-opacity: 0.13277; --depth-scroll-x: -0.00172em; --depth-scroll-y: 0.02708em; --depth-scroll-scale: 0.004; --depth-scroll-opacity: 0.00492; filter: blur(0.01885em);" aria-hidden="true">tw-fade</span>
        <span class="hero-title-depth" style="--depth-y: 0em; --depth-scale: 0.9955; --depth-opacity: 0.143; --depth-scroll-x: -0.0007em; --depth-scroll-y: 0.011em; --depth-scroll-scale: 0.0015; --depth-scroll-opacity: 0.002; filter: blur(0.019em);" aria-hidden="true">tw-fade</span>
        <span class="hero-title-main" aria-hidden="true">tw-fade</span>
      </h1>`

const heroEyebrow = `<p class="masthead-plugin-label">
        <svg width="26" height="16" viewBox="0 0 54 33" aria-hidden="true">
          <path fill="currentColor" fill-rule="evenodd" d="M27 0c-7.2 0-11.7 3.6-13.5 10.8 2.7-3.6 5.85-4.95 9.45-4.05 2.054.514 3.522 2.005 5.147 3.653C30.744 13.09 33.809 16.2 40.5 16.2c7.2 0 11.7-3.6 13.5-10.8-2.7 3.6-5.85 4.95-9.45 4.05-2.054-.514-3.522-2.005-5.147-3.653C36.756 3.11 33.691 0 27 0ZM13.5 16.2C6.3 16.2 1.8 19.8 0 27c2.7-3.6 5.85-4.95 9.45-4.05 2.054.514 3.522 2.005 5.147 3.653C17.244 29.29 20.309 32.4 27 32.4c7.2 0 11.7-3.6 13.5-10.8-2.7 3.6-5.85 4.95-9.45 4.05-2.054-.514-3.522-2.005-5.147-3.653C23.256 19.31 20.191 16.2 13.5 16.2Z" clip-rule="evenodd" />
        </svg>
        <span>Tailwind v4</span>
      </p>`

function ogDocument() {
  return `<!doctype html>
<html lang="en" class="dark" data-surface="graphite">
  <head>
    <meta charset="utf-8" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Climate+Crisis&display=swap" rel="stylesheet" />
    <style>${stylesCss}</style>
    <style>${inlineStyle}</style>
    <style>
      /* OG frame: fixed 1200x630, masthead left-aligned to match the live hero.
         Note the page body's fade-y mask is deliberately omitted here — at a
         fixed height it would fade the eyebrow/tagline into the background. */
      html, body { width: 1200px; height: 630px; margin: 0; overflow: hidden; }
      body { display: flex; }
      .og-frame {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: flex-start;
        padding: 0 86px;
      }
      .og-frame .masthead-lockup { align-self: flex-start; }
      .og-frame .masthead-plugin-label {
        margin-bottom: 1.5rem;
        font-size: 1.5rem;
        letter-spacing: 0.01em;
      }
      .og-frame .masthead-plugin-label svg { width: 44px; height: 27px; }
      .og-frame .hero-title { font-size: 150px; }
      .og-frame .og-tagline {
        margin: 3.6rem 0 0;
        max-width: none;
        white-space: nowrap;
        font-size: 31px;
        line-height: 1.34;
        font-weight: 400;
      }
    </style>
  </head>
  <body class="antialiased">
    <div class="og-frame">
      <div class="masthead-lockup">
        ${heroEyebrow}
        ${heroWordmark}
      </div>
      <p class="og-tagline text-balance text-neutral-300/85">Elegant, scroll-driven edge masking. One class. Zero JavaScript.</p>
    </div>
  </body>
</html>`
}

function icoBuffer(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)

  const entries = Buffer.alloc(16 * images.length)
  let offset = header.length + entries.length

  images.forEach((image, index) => {
    const entryOffset = index * 16
    entries.writeUInt8(image.size === 256 ? 0 : image.size, entryOffset)
    entries.writeUInt8(image.size === 256 ? 0 : image.size, entryOffset + 1)
    entries.writeUInt8(0, entryOffset + 2)
    entries.writeUInt8(0, entryOffset + 3)
    entries.writeUInt16LE(1, entryOffset + 4)
    entries.writeUInt16LE(32, entryOffset + 6)
    entries.writeUInt32LE(image.buffer.length, entryOffset + 8)
    entries.writeUInt32LE(offset, entryOffset + 12)
    offset += image.buffer.length
  })

  return Buffer.concat([header, entries, ...images.map((image) => image.buffer)])
}

async function renderPng(browser, html, size, outPath) {
  const page = await browser.newPage({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 1 })
  await page.setContent(html, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts?.ready)
  const buffer = await page.screenshot({ path: outPath, type: 'png', omitBackground: false })
  await page.close()
  return buffer
}

// Render the 1200x630 OG card at 2x then downscale, so the Climate Crisis
// display face stays crisp. Downscale uses macOS `sips`.
async function renderOgPng(browser, html, outPath) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 })
  await page.setContent(html, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts?.ready)
  await page.waitForTimeout(200)
  const hiRes = outPath.replace(/\.png$/, '@2x.png')
  await page.screenshot({ path: hiRes, type: 'png' })
  await page.close()
  await execFileP('sips', ['-z', '630', '1200', hiRes, '--out', outPath])
  await fs.rm(hiRes, { force: true })
}

await fs.mkdir(demoDir, { recursive: true })

const iconSvg = ditherSvg(256, 32)
await fs.writeFile(path.join(demoDir, 'favicon.svg'), `${iconSvg}\n`)

const manifest = {
  name: 'tw-fade',
  short_name: 'tw-fade',
  description: 'Tailwind CSS scroll-edge fading with CSS masks and zero JavaScript.',
  start_url: '/tw-fade',
  display: 'standalone',
  background_color: '#020617',
  theme_color: '#020617',
  icons: [
    { src: './favicon-32.png', sizes: '32x32', type: 'image/png' },
    { src: './apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
  ],
}
await fs.writeFile(path.join(demoDir, 'site.webmanifest'), `${JSON.stringify(manifest, null, 2)}\n`)

const browser = await chromium.launch()
try {
  const favicon16 = await renderPng(browser, iconDocument(iconSvg, 16), { width: 16, height: 16 }, path.join(demoDir, 'favicon-16.png'))
  const favicon32 = await renderPng(browser, iconDocument(iconSvg, 32), { width: 32, height: 32 }, path.join(demoDir, 'favicon-32.png'))
  await renderPng(browser, iconDocument(iconSvg, 180), { width: 180, height: 180 }, path.join(demoDir, 'apple-touch-icon.png'))
  await renderOgPng(browser, ogDocument(), path.join(demoDir, 'og-image.png'))
  await fs.writeFile(path.join(demoDir, 'favicon.ico'), icoBuffer([
    { size: 16, buffer: favicon16 },
    { size: 32, buffer: favicon32 },
  ]))
} finally {
  await browser.close()
}

console.log('wrote demo/favicon.svg')
console.log('wrote demo/favicon-16.png')
console.log('wrote demo/favicon-32.png')
console.log('wrote demo/favicon.ico')
console.log('wrote demo/apple-touch-icon.png')
console.log('wrote demo/og-image.png')
console.log('wrote demo/site.webmanifest')
