/**
 * Release metadata must move together whenever the package version changes.
 * Keeping these checks separate gives maintainers a direct fix for each kind
 * of drift instead of one broad "metadata mismatch" failure.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const readJson = (file) => JSON.parse(read(file))
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const pkg = readJson('package.json')
const lockfile = readJson('package-lock.json')
const readme = read('README.md')
const changelog = read('CHANGELOG.md')
const version = pkg.version
const escapedVersion = escapeRegExp(version)

test('package-lock root versions match package.json', () => {
  assert.equal(
    lockfile.version,
    version,
    `package-lock.json version must match package.json (${version})`,
  )
  assert.equal(
    lockfile.packages?.['']?.version,
    version,
    `package-lock.json packages[""] version must match package.json (${version})`,
  )
})

test('README pins the current package version in its unpkg stylesheet example', () => {
  const pinnedVersions = [
    ...readme.matchAll(/https:\/\/unpkg\.com\/tw-fade@([^/\s"']+)\/dist\/tw-fade\.css/g),
  ].map((match) => match[1])

  assert.ok(
    pinnedVersions.length > 0,
    'README.md must include a version-pinned tw-fade unpkg stylesheet URL',
  )
  assert.deepEqual(
    [...new Set(pinnedVersions)],
    [version],
    `README.md unpkg stylesheet URLs must pin tw-fade@${version}`,
  )
})

test('CHANGELOG has a dated section for the current package version', () => {
  assert.match(
    changelog,
    new RegExp(`^## \\[${escapedVersion}\\] - \\d{4}-\\d{2}-\\d{2}$`, 'm'),
    `CHANGELOG.md must include "## [${version}] - YYYY-MM-DD"`,
  )
})

test('CHANGELOG Unreleased link compares from the current package tag', () => {
  const expected = `https://github.com/petekp/tw-fade/compare/v${version}...HEAD`
  const match = changelog.match(/^\[Unreleased\]:\s*(\S+)$/m)

  assert.ok(match, 'CHANGELOG.md must define an [Unreleased] comparison link')
  assert.equal(match[1], expected, `[Unreleased] must compare from v${version}`)
})
