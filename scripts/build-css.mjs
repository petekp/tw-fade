/**
 * build-css.mjs — write the framework-free stylesheet to dist/.
 *
 *   node scripts/build-css.mjs
 *
 * Regenerates dist/tw-fade.css from the plugin source. Run this whenever
 * src/index.js changes so the no-build / CDN drop-in stays in sync.
 */
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'
import { compileCss } from './compile.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const outFile = path.join(root, 'dist', 'tw-fade.css')

const css = compileCss()
fs.mkdirSync(path.dirname(outFile), { recursive: true })
fs.writeFileSync(outFile, css)

console.log(`wrote ${path.relative(root, outFile)} (${css.length} bytes)`)
