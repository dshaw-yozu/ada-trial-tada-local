import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))

export type RunResult = { command: string; code: number | null; stdout: string; stderr: string }

// Runs a command as a developer would type it, without the outer Playwright
// worker's own variables, so a nested test runner starts clean.
export function run(command: string, args: string[], options: { cwd?: string; env?: Record<string, string> } = {}): RunResult {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined) continue
    if (key.startsWith('TEST_') || key.startsWith('PW_') || key.startsWith('PLAYWRIGHT_')) continue
    env[key] = value
  }
  env.FORCE_COLOR = '0'
  env.NO_COLOR = '1'
  Object.assign(env, options.env ?? {})
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env,
    encoding: 'utf8',
    timeout: 240_000,
    maxBuffer: 64 * 1024 * 1024,
  })
  return {
    command: [command, ...args].join(' '),
    code: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

export function transcript(result: RunResult): string {
  return `$ ${result.command}\nexit ${result.code}\n--- stdout ---\n${result.stdout}\n--- stderr ---\n${result.stderr}`
}
