import { defineConfig, devices } from '@playwright/test'

/**
 * QW-09: landing-page gates against a production build (`npm run build` first).
 * Uses system Chrome locally if CHROME_PATH is set; CI installs Playwright's Chromium.
 */
const PORT = Number(process.env.GATES_PORT || 3100)

export default defineConfig({
  testDir: 'tests/landing',
  // claims-denylist.spec.ts is a node:test file (npm run test:claims); only the gates run here.
  testMatch: /gates\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices['Desktop Chrome'],
    launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
  },
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
