import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests.
 *
 * Runs against a real dev server and the development database. Each spec creates
 * its own volunteer with a unique email address, so runs do not collide.
 *
 *   npx playwright install chromium   # once
 *   npm run test:e2e
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],

  // The dev server compiles routes on demand, so the first hit on a route can
  // take several seconds while three projects share one server. These timeouts
  // stop that showing up as a false failure; a production run is far quicker.
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  // Chromium-based devices by default so the suite runs anywhere Chromium is
  // available. Add WebKit/Firefox projects (and `npx playwright install webkit
  // firefox`) in CI for cross-engine coverage.
  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    {
      name: 'tablet',
      use: { ...devices['Desktop Chrome'], viewport: { width: 834, height: 1112 }, isMobile: false },
    },
  ],

  /*
   * The suite shares the development server on port 3000.
   *
   * It cannot have its own: Next 16 refuses to start a second `next dev` for
   * the same project directory — "Another next dev server is already running" —
   * whatever port you give it. So `reuseExistingServer` must stay true, and a
   * run attaches to whatever is already on 3000.
   *
   * Two consequences worth knowing:
   *
   *  - If nothing is running, Playwright starts a server and **stops it again**
   *    when the run finishes. Start your own first if you want it to survive.
   *  - A dev server that has been up for hours degrades: the same suite takes
   *    7.7 minutes against a stale one and 2.3 against a fresh one, and steps
   *    that make several database round trips start exceeding the assertion
   *    timeout. Those failures look like product bugs and are not. Restart
   *    before a run you intend to trust — see docs/TESTING.md.
   */
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 120_000,
      },
})
