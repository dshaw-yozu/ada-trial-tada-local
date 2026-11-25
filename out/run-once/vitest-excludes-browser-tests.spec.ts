import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { expect, test } from '@playwright/test'
import { repoRoot, run, transcript } from '../../test/coverage/support/run'

test('TC-6 The unit test run does not pick up the browser tests', { tag: ['@R-14', '@R-15', '@AC-1'] }, async () => {
  test.setTimeout(240_000)
  // The repository holds browser tests in e2e/, test/coverage/ and out/run-once/ beside its unit tests in src/.
  const outputFile = join(mkdtempSync(join(tmpdir(), 'tc6-')), 'vitest.json')
  const unit = run('npm', ['test', '--', '--reporter=default', '--reporter=json', `--outputFile.json=${outputFile}`])
  await test.info().attach('vitest', { body: transcript(unit), contentType: 'text/plain' })
  const report = JSON.parse(readFileSync(outputFile, 'utf8'))
  await test.info().attach('vitest-report', { body: JSON.stringify(report, null, 2), contentType: 'application/json' })

  expect(unit.code, 'the run ends with success').toBe(0)
  expect(report.success).toBe(true)
  const files = report.testResults.map((file: { name: string }) => relative(repoRoot, file.name))
  expect(files).toEqual(['src/App.test.tsx'])
  expect(unit.stdout).not.toMatch(/e2e\/|\.spec\.ts/)
  test.info().annotations.push({ type: 'proof', description: 'npm test runs only src/App.test.tsx and passes; no file from e2e/ or any .spec.ts browser test is listed or run.' })
})
