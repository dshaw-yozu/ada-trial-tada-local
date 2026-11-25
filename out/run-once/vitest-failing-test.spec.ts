import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { run, transcript } from '../../test/coverage/support/run'
import { throwawayCopy } from './support/copy'

test('TC-5 A failing unit test makes the Vitest run fail', { tag: ['@R-14', '@AC-1'] }, async () => {
  test.setTimeout(240_000)
  const copy = throwawayCopy('tc5')
  // A sum test in the copy, changed to expect 5 for 2 and 2.
  writeFileSync(join(copy, 'src/sum.test.ts'), "describe('sum', () => {\n  it('adds 2 and 2', () => {\n    expect(2 + 2).toBe(5)\n  })\n})\n")
  const unit = run('npm', ['test', '--', '--reporter=default', '--reporter=json', '--outputFile.json=vitest.json'], { cwd: copy })
  await test.info().attach('vitest', { body: transcript(unit), contentType: 'text/plain' })
  const report = JSON.parse(readFileSync(join(copy, 'vitest.json'), 'utf8'))
  await test.info().attach('vitest-report', { body: JSON.stringify(report, null, 2), contentType: 'application/json' })

  expect(unit.code, 'the run ends with a failure status').not.toBe(0)
  expect(report.success).toBe(false)
  expect(report.numFailedTests).toBe(1)
  const results = report.testResults.flatMap((file: { assertionResults: { fullName: string; status: string }[] }) => file.assertionResults)
  expect(results).toContainEqual(expect.objectContaining({ fullName: 'sum adds 2 and 2', status: 'failed' }))
  expect(results).toContainEqual(expect.objectContaining({ fullName: 'App renders the heading', status: 'passed' }))
  expect(unit.stdout + unit.stderr).toContain('FAIL  src/sum.test.ts > sum > adds 2 and 2')
  expect(unit.stdout + unit.stderr).toMatch(/expected 4 to be 5/)
  test.info().annotations.push({ type: 'proof', description: 'With one test expecting 5 for 2 plus 2, npm test names FAIL src/sum.test.ts > sum > adds 2 and 2, expected 4 to be 5, and ends with a failure status.' })
})
