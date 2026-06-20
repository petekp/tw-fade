import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const rootDir = path.resolve(__dirname, '..')
export const demoDir = path.join(rootDir, 'demo')
export const defaultDemoBasePath = '/tw-fade'

export const demoStaticFiles = [
  'index.html',
  'styles.css',
  'demo.css',
  'demo-animations.js',
  'demo-controls.js',
  'favicon.ico',
  'favicon.svg',
  'favicon-16.png',
  'favicon-32.png',
  'apple-touch-icon.png',
  'site.webmanifest',
  'og-image.png',
]

export function normalizeBasePath(basePath = defaultDemoBasePath) {
  const trimmed = basePath.trim()
  if (!trimmed || trimmed === '/') return ''
  return '/' + trimmed.replace(/^\/+|\/+$/g, '')
}

export function rewriteHtmlAssetBase(html, basePath = defaultDemoBasePath) {
  const normalized = normalizeBasePath(basePath)
  const prefix = normalized ? `${normalized}/` : './'
  return html.replace(/\b(href|src)="\.\//g, `$1="${prefix}`)
}

export async function exportDemoStatic({
  outDir,
  basePath = defaultDemoBasePath,
} = {}) {
  if (!outDir) throw new Error('exportDemoStatic requires outDir')

  const normalizedBasePath = normalizeBasePath(basePath)
  const targetDir = normalizedBasePath
    ? path.join(outDir, normalizedBasePath.slice(1))
    : outDir

  await fs.rm(targetDir, { recursive: true, force: true })
  await fs.mkdir(targetDir, { recursive: true })

  for (const fileName of demoStaticFiles) {
    const source = path.join(demoDir, fileName)
    const target = path.join(targetDir, fileName)
    if (fileName === 'index.html') {
      const html = await fs.readFile(source, 'utf8')
      await fs.writeFile(target, rewriteHtmlAssetBase(html, basePath))
    } else {
      await fs.copyFile(source, target)
    }
  }

  return {
    basePath: normalizedBasePath,
    outDir,
    targetDir,
    files: demoStaticFiles.map((fileName) => path.join(targetDir, fileName)),
  }
}
