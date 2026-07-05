import { test, expect } from '@playwright/test'

test('Touch Canvas fallback is messaging/insurance only -- no capture button', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.getByText('Camera unavailable')).toBeVisible()

  // Capture/share is gated on a real camera feed -- the fallback only
  // conveys that the camera is required and offers the finger-drag aura
  // to play with meanwhile.
  await expect(page.getByRole('button', { name: 'Capture' })).toHaveCount(0)
})

// The camera-branch capture -> preview -> share flow (CapturePreviewScreen.js,
// ShareScreen.js) isn't covered by an automated e2e test here -- Playwright's
// default browser has no fake camera device wired into this project's
// config, so getUserMedia can only fail (see fallback.spec.js), never
// succeed. See PROGRESS.md for this tracked gap.
