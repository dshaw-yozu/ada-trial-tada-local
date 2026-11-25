import { cpSync, mkdirSync, mkdtempSync, readdirSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { repoRoot } from '../../../test/coverage/support/run'

const sources = ['src', 'e2e', 'index.html', 'package.json', 'tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json', 'vite.config.ts', 'vitest.config.ts', 'playwright.config.ts']

// A throwaway copy of the repository: its sources copied, its installed
// packages linked one by one, so that build state lands in the copy's own
// node_modules/.tmp and never in the repository's.
export function throwawayCopy(prefix: string): string {
  const copy = mkdtempSync(join(tmpdir(), `${prefix}-`))
  for (const name of sources) cpSync(join(repoRoot, name), join(copy, name), { recursive: true })
  mkdirSync(join(copy, 'node_modules'))
  for (const name of readdirSync(join(repoRoot, 'node_modules'))) {
    if (name === '.tmp') continue
    symlinkSync(join(repoRoot, 'node_modules', name), join(copy, 'node_modules', name))
  }
  return copy
}
