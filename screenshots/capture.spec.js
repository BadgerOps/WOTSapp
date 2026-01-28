/**
 * Playwright screenshot and video capture script
 *
 * This script captures screenshots and videos of the WOTS app with mock data
 * for use in the README and documentation.
 *
 * The app must be running in demo mode (VITE_DEMO_MODE=true npm run dev)
 * which injects mock data instead of using Firebase.
 *
 * Run with: npm run screenshots
 */

import { test } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const OUTPUT_DIR = path.join(process.cwd(), 'screenshots', 'output')

// Ensure output directory exists
fs.mkdirSync(OUTPUT_DIR, { recursive: true })

// Helper to wait for app to be ready
async function waitForApp(page) {
  // Wait for the main content area to appear (handles various page layouts)
  await page.waitForSelector('.max-w-4xl, .max-w-md, main, [role="main"]', { timeout: 15000 })
  // Allow animations to settle
  await page.waitForTimeout(800)
}

// Helper to take a screenshot with consistent naming
async function screenshot(page, name, options = {}) {
  const filePath = path.join(OUTPUT_DIR, `${name}.png`)
  await page.screenshot({
    path: filePath,
    fullPage: options.fullPage ?? false,
    animations: 'disabled',
    ...options,
  })
  console.log(`    Captured: ${name}.png`)
  return filePath
}

// Desktop screenshots
test.describe('Desktop Screenshots @desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('login page', async ({ page }) => {
    await page.goto('/login')
    await waitForApp(page)
    await screenshot(page, 'desktop-login')
  })

  test('home page', async ({ page }) => {
    // Use admin demo mode to ensure all features are visible
    await page.goto('/?demo=admin')
    await waitForApp(page)
    await screenshot(page, 'desktop-home')
    await screenshot(page, 'desktop-home-full', { fullPage: true })
  })

  test('admin dashboard - posts tab', async ({ page }) => {
    await page.goto('/admin?demo=admin')
    await waitForApp(page)
    await screenshot(page, 'desktop-admin-posts')
  })

  test('admin dashboard - uotd tab', async ({ page }) => {
    await page.goto('/admin?demo=admin&tab=uotd')
    await waitForApp(page)
    // Click UOTD tab if not auto-selected
    const uotdTab = page.locator('button:has-text("UOTD")')
    if (await uotdTab.isVisible()) {
      await uotdTab.click()
      await page.waitForTimeout(500)
    }
    await screenshot(page, 'desktop-admin-uotd')
  })

  test('admin dashboard - personnel tab', async ({ page }) => {
    await page.goto('/admin?demo=admin&tab=personnel')
    await waitForApp(page)
    // Click Personnel tab
    const personnelTab = page.locator('button:has-text("Personnel")')
    if (await personnelTab.isVisible()) {
      await personnelTab.click()
      await page.waitForTimeout(500)
    }
    await screenshot(page, 'desktop-admin-personnel')
  })

  test('admin dashboard - cq tab', async ({ page }) => {
    await page.goto('/admin?demo=admin&tab=cq')
    await waitForApp(page)
    const cqTab = page.locator('button:has-text("CQ")')
    if (await cqTab.isVisible()) {
      await cqTab.click()
      await page.waitForTimeout(500)
    }
    await screenshot(page, 'desktop-admin-cq')
  })

  test('admin dashboard - details tab', async ({ page }) => {
    await page.goto('/admin?demo=admin&tab=details')
    await waitForApp(page)
    const detailsTab = page.locator('button:has-text("Cleaning Details")')
    if (await detailsTab.isVisible()) {
      await detailsTab.click()
      await page.waitForTimeout(500)
    }
    await screenshot(page, 'desktop-admin-details')
  })

  test('documents page', async ({ page }) => {
    await page.goto('/documents?demo=admin')
    await waitForApp(page)
    await screenshot(page, 'desktop-documents')
  })

  test('my details page', async ({ page }) => {
    await page.goto('/details?demo=admin')
    await waitForApp(page)
    await screenshot(page, 'desktop-my-details')
  })

  test('cq view page', async ({ page }) => {
    await page.goto('/cq?demo=admin')
    await waitForApp(page)
    await screenshot(page, 'desktop-cq-view')
  })
})

// Mobile screenshots
test.describe('Mobile Screenshots @mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('login page - mobile', async ({ page }) => {
    await page.goto('/login')
    await waitForApp(page)
    await screenshot(page, 'mobile-login')
  })

  test('home page - mobile', async ({ page }) => {
    await page.goto('/?demo=admin')
    await waitForApp(page)
    await screenshot(page, 'mobile-home')
  })

  test('admin dashboard - mobile', async ({ page }) => {
    await page.goto('/admin?demo=admin')
    await waitForApp(page)
    await screenshot(page, 'mobile-admin')
  })
})

// Video capture for GIF conversion
// Note: video settings are configured in playwright.config.js for the 'video' project
test.describe('Flow Videos @video', () => {
  test('admin creates post flow', async ({ page }) => {
    // Start at admin dashboard
    await page.goto('/admin?demo=admin')
    await waitForApp(page)
    await page.waitForTimeout(1500)

    // Interact with post composer (simulated for demo)
    const titleInput = page.locator('input[placeholder*="title"], input[name="title"]').first()
    if (await titleInput.isVisible()) {
      await titleInput.fill('New Training Update')
      await page.waitForTimeout(500)
    }

    await page.waitForTimeout(2000)
  })

  test('navigation flow', async ({ page }) => {
    // Home
    await page.goto('/?demo=admin')
    await waitForApp(page)
    await page.waitForTimeout(2000)

    // Documents
    await page.goto('/documents?demo=admin')
    await waitForApp(page)
    await page.waitForTimeout(2000)

    // Details
    await page.goto('/details?demo=admin')
    await waitForApp(page)
    await page.waitForTimeout(2000)
  })
})
