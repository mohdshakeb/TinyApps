import { test, expect } from '@playwright/test'

test('fallback branch: capture -> preview -> share -> back to fallback', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.getByText('Camera unavailable')).toBeVisible()

  await page.getByRole('button', { name: 'Capture' }).click()
  await expect(page.getByRole('button', { name: 'Use Photo' })).toBeVisible()
  await expect(page.locator('.preview-image')).toBeVisible()

  await page.getByRole('button', { name: 'Use Photo' }).click()
  await expect(page.getByRole('button', { name: 'Share' })).toBeVisible()

  // navigator.share/canShare is unavailable in this headless context, so
  // shareOrDownload() falls through to the download-link path -- exercises
  // that branch without depending on OS share-sheet UI.
  await page.getByRole('button', { name: 'Share' }).click()

  await page.getByRole('button', { name: 'Done' }).click()
  // DONE returns to whichever branch the capture originated from (the
  // origin-tracking fix in appStateMachine.js) -- here, back to the fallback
  // screen, not a LIVE_AURA state that needs a camera this run never had.
  await expect(page.getByText('Camera unavailable')).toBeVisible()
})

test('retry discards the capture and returns to the same branch', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.getByText('Camera unavailable')).toBeVisible()

  await page.getByRole('button', { name: 'Capture' }).click()
  await page.getByRole('button', { name: 'Retry' }).click()
  await expect(page.getByText('Camera unavailable')).toBeVisible()
})
