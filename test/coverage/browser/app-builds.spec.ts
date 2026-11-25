import { mkdtempSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { run, transcript } from '../support/run'

// Each screen width users use: the app has one theme.
const widths = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
]

test('TC-1 The app builds and the built page shows React-drawn content', { tag: ['@R-13', '@AC-1'] }, async ({ page }) => {
  test.setTimeout(240_000)
  // The build, as a developer runs it, into a throwaway folder.
  const outDir = mkdtempSync(join(tmpdir(), 'tc1-dist-'))
  const build = run('npm', ['run', 'build', '--', '--outDir', outDir, '--emptyOutDir'])
  await test.info().attach('build', { body: transcript(build), contentType: 'text/plain' })
  expect(build.code, 'npm run build exits with success').toBe(0)
  expect(build.stdout + build.stderr).not.toMatch(/error TS\d+/)
  const bundles = readdirSync(join(outDir, 'assets')).filter((name) => /^index-.+\.js$/.test(name))
  expect(bundles).toHaveLength(1)
  const builtHtml = readFileSync(join(outDir, 'index.html'), 'utf8')
  expect(builtHtml).toContain(`/assets/${bundles[0]}`)

  const consoleLines: string[] = []
  page.on('console', (message) => { if (message.type() === 'error') consoleLines.push(`console error: ${message.text()}`) })
  page.on('pageerror', (error) => consoleLines.push(`page error: ${error.message}`))
  page.on('requestfailed', (failed) => consoleLines.push(`failed request: ${failed.url()} ${failed.failure()?.errorText}`))

  for (const size of widths) {
    await page.setViewportSize({ width: size.width, height: size.height })
    // The page as the server sends it holds no heading: only an empty root and the bundle just built.
    const served = await page.goto('/')
    expect(served).not.toBeNull()
    const servedHtml = await served!.text()
    await test.info().attach(`response-${size.name}`, { body: `GET / ${served!.status()}\n\n${servedHtml}`, contentType: 'text/plain' })
    expect(served!.status()).toBe(200)
    expect(servedHtml).toContain('<div id="root"></div>')
    expect(servedHtml).not.toContain('<h1')
    expect(servedHtml).toContain(`/assets/${bundles[0]}`)

    const heading = page.locator('#root').getByRole('heading', { level: 1, name: 'Ada trial' })
    await expect(heading).toBeVisible()
    // React's createRoot marks the container it renders into.
    const reactOwnsRoot = await page.locator('#root').evaluate((root) => Object.keys(root).some((key) => key.startsWith('__reactContainer$')))
    expect(reactOwnsRoot, 'React rendered into #root').toBe(true)
    await test.info().attach(`screenshot-${size.name}`, { body: await page.screenshot(), contentType: 'image/png' })
  }

  if (consoleLines.length > 0) await test.info().attach('console', { body: consoleLines.join('\n'), contentType: 'text/plain' })
  expect(consoleLines).toEqual([])
  await test.info().attach('screenshot', { body: await page.screenshot(), contentType: 'image/png' })
  test.info().annotations.push({ type: 'proof', description: `The build ends with success and makes ${bundles[0]}; the app serves that bundle, and React draws the heading Ada trial into the page's empty root at desktop and mobile widths.` })
})
