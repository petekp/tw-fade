const STABLE_VERSION = /^\d+\.\d+\.\d+$/
const RELEASE_DATE = /^\d{4}-\d{2}-\d{2}$/

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function requireStableVersion(value, label) {
  if (!STABLE_VERSION.test(value)) {
    throw new Error(`${label} must be a stable semver version, got "${value}"`)
  }
}

function requireSingleMatch(source, pattern, label) {
  const matches = [...source.matchAll(pattern)]
  if (matches.length !== 1) {
    throw new Error(`${label} must appear exactly once; found ${matches.length}`)
  }
  return matches[0]
}

function updateReadme({ readme, packageName, currentVersion, targetVersion }) {
  const prefix = `https://unpkg.com/${packageName}@`
  const suffix = '/dist/tw-fade.css'
  const pattern = new RegExp(
    `${escapeRegExp(prefix)}([^/\\s"']+)${escapeRegExp(suffix)}`,
    'g',
  )
  const matches = [...readme.matchAll(pattern)]

  if (matches.length === 0) {
    throw new Error('README.md must contain a version-pinned tw-fade unpkg stylesheet URL')
  }

  const pinnedVersions = [...new Set(matches.map((match) => match[1]))]
  if (pinnedVersions.length !== 1 || pinnedVersions[0] !== currentVersion) {
    throw new Error(
      `README.md unpkg stylesheet URLs must pin the current version ${currentVersion}; ` +
        `found ${pinnedVersions.join(', ')}`,
    )
  }

  return readme.replace(pattern, `${prefix}${targetVersion}${suffix}`)
}

function updateChangelog({ changelog, currentVersion, targetVersion, date }) {
  const currentEscaped = escapeRegExp(currentVersion)
  const targetEscaped = escapeRegExp(targetVersion)

  const unreleasedHeading = requireSingleMatch(
    changelog,
    /^## \[Unreleased\][ \t]*$/gm,
    'CHANGELOG.md Unreleased heading',
  )
  if (new RegExp(`^## \\[${targetEscaped}\\] - `, 'm').test(changelog)) {
    throw new Error(`CHANGELOG.md already has a ${targetVersion} release section`)
  }

  const releaseHeadingPattern = /^## \[([^\]]+)\] - (\d{4}-\d{2}-\d{2})[ \t]*$/gm
  releaseHeadingPattern.lastIndex = unreleasedHeading.index + unreleasedHeading[0].length
  const currentRelease = releaseHeadingPattern.exec(changelog)
  if (!currentRelease) {
    throw new Error('CHANGELOG.md must have a dated release section after Unreleased')
  }
  if (currentRelease[1] !== currentVersion) {
    throw new Error(
      `the first CHANGELOG.md release after Unreleased must be ${currentVersion}; ` +
        `found ${currentRelease[1]}`,
    )
  }

  const notes = changelog
    .slice(unreleasedHeading.index + unreleasedHeading[0].length, currentRelease.index)
    .trim()
  if (!notes) {
    throw new Error('CHANGELOG.md Unreleased section has no notes to release')
  }

  const migrationLines = [...notes.matchAll(/^\*\*Migration:\*\*[ \t]+\S.*$/gm)]
  if (migrationLines.length !== 1) {
    throw new Error(
      `CHANGELOG.md Unreleased section must contain exactly one **Migration:** line; ` +
        `found ${migrationLines.length}`,
    )
  }
  if (migrationLines[0].index !== 0) {
    throw new Error('CHANGELOG.md **Migration:** must be the first content under Unreleased')
  }
  const changeNotes = notes.slice(migrationLines[0][0].length).trim()
  if (!/^- \S.*$/m.test(changeNotes)) {
    throw new Error('CHANGELOG.md Unreleased section has no change-note bullet to release')
  }

  const unreleasedLink = requireSingleMatch(
    changelog,
    /^\[Unreleased\]:[ \t]*(\S+)[ \t]*$/gm,
    'CHANGELOG.md Unreleased comparison link',
  )
  const expectedSuffix = `/compare/v${currentVersion}...HEAD`
  const currentCompareUrl = unreleasedLink[1]
  if (!currentCompareUrl.endsWith(expectedSuffix)) {
    throw new Error(
      `CHANGELOG.md Unreleased link must compare from v${currentVersion}; found ${currentCompareUrl}`,
    )
  }
  const repositoryUrl = currentCompareUrl.slice(0, -expectedSuffix.length)

  requireSingleMatch(
    changelog,
    new RegExp(`^\\[${currentEscaped}\\]:[ \\t]*\\S+[ \\t]*$`, 'gm'),
    `CHANGELOG.md ${currentVersion} comparison link`,
  )
  if (new RegExp(`^\\[${targetEscaped}\\]:`, 'm').test(changelog)) {
    throw new Error(`CHANGELOG.md already has a ${targetVersion} comparison link`)
  }

  const nextLinks =
    `[Unreleased]: ${repositoryUrl}/compare/v${targetVersion}...HEAD\n` +
    `[${targetVersion}]: ${repositoryUrl}/compare/v${currentVersion}...v${targetVersion}`
  const headingStart = unreleasedHeading.index
  const releaseStart = currentRelease.index
  const withRelease =
    changelog.slice(0, headingStart) +
    `## [Unreleased]\n\n**Migration:** None.\n\n` +
    `## [${targetVersion}] - ${date}\n\n${notes}\n\n` +
    changelog.slice(releaseStart)

  return withRelease.replace(unreleasedLink[0], nextLinks)
}

/**
 * Build every release-file update in memory. Callers should write these results
 * only after this function returns, so stale or malformed metadata cannot leave
 * a half-bumped checkout behind.
 */
export function prepareReleaseBump({ packageJson, lockfile, readme, changelog, targetVersion, date }) {
  const currentVersion = packageJson?.version
  const packageName = packageJson?.name

  requireStableVersion(currentVersion, 'package.json version')
  requireStableVersion(targetVersion, 'target version')
  if (!packageName) throw new Error('package.json must have a package name')
  if (!RELEASE_DATE.test(date)) {
    throw new Error(`release date must use YYYY-MM-DD, got "${date}"`)
  }
  if (targetVersion === currentVersion) {
    throw new Error(`target version must differ from current version ${currentVersion}`)
  }

  if (lockfile?.version !== currentVersion) {
    throw new Error(
      `package-lock.json version must match package.json (${currentVersion}); ` +
        `found ${lockfile?.version ?? 'missing'}`,
    )
  }
  if (lockfile?.packages?.['']?.version !== currentVersion) {
    throw new Error(
      `package-lock.json packages[""] version must match package.json (${currentVersion}); ` +
        `found ${lockfile?.packages?.['']?.version ?? 'missing'}`,
    )
  }

  const nextReadme = updateReadme({ readme, packageName, currentVersion, targetVersion })
  const nextChangelog = updateChangelog({
    changelog,
    currentVersion,
    targetVersion,
    date,
  })

  return {
    packageJson: { ...packageJson, version: targetVersion },
    lockfile: {
      ...lockfile,
      version: targetVersion,
      packages: {
        ...lockfile.packages,
        '': { ...lockfile.packages[''], version: targetVersion },
      },
    },
    readme: nextReadme,
    changelog: nextChangelog,
  }
}
