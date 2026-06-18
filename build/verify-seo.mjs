import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const demo = path.join(root, 'demo')
const html = fs.readFileSync(path.join(demo, 'index.html'), 'utf8')

function metaContent(name) {
  const pattern = new RegExp(`<meta\\s+name="${name}"\\s+content="([^"]+)"\\s*/?>`, 'i')
  return html.match(pattern)?.[1] ?? ''
}

function propertyContent(property) {
  const pattern = new RegExp(`<meta\\s+property="${property}"\\s+content="([^"]+)"\\s*/?>`, 'i')
  return html.match(pattern)?.[1] ?? ''
}

function has(fragment) {
  return html.includes(fragment)
}

function pngSize(file) {
  const buffer = fs.readFileSync(file)
  const signature = buffer.subarray(0, 8).toString('hex')
  if (signature !== '89504e470d0a1a0a') return null
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  }
}

function icoFacts(file) {
  const buffer = fs.readFileSync(file)
  return {
    reserved: buffer.readUInt16LE(0),
    type: buffer.readUInt16LE(2),
    count: buffer.readUInt16LE(4),
  }
}

const jsonLdMatch = html.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/)
let jsonLd
try {
  jsonLd = jsonLdMatch ? JSON.parse(jsonLdMatch[1]) : null
} catch {
  jsonLd = null
}

const graph = Array.isArray(jsonLd?.['@graph']) ? jsonLd['@graph'] : []
const webpage = graph.find((node) => node['@type'] === 'WebPage')
const software = graph.find((node) => node['@type'] === 'SoftwareSourceCode')

const description = metaContent('description')
const ogImage = pngSize(path.join(demo, 'og-image.png'))
const appleIcon = pngSize(path.join(demo, 'apple-touch-icon.png'))
const favicon32 = pngSize(path.join(demo, 'favicon-32.png'))
const favicon16 = pngSize(path.join(demo, 'favicon-16.png'))
const faviconIco = icoFacts(path.join(demo, 'favicon.ico'))
const faviconSvg = fs.readFileSync(path.join(demo, 'favicon.svg'), 'utf8')

const checks = [
  ['title is specific to Tailwind scroll-edge fading', /<title>tw-fade - Tailwind CSS scroll-edge fading with CSS masks<\/title>/.test(html)],
  ['meta description exists and is preview-safe length', description.length >= 120 && description.length <= 170],
  ['canonical URL points to production route', has('<link rel="canonical" href="https://pete.design/tw-fade" />')],
  ['robots allows indexing and large previews', metaContent('robots') === 'index, follow, max-image-preview:large'],
  ['Open Graph title present', propertyContent('og:title') === 'tw-fade - Tailwind CSS scroll-edge fading'],
  ['Open Graph image points to absolute production PNG', propertyContent('og:image') === 'https://pete.design/tw-fade/og-image.png'],
  ['Open Graph dimensions are declared', propertyContent('og:image:width') === '1200' && propertyContent('og:image:height') === '630'],
  ['Twitter uses summary_large_image', metaContent('twitter:card') === 'summary_large_image'],
  ['Twitter image points to production PNG', metaContent('twitter:image') === 'https://pete.design/tw-fade/og-image.png'],
  ['local demo keeps relative stylesheet path', has('<link rel="stylesheet" href="./styles.css" />')],
  [
    'favicon links are present',
    has('href="./favicon.ico"') &&
      has('href="./favicon.svg"') &&
      has('href="./favicon-16.png"') &&
      has('href="./favicon-32.png"'),
  ],
  ['apple touch icon link is present', has('href="./apple-touch-icon.png"')],
  ['web manifest link is present', has('href="./site.webmanifest"')],
  ['JSON-LD parses', Boolean(jsonLd)],
  ['JSON-LD WebPage node is canonical', webpage?.url === 'https://pete.design/tw-fade'],
  ['JSON-LD software node links repository', software?.codeRepository === 'https://github.com/petekp/tw-fade'],
  ['OG image is 1200x630 PNG', ogImage?.width === 1200 && ogImage?.height === 630],
  ['apple touch icon is 180x180 PNG', appleIcon?.width === 180 && appleIcon?.height === 180],
  ['favicon PNGs are 16x16 and 32x32', favicon16?.width === 16 && favicon16?.height === 16 && favicon32?.width === 32 && favicon32?.height === 32],
  ['favicon.ico contains two icon entries', faviconIco.reserved === 0 && faviconIco.type === 1 && faviconIco.count === 2],
  ['favicon SVG contains dark and light dither cells', faviconSvg.includes('#020617') && faviconSvg.includes('#f8fafc')],
]

console.log('SEO metadata and assets')
let pass = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (ok) pass++
}

console.log(`\n${pass}/${checks.length} passed`)
process.exit(pass === checks.length ? 0 : 1)
