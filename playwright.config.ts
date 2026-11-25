import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: { baseURL: 'http://localhost:4173' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `${process.env.CI ? '' : 'npm run build && '}npm run preview -- --port 4173 --strictPort`,
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
})
