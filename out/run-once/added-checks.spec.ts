import { spawn } from 'node:child_process'
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { describeResult, freshCopy, run } from '../../test/coverage/support/fresh-copy'

test.setTimeout(300_000)

function portIsFree(port: number) {
  return new Promise<boolean>((resolve) => {
    const server = createServer()
    server.once('error', () => resolve(false))
    server.listen(port, () => server.close(() => resolve(true)))
  })
}

async function installedCopy() {
  const { dir, install } = freshCopy()
  await test.info().attach('install', { body: describeResult(install), contentType: 'text/plain' })
  expect(install.status).toBe(0)
  return dir
}

test(
  'TC-6 The unit run prints a React act warning from the main entry test',
  {
    tag: ['@R-14', '@AC-1'],
    annotation: [{ type: 'added', description: 'Code review finding on src/App.test.tsx line 14: the main entry test leaves the React root it mounts; this check shows the warning a developer sees' }],
  },
  async () => {
    const dir = await installedCopy()
    // Vitest's default reporter hides the console output of passing tests; the verbose one shows it.
    const unit = run(dir, 'npm test -- --reporter=verbose')
    await test.info().attach('unit run', { body: describeResult(unit), contentType: 'text/plain' })
    expect(unit.status).toBe(0)
    expect(unit.output).toContain('stderr | src/App.test.tsx > main entry > mounts the app into the root element')
    expect(unit.output).toContain('An update to Root inside a test was not wrapped in act(...).')
    test.info().annotations.push({
      type: 'proof',
      description: 'The unit run passes, but with verbose output it prints "An update to Root inside a test was not wrapped in act(...)" from the main entry test, whose React root is never unmounted.',
    })
  },
)

test(
  'TC-7 The browser test command builds the app again after a build',
  {
    tag: ['@R-15', '@AC-1'],
    annotation: [{ type: 'added', description: 'Code review finding on playwright.config.ts line 14: CI builds, then the browser tests build again' }],
  },
  async () => {
    const dir = await installedCopy()
    // As CI does: build, then run the browser tests.
    const build = run(dir, 'npm run build')
    await test.info().attach('build', { body: describeResult(build), contentType: 'text/plain' })
    expect(build.status).toBe(0)
    const firstBuild = statSync(join(dir, 'dist', 'index.html')).mtimeMs
    expect(await portIsFree(4173)).toBe(true)
    const e2e = run(dir, 'npm run test:e2e')
    await test.info().attach('browser run', { body: describeResult(e2e), contentType: 'text/plain' })
    expect(e2e.status).toBe(0)
    const secondBuild = statSync(join(dir, 'dist', 'index.html')).mtimeMs
    await test.info().attach('state', {
      body: JSON.stringify({ 'dist/index.html written after npm run build': new Date(firstBuild).toISOString(), 'dist/index.html written after npm run test:e2e': new Date(secondBuild).toISOString() }, null, 2),
      contentType: 'application/json',
    })
    expect(secondBuild).toBeGreaterThan(firstBuild)
    test.info().annotations.push({
      type: 'proof',
      description: 'After npm run build, npm run test:e2e writes dist/index.html again: the browser tests rebuild the app, so CI builds twice.',
    })
  },
)

test(
  'TC-8 The unit tests cannot load when packages are installed without peer dependencies',
  {
    tag: ['@R-14', '@AC-1'],
    annotation: [{ type: 'added', description: 'Code review finding on package.json line 21: @testing-library/dom is used but only installed as a peer; npm legacy-peer-deps is a common setting' }],
  },
  async () => {
    const { dir } = freshCopy()
    const install = run(dir, 'rm -rf node_modules && npm ci --legacy-peer-deps --no-audit --no-fund')
    await test.info().attach('install with legacy peer deps', { body: describeResult(install), contentType: 'text/plain' })
    expect(install.status).toBe(0)
    expect(existsSync(join(dir, 'node_modules', '@testing-library', 'dom'))).toBe(false)
    const unit = run(dir, 'npm test')
    await test.info().attach('unit run', { body: describeResult(unit), contentType: 'text/plain' })
    expect(unit.status).not.toBe(0)
    expect(unit.output).toContain("Error: Cannot find package '@testing-library/dom'")
    expect(unit.output).toMatch(/Test Files\s+1 failed \(1\)/)
    test.info().annotations.push({
      type: 'proof',
      description: "Installed with npm's legacy peer setting, the unit run fails: \"Cannot find package '@testing-library/dom'\", because package.json does not list it.",
    })
  },
)

