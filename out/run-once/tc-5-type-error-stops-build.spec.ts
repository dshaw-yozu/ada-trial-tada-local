import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { describeResult, freshCopy, run } from '../../test/coverage/support/fresh-copy'

test('TC-5 A type error in the sources stops the build', { tag: ['@R-13', '@AC-1'] }, async () => {
  test.setTimeout(300_000)

  // Given a throwaway copy where App passes a number to a component that expects text.
  const { dir, install } = freshCopy()
  await test.info().attach('install', { body: describeResult(install), contentType: 'text/plain' })
  expect(install.status).toBe(0)
  const appPath = join(dir, 'src', 'App.tsx')
  const original = readFileSync(appPath, 'utf8')
  const broken = original
    .replace('<h1>Ada trial</h1>', '<Title text={42} />')
    .concat('\nfunction Title({ text }: { text: string }) {\n  return <h1>{text}</h1>\n}\n')
  expect(broken).not.toBe(original)
  writeFileSync(appPath, broken)
  await test.info().attach('src/App.tsx with the type error', { body: broken, contentType: 'text/plain' })

  // When a developer runs the project's build.
  const build = run(dir, 'npm run build')
  await test.info().attach('build', { body: describeResult(build), contentType: 'text/plain' })

  // Then the build reports the type error and does not succeed.
  expect(build.status, 'the build fails').not.toBe(0)
  expect(build.output).toMatch(/src\/App\.tsx\(\d+,\d+\): error TS2322: Type 'number' is not assignable to type 'string'\./)
  expect(build.output).not.toMatch(/built in/)
  expect(existsSync(join(dir, 'dist')), 'no app is built').toBe(false)

  test.info().annotations.push({
    type: 'proof',
    description: 'With a number passed where App expects text, npm run build stops with error TS2322 in src/App.tsx, exits with a failure and builds no app.',
  })
})
