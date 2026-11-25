import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { repoRoot, run, transcript } from '../../test/coverage/support/run'

const base = '1111111111111111111111111111111111111111'
const head = '2222222222222222222222222222222222222222'

// A pull request that changes line 4 of src/App.tsx, which no test runs, and line 5, which one does.
function changedLinesDiff(prefixed: boolean): string {
  const from = prefixed ? 'a/src/App.tsx' : 'src/App.tsx'
  const to = prefixed ? 'b/src/App.tsx' : 'src/App.tsx'
  return [`diff --git ${from} ${to}`, 'index 0000000..1111111 100644', `--- ${from}`, `+++ ${to}`, '@@ -4,0 +4,1 @@', '+    <p>new</p>', ''].join('\n')
}

// Runs scripts/coverage-patch.mjs with a fake git on PATH that prints the given diff,
// and with no GitHub token, so that it prints its status and posts nothing.
async function coveragePatch(name: string, diff: string) {
  const work = mkdtempSync(join(tmpdir(), `${name}-`))
  const bin = join(work, 'bin')
  mkdirSync(bin)
  writeFileSync(join(work, 'diff.txt'), diff)
  writeFileSync(join(bin, 'git'), `#!/bin/sh\ncase "$*" in *"diff --unified=0"*"${base}...${head}"*) cat "${join(work, 'diff.txt')}" ;; *) echo "unexpected git $*" >&2; exit 9 ;; esac\n`)
  chmodSync(join(bin, 'git'), 0o755)
  writeFileSync(join(work, 'lcov.info'), ['TN:', 'SF:src/App.tsx', 'DA:4,0', 'DA:5,1', 'end_of_record', ''].join('\n'))
  const result = run('node', [join(repoRoot, 'scripts/coverage-patch.mjs'), base, head, 'lcov.info'], {
    cwd: work,
    env: { PATH: `${bin}:${process.env.PATH}`, COVERAGE_PATCH_MIN: '80', GITHUB_TOKEN: '', GITHUB_REPOSITORY: '' },
  })
  await test.info().attach('git-diff', { body: diff, contentType: 'text/plain' })
  await test.info().attach('lcov', { body: 'SF:src/App.tsx\nDA:4,0\nDA:5,1', contentType: 'text/plain' })
  await test.info().attach('coverage-patch', { body: transcript(result), contentType: 'text/plain' })
  return result
}

test('TC-7 The coverage gate fails a pull request whose changed line no test runs', {
  tag: ['@R-14', '@AC-1'],
  annotation: [
    { type: 'added', description: 'implied requirement: Build added a CI gate on the coverage of changed lines, COVERAGE_PATCH_MIN 80, which no criterion covers' },
    { type: 'stub', description: 'A fake git prints a fixed diff: the run has no git, and the script reads only its output' },
  ],
}, async () => {
  const result = await coveragePatch('tc7', changedLinesDiff(true))
  expect(result.stdout).toContain('coverage/patch: 0% of the changed lines run under a test (0 of 1)')
  expect(result.code, 'the gate fails below 80').toBe(1)
  test.info().annotations.push({ type: 'proof', description: 'With a/ and b/ prefixes, a changed line that no test runs scores 0% of the changed lines (0 of 1) and the gate fails.' })
})

test('TC-8 Without diff prefixes the coverage gate passes a changed line that no test runs', {
  tag: ['@R-14', '@AC-1'],
  annotation: [
    { type: 'added', description: 'edge: Code review finding on scripts/coverage-patch.mjs line 18, git diff output with no a/ and b/ prefixes, as diff.noprefix gives' },
    { type: 'stub', description: 'A fake git prints the diff that diff.noprefix gives: the run has no git, and the script reads only its output' },
  ],
}, async () => {
  const result = await coveragePatch('tc8', changedLinesDiff(false))
  // This proves Code review's finding: the same change as TC-7 scores 100% and passes.
  expect(result.stdout).toContain('coverage/patch: 100% of the changed lines run under a test (no changed line is instrumented)')
  expect(result.code).toBe(0)
  test.info().annotations.push({ type: 'proof', description: 'Proves the Code review fault: with no a/ and b/ prefixes, the change that TC-7 fails scores 100% and the gate passes.' })
})
