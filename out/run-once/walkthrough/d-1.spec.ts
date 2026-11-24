import { expect, test } from '@playwright/test'
import { describeResult, freshCopy, run } from '../../../test/coverage/support/fresh-copy'

test.use({ video: 'on' })

test('walkthrough D-1', { tag: ['@R-13', '@AC-1'] }, async ({ page }) => {
  test.setTimeout(300_000)
  const began = Date.now()

  // Chapter R-13, AC-1 through TC-1: a fresh copy builds with Vite, and the built app shows React's page.
  const start = Date.now() - began
  const { dir, install } = freshCopy()
  expect(install.status).toBe(0)
  const build = run(dir, 'npm run build')
  await test.info().attach('build', { body: describeResult(build), contentType: 'text/plain' })
  expect(build.status).toBe(0)
  const builtScript = build.output.match(/dist(\/assets\/index-[\w-]+\.js)/)?.[1]
  expect(builtScript).toBeTruthy()

  const response = await page.goto('/')
  expect(await response!.text()).toContain(`src="${builtScript}"`)
  await expect(page.locator('#root').getByRole('heading', { level: 1, name: 'Ada trial' })).toBeVisible()
  await test.info().attach('AC-1', { body: await page.screenshot(), contentType: 'image/png' })
  test.info().annotations.push({ type: 'mark', description: `AC-1 TC-1 ${start}-${Date.now() - began}` })
})