test(
  'TC-9 The development server shows the React page',
  {
    tag: ['@R-13', '@AC-1'],
    annotation: [{ type: 'added', description: 'exploratory: the change adds npm run dev, which developers use for every later Workstream' }],
  },
  async ({ page }) => {
    const dir = await installedCopy()
    const port = 5199
    expect(await portIsFree(port)).toBe(true)
    const server = spawn('npm', ['run', 'dev', '--', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], {
      cwd: dir,
      env: { ...process.env, NO_COLOR: '1' },
      // Its own process group, so stopping it stops Vite under npm too.
      detached: true,
    })
    let log = ''
    server.stdout.on('data', (chunk) => (log += chunk))
    server.stderr.on('data', (chunk) => (log += chunk))
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(`page error: ${err.message}`))
    page.on('console', (msg) => msg.type() === 'error' && errors.push(`console error: ${msg.text()}`))
    try {
      await expect.poll(() => log, { timeout: 60_000 }).toContain(`http://127.0.0.1:${port}/`)
      // The developer's own local server, not the QA environment.
      await page.goto(`http://127.0.0.1:${port}/`)
      const heading = page.locator('#root').getByRole('heading', { level: 1, name: 'Ada trial' })
      await expect(heading).toBeVisible()
      await test.info().attach('screenshot', { body: await page.screenshot(), contentType: 'image/png' })
      if (errors.length) await test.info().attach('console', { body: errors.join('\n'), contentType: 'text/plain' })
      expect(errors).toEqual([])
    } finally {
      process.kill(-server.pid!)
      await test.info().attach('dev server', { body: log, contentType: 'text/plain' })
    }
    test.info().annotations.push({
      type: 'proof',
      description: 'npm run dev starts Vite, and React draws the "Ada trial" heading in the browser with no console error.',
    })
  },
)

test(
  'TC-10 The unit run writes the coverage file the CI coverage step reads',
  {
    tag: ['@R-14', '@AC-1'],
    annotation: [{ type: 'added', description: 'caller: scripts/patch-coverage.mjs reads coverage/lcov.info for SF and DA lines of repository-relative paths' }],
  },
  async () => {
    const dir = await installedCopy()
    const unit = run(dir, 'npm test')
    await test.info().attach('unit run', { body: describeResult(unit), contentType: 'text/plain' })
    expect(unit.status).toBe(0)
    const lcov = readFileSync(join(dir, 'coverage', 'lcov.info'), 'utf8')
    await test.info().attach('coverage/lcov.info', { body: lcov, contentType: 'text/plain' })
    const files = [...lcov.matchAll(/^SF:(.+)$/gm)].map((m) => m[1])
    expect(files).toEqual(expect.arrayContaining(['src/App.tsx', 'src/main.tsx']))
    expect(lcov).toMatch(/SF:src\/App\.tsx[\s\S]*?DA:\d+,[1-9]\d*/)
    expect(lcov).toMatch(/SF:src\/main\.tsx[\s\S]*?DA:\d+,[1-9]\d*/)
    test.info().annotations.push({
      type: 'proof',
      description: 'npm test writes coverage/lcov.info naming src/App.tsx and src/main.tsx by repository path, with hit lines, as the coverage step reads it.',
    })
  },
)

test(
  'TC-11 A failing unit test makes the unit run fail',
  {
    tag: ['@R-14', '@AC-1'],
    annotation: [{ type: 'added', description: 'negative: a harness that passes whatever the tests say would prove nothing' }],
  },
  async () => {
    const dir = await installedCopy()
    writeFileSync(
      join(dir, 'src', 'Broken.test.tsx'),
      "import { render, screen } from '@testing-library/react'\nimport App from './App'\n\nit('shows a heading the app does not have', () => {\n  render(<App />)\n  expect(screen.getByRole('heading', { name: 'Not the app' })).toBeInTheDocument()\n})\n",
    )
    const unit = run(dir, 'npm test')
    await test.info().attach('unit run', { body: describeResult(unit), contentType: 'text/plain' })
    expect(unit.status).not.toBe(0)
    expect(unit.output).toMatch(/FAIL\s+src\/Broken\.test\.tsx > shows a heading the app does not have/)
    expect(unit.output).toMatch(/Tests\s+1 failed \| 2 passed \(3\)/)
    test.info().annotations.push({
      type: 'proof',
      description: 'With one failing unit test added, npm test reports "1 failed | 2 passed" and exits with a failure.',
    })
  },
)

test(
  'TC-12 A failing browser test makes the browser run fail',
  {
    tag: ['@R-15', '@AC-1'],
    annotation: [{ type: 'added', description: 'negative: a harness that passes whatever the tests say would prove nothing' }],
  },
  async () => {
    const dir = await installedCopy()
    writeFileSync(
      join(dir, 'e2e', 'broken.spec.ts'),
      "import { expect, test } from '@playwright/test'\n\ntest('shows a heading the app does not have', async ({ page }) => {\n  await page.goto('/')\n  await expect(page.getByRole('heading', { name: 'Not the app' })).toBeVisible({ timeout: 2000 })\n})\n",
    )
    expect(await portIsFree(4173)).toBe(true)
    const e2e = run(dir, 'npm run test:e2e')
    await test.info().attach('browser run', { body: describeResult(e2e), contentType: 'text/plain' })
    expect(e2e.status).not.toBe(0)
    expect(e2e.output).toMatch(/1 failed[\s\S]*broken\.spec\.ts[\s\S]*shows a heading the app does not have/)
    expect(e2e.output).toMatch(/1 passed/)
    test.info().annotations.push({
      type: 'proof',
      description: 'With one failing browser test added, npm run test:e2e reports 1 failed and 1 passed and exits with a failure.',
    })
  },
)
