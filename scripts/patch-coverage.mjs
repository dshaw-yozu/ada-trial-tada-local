// Prints the share of changed lines that run under a test, from coverage/lcov.info.
// Usage: node scripts/patch-coverage.mjs <base-sha>
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const base = process.argv[2]
if (!base) {
  console.error('usage: node scripts/patch-coverage.mjs <base-sha>')
  process.exit(2)
}

// Lines each file added, from the zero-context diff's hunk headers.
const diff = execFileSync('git', ['diff', '-U0', '--no-color', `${base}...HEAD`], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
})
const changed = new Map()
let file = null
for (const line of diff.split('\n')) {
  if (line.startsWith('+++ ')) {
    file = line.startsWith('+++ b/') ? line.slice(6) : null
  } else if (file && line.startsWith('@@')) {
    const m = /\+(\d+)(?:,(\d+))?/.exec(line)
    const start = Number(m[1])
    const count = m[2] === undefined ? 1 : Number(m[2])
    if (!changed.has(file)) changed.set(file, new Set())
    for (let n = start; n < start + count; n++) changed.get(file).add(n)
  }
}

// Hit counts of each instrumented line, per file, from the lcov report.
const hits = new Map()
let current = null
for (const line of readFileSync('coverage/lcov.info', 'utf8').split('\n')) {
  if (line.startsWith('SF:')) {
    current = path.relative(process.cwd(), path.resolve(line.slice(3))).split(path.sep).join('/')
    hits.set(current, new Map())
  } else if (current && line.startsWith('DA:')) {
    const [n, count] = line.slice(3).split(',').map(Number)
    hits.get(current).set(n, count)
  }
}

let total = 0
let covered = 0
for (const [name, lines] of changed) {
  const fileHits = hits.get(name)
  if (!fileHits) continue
  for (const n of lines) {
    if (!fileHits.has(n)) continue
    total++
    if (fileHits.get(n) > 0) covered++
  }
}

const percent = total === 0 ? 100 : Math.floor((covered * 100) / total)
console.log(`${percent}% of the changed lines run under a test`)
