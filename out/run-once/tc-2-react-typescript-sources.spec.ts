import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { expect, test } from '@playwright/test'
import { repoRoot } from '../../test/coverage/support/fresh-copy'

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? filesUnder(join(dir, entry.name)) : [join(dir, entry.name)],
  )
}

test(
  'TC-2 The sources are React and TypeScript',
  {
    tag: ['@R-13', '@AC-1'],
    annotation: [
      {
        type: 'manual',
        description:
          'A person reads src/App.tsx and src/main.tsx (attached) and judges that they are React components written in TypeScript, built with Vite. This test gathers the files and checks the facts a machine can.',
      },
    ],
  },
  async () => {
    const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'))
    const sources = filesUnder(join(repoRoot, 'src')).map((file) => relative(repoRoot, file))
    const app = readFileSync(join(repoRoot, 'src', 'App.tsx'), 'utf8')
    const main = readFileSync(join(repoRoot, 'src', 'main.tsx'), 'utf8')
    const viteConfig = readFileSync(join(repoRoot, 'vite.config.ts'), 'utf8')
    const indexHtml = readFileSync(join(repoRoot, 'index.html'), 'utf8')

    await test.info().attach('source files', { body: sources.join('\n'), contentType: 'text/plain' })
    await test.info().attach('src/App.tsx', { body: app, contentType: 'text/plain' })
    await test.info().attach('src/main.tsx', { body: main, contentType: 'text/plain' })
    await test.info().attach('dependencies', {
      body: JSON.stringify({ scripts: pkg.scripts, dependencies: pkg.dependencies, devDependencies: pkg.devDependencies }, null, 2),
      contentType: 'application/json',
    })

    // Every source file is TypeScript; none is plain JavaScript.
    expect(sources.length).toBeGreaterThan(0)
    expect(sources.filter((file) => !/\.tsx?$/.test(file))).toEqual([])
    expect(sources).toContain('src/App.tsx')

    // The components are React: React draws the app into the root, and the app is JSX.
    expect(main).toContain("from 'react-dom/client'")
    expect(main).toMatch(/createRoot\(document\.getElementById\('root'\)!\)\.render\(/)
    expect(app).toMatch(/export default function App\(\)/)
    expect(app).toContain('<h1>Ada trial</h1>')
    expect(Object.keys(pkg.dependencies)).toEqual(expect.arrayContaining(['react', 'react-dom']))
    for (const other of ['vue', 'svelte', 'preact', '@angular/core', 'solid-js', 'lit']) {
      expect(pkg.dependencies[other] ?? pkg.devDependencies[other], `no ${other}`).toBeUndefined()
    }

    // TypeScript checks the sources and Vite builds them.
    expect(Object.keys(pkg.devDependencies)).toEqual(expect.arrayContaining(['typescript', 'vite', '@vitejs/plugin-react']))
    expect(pkg.scripts.build).toBe('tsc -b && vite build')
    expect(viteConfig).toContain('plugins: [react()]')
    expect(indexHtml).toContain('src="/src/main.tsx"')

    test.info().annotations.push({
      type: 'proof',
      description: `All ${sources.length} files in src are TypeScript; main.tsx draws the App component with React's createRoot, and the build script runs the TypeScript check then vite build.`,
    })
  },
)
