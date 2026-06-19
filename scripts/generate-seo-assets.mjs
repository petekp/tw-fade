import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const demoDir = path.join(root, 'demo')

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

function waveSvg() {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="156" height="900" viewBox="0 0 156 900">',
    "<path d='M78 0 C158 75 158 150 78 225 S-2 375 78 450 S158 600 78 675 S-2 825 78 900' fill='none' stroke='%23ffffff' stroke-opacity='0.08' stroke-width='1.15' stroke-linecap='round' stroke-linejoin='round' />",
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

function ogDocument(iconSvg) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Climate+Crisis&display=swap" rel="stylesheet" />
    <style>
      * {
        box-sizing: border-box;
      }

      html,
      body {
        width: 1200px;
        height: 630px;
        margin: 0;
        overflow: hidden;
        background: #020617;
        color: #f8fafc;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      body {
        background-color: #020617;
        background-image:
          linear-gradient(120deg, rgb(2 6 23 / 0.96), rgb(5 21 42 / 0.92) 58%, rgb(2 6 23 / 0.96)),
          url("${encodeSvg(waveSvg())}");
        background-repeat: no-repeat, repeat;
        background-size: cover, 156px 900px;
      }

      main {
        position: relative;
        width: 100%;
        height: 100%;
        padding: 64px 72px;
      }

      .label {
        color: #5eead4;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        font-size: 18px;
        font-weight: 600;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }

      h1 {
        margin: 26px 0 0;
        color: #e0f2fe;
        font-family: "Climate Crisis", "Arial Black", Impact, ui-sans-serif, system-ui, sans-serif;
        font-size: 150px;
        font-weight: 400;
        line-height: 0.9;
        letter-spacing: 0;
        text-shadow:
          -7px 12px 0 rgb(148 163 184 / 0.34),
          -14px 24px 0 rgb(148 163 184 / 0.2),
          -21px 36px 0 rgb(148 163 184 / 0.12);
      }

      .copy {
        max-width: 850px;
        margin: 44px 0 0;
        color: rgb(219 234 254 / 0.9);
        font-size: 32px;
        line-height: 1.32;
      }

      .chips {
        display: flex;
        gap: 14px;
        margin-top: 42px;
      }

      .chip {
        border: 1px solid rgb(94 234 212 / 0.3);
        border-radius: 999px;
        padding: 11px 15px;
        color: rgb(204 251 241 / 0.86);
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        font-size: 20px;
        background: rgb(15 23 42 / 0.56);
      }

      .icon {
        position: absolute;
        top: 68px;
        right: 72px;
        width: 124px;
        height: 124px;
        box-shadow: 0 28px 80px rgb(0 0 0 / 0.35);
      }

      .browser {
        position: absolute;
        right: 72px;
        bottom: 64px;
        color: rgb(148 163 184 / 0.78);
        font-size: 22px;
      }
    </style>
  </head>
  <body>
    <main>
      <img class="icon" src="${encodeSvg(iconSvg)}" alt="" />
      <div class="label">Tailwind v4 plugin</div>
      <h1>tw-fade</h1>
      <p class="copy">Scroll-edge fading for Tailwind CSS. CSS masks let content dissolve into any surface with zero JavaScript.</p>
      <div class="chips" aria-hidden="true">
        <span class="chip">fade-y</span>
        <span class="chip">fade-x</span>
        <span class="chip">fade-size-b-lg</span>
      </div>
      <div class="browser">Chrome · Safari · Edge · Firefox Nightly</div>
    </main>
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
  await renderPng(browser, ogDocument(iconSvg), { width: 1200, height: 630 }, path.join(demoDir, 'og-image.png'))
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
