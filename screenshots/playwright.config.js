import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: 'capture.spec.js',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  timeout: 120000,

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'off',
    screenshot: 'off', // We handle screenshots manually
  },

  projects: [
    {
      name: 'desktop',
      grep: /@desktop/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        video: 'off',
      },
    },
    {
      name: 'mobile',
      grep: /@mobile/,
      use: {
        // Use Chrome with mobile viewport instead of WebKit to avoid extra browser install
        ...devices['Desktop Chrome'],
        viewport: { width: 375, height: 667 },
        isMobile: true,
        hasTouch: true,
        video: 'off',
      },
    },
    {
      name: 'video',
      grep: /@video/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        video: 'on',
      },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
})
