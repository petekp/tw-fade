import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { prepareReleaseBump } from '../scripts/release-metadata.mjs'

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'release-metadata')
const readFixture = (name) => fs.readFileSync(path.join(fixtures, name), 'utf8')

function releaseFixture(overrides = {}) {
  return {
    packageJson: { name: 'tw-fade', version: '1.2.3', description: 'fixture' },
    lockfile: {
      name: 'tw-fade',
      version: '1.2.3',
      lockfileVersion: 3,
      packages: { '': { name: 'tw-fade', version: '1.2.3' } },
    },
    readme: readFixture('README.md'),
    changelog: readFixture('CHANGELOG.md'),
    targetVersion: '1.3.0',
    date: '2026-07-31',
    ...overrides,
  }
}

test('a version bump prepares every release metadata update together', () => {
  const fixture = releaseFixture()
  const prepared = prepareReleaseBump(fixture)

  assert.equal(prepared.packageJson.version, '1.3.0')
  assert.equal(prepared.lockfile.version, '1.3.0')
  assert.equal(prepared.lockfile.packages[''].version, '1.3.0')
  assert.doesNotMatch(prepared.readme, /tw-fade@1\.2\.3/)
  assert.equal(
    [...prepared.readme.matchAll(/tw-fade@1\.3\.0\/dist\/tw-fade\.css/g)].length,
    2,
    'every pinned unpkg stylesheet example should be updated',
  )

  assert.match(
    prepared.changelog,
    /## \[Unreleased\]\n\n\*\*Migration:\*\* None\.\n\n## \[1\.3\.0\] - 2026-07-31\n\n\*\*Migration:\*\* None\.\n\n### Added\n\n- Added the new release feature\./,
  )
  assert.match(prepared.changelog, /## \[1\.2\.3\] - 2026-07-01/)
  assert.match(
    prepared.changelog,
    /^\[Unreleased\]: https:\/\/github\.com\/example\/tw-fade\/compare\/v1\.3\.0\.\.\.HEAD$/m,
  )
  assert.match(
    prepared.changelog,
    /^\[1\.3\.0\]: https:\/\/github\.com\/example\/tw-fade\/compare\/v1\.2\.3\.\.\.v1\.3\.0$/m,
  )
  assert.match(
    prepared.changelog,
    /^\[1\.2\.3\]: https:\/\/github\.com\/example\/tw-fade\/compare\/v1\.2\.2\.\.\.v1\.2\.3$/m,
  )

  assert.equal(fixture.packageJson.version, '1.2.3', 'the input package object stays untouched')
  assert.equal(fixture.lockfile.version, '1.2.3', 'the input lockfile stays untouched')
})

test('a bump rejects stale inputs before returning any files to write', async (t) => {
  await t.test('stale package-lock root', () => {
    const fixture = releaseFixture()
    fixture.lockfile.packages[''].version = '1.2.2'
    assert.throws(
      () => prepareReleaseBump(fixture),
      /package-lock\.json packages\[""\] version must match package\.json/,
    )
  })

  await t.test('stale README pin', () => {
    const fixture = releaseFixture({
      readme: readFixture('README.md').replaceAll('tw-fade@1.2.3', 'tw-fade@1.2.2'),
    })
    assert.throws(() => prepareReleaseBump(fixture), /must pin the current version 1\.2\.3/)
  })

  await t.test('empty Unreleased notes', () => {
    const fixture = releaseFixture({
      changelog: readFixture('CHANGELOG.md').replace(
        /## \[Unreleased\][\s\S]*?(?=## \[1\.2\.3\])/,
        '## [Unreleased]\n\n',
      ),
    })
    assert.throws(() => prepareReleaseBump(fixture), /Unreleased section has no notes/)
  })

  await t.test('missing Unreleased migration status', () => {
    const fixture = releaseFixture({
      changelog: readFixture('CHANGELOG.md').replace('**Migration:** None.\n\n', ''),
    })
    assert.throws(
      () => prepareReleaseBump(fixture),
      /Unreleased section must contain exactly one \*\*Migration:\*\* line/,
    )
  })

  await t.test('misplaced Unreleased migration status', () => {
    const fixture = releaseFixture({
      changelog: readFixture('CHANGELOG.md')
        .replace('**Migration:** None.\n\n', '')
        .replace('### Added\n\n', '### Added\n\n**Migration:** None.\n\n'),
    })
    assert.throws(
      () => prepareReleaseBump(fixture),
      /\*\*Migration:\*\* must be the first content under Unreleased/,
    )
  })

  await t.test('migration status without change notes', () => {
    const fixture = releaseFixture({
      changelog: readFixture('CHANGELOG.md').replace(
        /### Added[\s\S]*?(?=## \[1\.2\.3\])/,
        '',
      ),
    })
    assert.throws(() => prepareReleaseBump(fixture), /no change-note bullet to release/)
  })

  await t.test('change heading without a bullet', () => {
    const fixture = releaseFixture({
      changelog: readFixture('CHANGELOG.md').replace(
        /### Added[\s\S]*?(?=## \[1\.2\.3\])/,
        '### Added\n\n',
      ),
    })
    assert.throws(() => prepareReleaseBump(fixture), /no change-note bullet to release/)
  })

  await t.test('stale Unreleased comparison base', () => {
    const fixture = releaseFixture({
      changelog: readFixture('CHANGELOG.md').replace('v1.2.3...HEAD', 'v1.2.2...HEAD'),
    })
    assert.throws(() => prepareReleaseBump(fixture), /must compare from v1\.2\.3/)
  })
})
