import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { run, transcript } from '../../../test/coverage/support/run'

test.use({ video: 'on' })

test('walkthrough D-1', async ({ page }) => {
  test.setTimeout(240_000)
  const began = Date.now()

  // R-13, AC-1 through TC-1: the app builds, and the built page shows the heading React draws.
  const start = Date.now() - began
  const build = run('npm', ['run', 'build', '--', '--outDir', mkdtempSync(join(tmpdir(), 'walkthrough-dist-')), '--emptyOutDir'])
  await test.info().attach('build', { body: transcript(build), contentType: 'text/plain' })
  expect(build.code).toBe(0)
  const served = await page.goto('/')
  expect(served!.status()).toBe(200)
  expect(await served!.text()).toContain('<div id="root"></div>')
  const heading = page.locator('#root').getByRole('heading', { level: 1, name: 'Ada trial' })
  await expect(heading).toBeVisible()
  expect(await page.locator('#root').evaluate((root) => Object.keys(root).some((key) => key.startsWith('__reactContainer$')))).toBe(true)
  const end = Date.now() - began
  await test.info().attach('AC-1', { body: await page.screenshot(), contentType: 'image/png' })
  test.info().annotations.push({ type: 'mark', description: `AC-1 TC-1 ${start}-${end}` })
})
