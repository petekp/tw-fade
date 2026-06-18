#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const packagePath = path.join(root, 'package.json')
const lockfilePath = path.join(root, 'package-lock.json')

const usage = `Usage:
  npm run release -- <patch|minor|major|x.y.z> [options]
  npm run release -- --no-bump [options]

Examples:
  npm run release -- minor
  npm run release -- 0.4.0
  npm run release -- minor --publish --yes

Options:
  --publish          Publish to npm after the dry run passes.
  --yes              Required with --publish.
  --dist-tag <tag>   npm dist-tag to publish under. Default: latest.
  --otp <code>       Pass an npm one-time password.
  --no-bump          Keep the current package version.
  -h, --help         Show this help text.
`

function fail(message) {
  console.error(`release: ${message}`)
  console.error('')
  console.error(usage)
  process.exit(1)
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version)
  if (!match) fail(`expected a stable semver version, got "${version}"`)
  return match.slice(1).map(Number)
}

function compareVersions(a, b) {
  const left = parseVersion(a)
  const right = parseVersion(b)
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index]
  }
  return 0
}

function nextVersion(currentVersion, bump) {
  const [major, minor, patch] = parseVersion(currentVersion)

  if (/^\d+\.\d+\.\d+$/.test(bump)) return bump
  if (bump === 'major') return `${major + 1}.0.0`
  if (bump === 'minor') return `${major}.${minor + 1}.0`
  if (bump === 'patch') return `${major}.${minor}.${patch + 1}`

  fail(`unknown bump "${bump}"`)
}

function run(command, args, { capture = false } = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  })

  if (result.status !== 0) {
    const stderr = result.stderr?.trim()
    if (stderr) console.error(stderr)
    throw new Error(`${command} ${args.join(' ')} failed`)
  }

  return result.stdout?.trim() ?? ''
}

function parseArgs(argv) {
  const options = {
    bump: null,
    distTag: 'latest',
    noBump: false,
    otp: null,
    publish: false,
    yes: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '-h' || arg === '--help') {
      console.log(usage)
      process.exit(0)
    }

    if (arg === '--publish') {
      options.publish = true
      continue
    }

    if (arg === '--yes') {
      options.yes = true
      continue
    }

    if (arg === '--no-bump') {
      options.noBump = true
      continue
    }

    if (arg === '--dist-tag') {
      options.distTag = argv[index + 1]
      index += 1
      if (!options.distTag) fail('--dist-tag needs a value')
      continue
    }

    if (arg === '--otp') {
      options.otp = argv[index + 1]
      index += 1
      if (!options.otp) fail('--otp needs a value')
      continue
    }

    if (arg.startsWith('-')) fail(`unknown option "${arg}"`)
    if (options.bump) fail(`only one bump is allowed; got "${options.bump}" and "${arg}"`)
    options.bump = arg
  }

  if (options.noBump && options.bump) fail('use either --no-bump or a bump, not both')
  if (!options.noBump && !options.bump) fail('missing version bump')
  if (options.publish && !options.yes) fail('real publishing requires --yes')

  return options
}

function updatePackageVersions(version) {
  const pkg = readJson(packagePath)
  pkg.version = version
  writeJson(packagePath, pkg)

  if (fs.existsSync(lockfilePath)) {
    const lockfile = readJson(lockfilePath)
    lockfile.version = version
    if (lockfile.packages?.['']) lockfile.packages[''].version = version
    writeJson(lockfilePath, lockfile)
  }
}

function npmPublishArgs({ distTag, dryRun, otp }) {
  const args = ['publish', '--tag', distTag]
  if (dryRun) args.push('--dry-run')
  if (otp) args.push(`--otp=${otp}`)
  return args
}

function assertCanPublish(packageName) {
  let username = null
  try {
    username = run(npmBin, ['whoami'], { capture: true })
  } catch {
    fail(`npm is not authenticated. Run "npm login --auth-type=web", then retry the publish.`)
  }

  let owners = ''
  try {
    owners = run(npmBin, ['owner', 'ls', packageName], { capture: true })
  } catch {
    fail(`could not read npm owners for ${packageName}. Check npm auth and package permissions.`)
  }

  const ownerNames = owners
    .split('\n')
    .map((line) => line.trim().split(/\s+/)[0])
    .filter(Boolean)

  if (!ownerNames.includes(username)) {
    fail(`npm user "${username}" is not an owner of ${packageName}. Owners: ${ownerNames.join(', ') || 'none'}`)
  }
}

const options = parseArgs(process.argv.slice(2))
const pkg = readJson(packagePath)
const targetVersion = options.noBump ? pkg.version : nextVersion(pkg.version, options.bump)

if (!options.noBump && compareVersions(targetVersion, pkg.version) <= 0) {
  fail(`target version ${targetVersion} must be greater than current version ${pkg.version}`)
}

let publishedVersion = null
try {
  publishedVersion = run(npmBin, ['view', pkg.name, 'version'], { capture: true })
} catch {
  // New packages may not exist on npm yet. npm publish will be the source of truth.
}

if (publishedVersion && compareVersions(targetVersion, publishedVersion) <= 0) {
  fail(`target version ${targetVersion} must be greater than published version ${publishedVersion}`)
}

if (options.publish) {
  assertCanPublish(pkg.name)
}

if (!options.noBump) {
  console.log(`Bumping ${pkg.name} from ${pkg.version} to ${targetVersion}`)
  updatePackageVersions(targetVersion)
} else {
  console.log(`Using existing ${pkg.name} version ${targetVersion}`)
}

run(npmBin, ['run', 'build'])
run(npmBin, ['run', 'build:demo'])
run(npmBin, ['run', 'verify'])

console.log(`Running npm publish dry run for ${pkg.name}@${targetVersion}`)
run(npmBin, npmPublishArgs({ distTag: options.distTag, dryRun: true, otp: options.otp }))

if (options.publish) {
  console.log(`Publishing ${pkg.name}@${targetVersion} to npm with dist-tag "${options.distTag}"`)
  run(npmBin, npmPublishArgs({ distTag: options.distTag, dryRun: false, otp: options.otp }))
} else {
  console.log('')
  console.log('Dry run complete. To publish for real:')
  console.log(`  npm run release -- --no-bump --publish --yes${options.distTag === 'latest' ? '' : ` --dist-tag ${options.distTag}`}`)
}

console.log('')
console.log('Recommended git follow-up:')
console.log('  git add package.json package-lock.json dist/tw-fade.css demo/styles.css')
console.log(`  git commit -m "Release ${targetVersion}"`)
console.log(`  git tag v${targetVersion}`)
console.log('  git push && git push origin --tags')
