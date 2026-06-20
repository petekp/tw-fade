#!/usr/bin/env node
import path from 'node:path'
import { exportDemoStatic, defaultDemoBasePath } from '../build/demo-static.mjs'

function readOption(name, fallback) {
  const flag = `--${name}`
  const index = process.argv.indexOf(flag)
  if (index === -1) return fallback
  const value = process.argv[index + 1]
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value`)
  }
  return value
}

const outDir = path.resolve(readOption('out', '.tmp/demo-static'))
const basePath = readOption('base-path', defaultDemoBasePath)
const result = await exportDemoStatic({ outDir, basePath })

console.log(`Exported demo static assets to ${result.targetDir}`)
console.log(`Base path: ${result.basePath || '/'}`)
