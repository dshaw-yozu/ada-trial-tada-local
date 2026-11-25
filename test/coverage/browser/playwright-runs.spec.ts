import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { repoRoot, run, transcript } from '../support/run'

test('TC-3 The Playwright browser tests run against the app and pass', { tag: ['@R-15', '@AC-1'] }, async ({ page, baseURL }) => {
  test.setTimeout(240_000)
  // The project's browser tests, e2e/, run by Playwright against the app this test reaches.
  const work = mkdtempSync(join(tmpdir(), 'tc3-'))
  const config = join(work, 'playwright.config.mjs')
  writeFileSync(config, `export default ${JSON.stringify({
    testDir: join(repoRoot, 'e2e'),
    outputDir: join(work, 'results'),
    retries: 0,
    reporter: [['json', { outputFile: join(work, 'report.json') }], ['list']],
    use: { baseURL },
  })}\n`)
  const browser = run('npx', ['playwright', 'test', `--config=${config}`])
  await test.info().attach('playwright', { body: transcript(browser), contentType: 'text/plain' })
  const report = JSON.parse(readFileSync(join(work, 'report.json'), 'utf8'))
  await test.info().attach('playwright-report', { body: JSON.stringify(report, null, 2), contentType: 'application/json' })

  expect(browser.code, 'the browser test run exits with success').toBe(0)
  expect(report.stats.expected).toBeGreaterThanOrEqual(1)
  expect(report.stats.unexpected).toBe(0)
  expect(report.stats.flaky).toBe(0)
  expect(report.stats.skipped).toBe(0)
  const specs = report.suites.flatMap((suite: { file: string; specs: { title: string; ok: boolean }[] }) => suite.specs.map((spec) => ({ file: suite.file, title: spec.title, ok: spec.ok })))
  expect(specs).toContainEqual({ file: 'app.spec.ts', title: 'the built app renders its heading', ok: true })

  // What that browser test checked, seen here too.
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Ada trial' })).toBeVisible()
  await test.info().attach('screenshot', { body: await page.screenshot(), contentType: 'image/png' })
  test.info().annotations.push({ type: 'proof', description: `Playwright runs ${report.stats.expected} browser test from e2e/, the built app renders its heading, against the app in a real browser; it passes and the run ends with success.` })
})
