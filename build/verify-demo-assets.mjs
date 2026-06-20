import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  demoDir,
  demoStaticFiles,
  exportDemoStatic,
} from './demo-static.mjs'

const html = fs.readFileSync(path.join(demoDir, 'index.html'), 'utf8')
const checks = []

function check(label, ok, detail = '') {
  checks.push([label, Boolean(ok), detail])
}

function fileExists(filePath) {
  try {
    return fs.statSync(filePath).isFile()
  } catch {
    return false
  }
}

const localAssetRefs = Array.from(
  html.matchAll(/\b(?:href|src)="(\.\/[^"]+)"/g),
  (match) => match[1],
)
const missingLocalAssets = localAssetRefs.filter((ref) => {
  return !fileExists(path.join(demoDir, ref.slice(2)))
})

const scriptRefs = Array.from(
  html.matchAll(/<script([^>]*)>/g),
  (match) => match[1].match(/\bsrc="([^"]+)"/)?.[1] ?? null,
).filter(Boolean)
const inlineScripts = Array.from(
  html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g),
).filter((match) => {
  return !match[1].includes('src=') && !match[1].includes('application/ld+json')
})

const springSources = ['demo-animations.js', 'demo-controls.js']
const springObjects = springSources.flatMap((fileName) => {
  const source = fs.readFileSync(path.join(demoDir, fileName), 'utf8')
  return Array.from(
    source.matchAll(/type:\s*["']spring["'][\s\S]*?\}/g),
    (match) => ({ fileName, text: match[0], index: match.index }),
  )
})
const springsMissingRestDelta = springObjects.filter((spring) => {
  return !/restDelta:\s*0\.001\b/.test(spring.text)
})

const animationsSource = fs.readFileSync(
  path.join(demoDir, 'demo-animations.js'),
  'utf8',
)
const controlsSource = fs.readFileSync(
  path.join(demoDir, 'demo-controls.js'),
  'utf8',
)
const cssSource = fs.readFileSync(path.join(demoDir, 'demo.css'), 'utf8')
const dynamicColorMixWithCustomProperty = /color-mix\([\s\S]{0,360}calc\([^)]*var\(--/.test(cssSource)

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-fade-export-'))
const exportResult = await exportDemoStatic({ outDir: tmpRoot })
const exportedHtml = fs.readFileSync(
  path.join(exportResult.targetDir, 'index.html'),
  'utf8',
)
const missingExportedFiles = demoStaticFiles.filter((fileName) => {
  return !fileExists(path.join(exportResult.targetDir, fileName))
})
const exportedLabFiles = ['hero-lab.html', 'wave-lab.html'].filter((fileName) => {
  return fileExists(path.join(exportResult.targetDir, fileName))
})
fs.rmSync(tmpRoot, { recursive: true, force: true })

check(
  'all local relative asset references exist',
  missingLocalAssets.length === 0,
  missingLocalAssets.join(', '),
)
check(
  'demo loads scripts in dependency order',
  scriptRefs.join(' ') === './demo-animations.js ./demo-controls.js',
  scriptRefs.join(' '),
)
check('demo has no inline classic scripts', inlineScripts.length === 0)
check('demo has no inline style block', !/<style\b/i.test(html))
check('retired scroll repaint script is absent', !html.includes('demo-waves.js'))
check('retired scroll repaint file is absent', !fileExists(path.join(demoDir, 'demo-waves.js')))
check(
  'no demo script mutates the root background image during scroll',
  !/backgroundImage|backgroundSize/.test(animationsSource + controlsSource),
)
check(
  'CSS wave field is scroll-timeline driven when supported',
  cssSource.includes('scroll-timeline-name: --demo-page-scroll') &&
    cssSource.includes('animation-timeline: --demo-page-scroll'),
)
check(
  'demo CSS avoids WebKit-crashing dynamic color-mix percentages',
  !dynamicColorMixWithCustomProperty,
)
check(
  'all spring animation objects settle at restDelta 0.001',
  springsMissingRestDelta.length === 0,
  springsMissingRestDelta
    .map((spring) => `${spring.fileName}:${spring.index}`)
    .join(', '),
)
check(
  'export includes every production static file',
  missingExportedFiles.length === 0,
  missingExportedFiles.join(', '),
)
check(
  'export excludes noindex design scratchpads',
  exportedLabFiles.length === 0,
  exportedLabFiles.join(', '),
)
check(
  'export rewrites local links to /tw-fade',
  !/\b(?:href|src)="\.\//.test(exportedHtml) &&
    exportedHtml.includes('href="/tw-fade/demo.css"') &&
    exportedHtml.includes('src="/tw-fade/demo-animations.js"') &&
    exportedHtml.includes('src="/tw-fade/demo-controls.js"'),
)

console.log('Demo static asset contract')
let pass = 0
for (const [label, ok, detail] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`)
  if (ok) pass++
}

console.log(`\n${pass}/${checks.length} passed`)
process.exit(pass === checks.length ? 0 : 1)
