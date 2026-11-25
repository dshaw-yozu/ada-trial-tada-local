// Reports the coverage of a pull request's changed lines as the commit status `coverage/patch`.
// Usage: node scripts/coverage-patch.mjs <base-sha> <head-sha> [lcov-file]
// With GITHUB_TOKEN and GITHUB_REPOSITORY set it posts the status; otherwise it prints it.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const [base, head, lcovFile = 'coverage/lcov.info'] = process.argv.slice(2)
if (!base || !head) {
  console.error('usage: coverage-patch.mjs <base-sha> <head-sha> [lcov-file]')
  process.exit(2)
}

// Changed lines per file, from the unified diff with no context.
const diff = execFileSync('git', ['diff', '--unified=0', '--no-color', `${base}...${head}`], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
})
const changed = new Map()
let file = null
for (const line of diff.split('\n')) {
  if (line.startsWith('+++ ')) {
    file = line.startsWith('+++ b/') ? resolve(line.slice(6)) : null
  } else if (file && line.startsWith('@@')) {
    const m = /\+(\d+)(?:,(\d+))?/.exec(line)
    const start = Number(m[1])
    const count = m[2] === undefined ? 1 : Number(m[2])
    if (!changed.has(file)) changed.set(file, new Set())
    for (let i = 0; i < count; i++) changed.get(file).add(start + i)
  }
}

// Instrumented lines per file, with their hit counts, from lcov.
const hits = new Map()
let current = null
for (const line of readFileSync(lcovFile, 'utf8').split('\n')) {
  if (line.startsWith('SF:')) {
    current = new Map()
    hits.set(resolve(line.slice(3)), current)
  } else if (line.startsWith('DA:') && current) {
    const [n, count] = line.slice(3).split(',').map(Number)
    current.set(n, count)
  }
}

let total = 0
let covered = 0
for (const [path, lines] of changed) {
  const fileHits = hits.get(path)
  if (!fileHits) continue
  for (const n of lines) {
    if (!fileHits.has(n)) continue
    total++
    if (fileHits.get(n) > 0) covered++
  }
}

const percent = total === 0 ? 100 : Math.floor((covered * 100) / total)
const description =
  total === 0
    ? '100% of the changed lines run under a test (no changed line is instrumented)'
    : `${percent}% of the changed lines run under a test (${covered} of ${total})`
console.log(`coverage/patch: ${description}`)

const { GITHUB_TOKEN, GITHUB_REPOSITORY } = process.env
if (GITHUB_TOKEN && GITHUB_REPOSITORY) {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}/statuses/${head}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ state: 'success', context: 'coverage/patch', description }),
  })
  if (!res.ok) {
    console.error(`could not post the status: ${res.status}`)
    process.exit(1)
  }
}
