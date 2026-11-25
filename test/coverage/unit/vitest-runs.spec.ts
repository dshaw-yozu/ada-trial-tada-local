import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { run, transcript } from '../support/run'

test('TC-2 The Vitest unit tests run and pass', { tag: ['@R-14', '@AC-1'] }, async () => {
  test.setTimeout(240_000)
  const outputFile = join(mkdtempSync(join(tmpdir(), 'tc2-')), 'vitest.json')
  // The project's own unit test command, with a JSON report beside its usual output.
  const unit = run('npm', ['test', '--', '--reporter=default', '--reporter=json', `--outputFile.json=${outputFile}`])
  await test.info().attach('vitest', { body: transcript(unit), contentType: 'text/plain' })
  const report = JSON.parse(readFileSync(outputFile, 'utf8'))
  await test.info().attach('vitest-report', { body: JSON.stringify(report, null, 2), contentType: 'application/json' })

  expect(unit.code, 'npm test exits with success').toBe(0)
  expect(report.success).toBe(true)
  expect(report.numTotalTests).toBeGreaterThanOrEqual(1)
  expect(report.numPassedTests).toBe(report.numTotalTests)
  expect(report.numFailedTests).toBe(0)
  const titles = report.testResults.flatMap((file: { assertionResults: { fullName: string; status: string }[] }) => file.assertionResults)
  expect(titles).toContainEqual(expect.objectContaining({ fullName: 'App renders the heading', status: 'passed' }))
  test.info().annotations.push({ type: 'proof', description: `npm test runs ${report.numTotalTests} Vitest unit test, App renders the heading, which passes, and the run ends with success.` })
})
