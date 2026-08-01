import { spawnSync } from 'node:child_process'

const releaseTarget = process.argv[2]
const allowedBumps = new Set(['patch', 'minor', 'major'])
const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/

if (!releaseTarget || (!allowedBumps.has(releaseTarget) && !semverPattern.test(releaseTarget))) {
  console.error('Usage: pnpm release <patch|minor|major|x.y.z[-prerelease]>')
  process.exit(1)
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
  })

  if (result.error) {
    console.error(`Unable to run ${command}: ${result.error.message}`)
    process.exit(1)
  }
  if (result.status !== 0) process.exit(result.status ?? 1)
  return options.capture ? result.stdout.trim() : ''
}

const branch = run('git', ['branch', '--show-current'], { capture: true })
if (branch !== 'main') {
  console.error(`Release must run from main; current branch is ${branch || '(detached HEAD)'}.`)
  process.exit(1)
}

if (run('git', ['status', '--porcelain'], { capture: true })) {
  console.error('Release requires a clean working tree.')
  process.exit(1)
}

run('git', ['fetch', 'origin', 'main'])
const localHead = run('git', ['rev-parse', 'HEAD'], { capture: true })
const remoteHead = run('git', ['rev-parse', 'origin/main'], { capture: true })
if (localHead !== remoteHead) {
  console.error('Local main must exactly match origin/main before releasing.')
  process.exit(1)
}

run('corepack', ['pnpm', 'test'])
run('corepack', ['pnpm', 'build'])
run('corepack', ['pnpm', 'version', releaseTarget])

const version = JSON.parse(run('git', ['show', 'HEAD:package.json'], { capture: true })).version
console.log(`\nCreated release commit and annotated tag v${version}.`)
console.log('Review them, then publish with:')
console.log('  git push origin main')
console.log(`  git push origin v${version}`)
