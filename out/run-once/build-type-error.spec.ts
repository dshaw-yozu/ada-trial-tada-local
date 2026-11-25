import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { run, transcript } from '../../test/coverage/support/run'
import { throwawayCopy } from './support/copy'

test('TC-4 A type error in a TypeScript source stops the build', { tag: ['@R-13', '@AC-1'] }, async () => {
  test.setTimeout(240_000)
  const copy = throwawayCopy('tc4')

  // Control: the untouched copy builds, so a failure below comes from the edit alone.
  const control = run('npm', ['run', 'build'], { cwd: copy })
  await test.info().attach('control-build', { body: transcript(control), contentType: 'text/plain' })
  expect(control.code, 'the untouched copy builds').toBe(0)

  // The deliberate mismatch: the number 42 given to a text-only value.
  appendFileSync(join(copy, 'src/App.tsx'), '\nexport const title: string = 42\n')
  await test.info().attach('edited-source', { body: readFileSync(join(copy, 'src/App.tsx'), 'utf8'), contentType: 'text/plain' })
  const broken = run('npm', ['run', 'build', '--', '--outDir', 'dist-broken'], { cwd: copy })
  await test.info().attach('build', { body: transcript(broken), contentType: 'text/plain' })

  expect(broken.code, 'the build ends with a failure status').not.toBe(0)
  const output = broken.stdout + broken.stderr
  expect(output).toMatch(/src\/App\.tsx\(9,14\): error TS2322: Type 'number' is not assignable to type 'string'\./)
  expect(existsSync(join(copy, 'dist-broken')), 'Vite made no bundle').toBe(false)
  test.info().annotations.push({ type: 'proof', description: "The build of the copy with 42 given to a text value fails with error TS2322 Type 'number' is not assignable to type 'string' in src/App.tsx, and makes no bundle; the same copy without the edit builds." })
})
