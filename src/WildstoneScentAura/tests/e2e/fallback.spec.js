import { test, expect } from '@playwright/test'

test('denying camera permission falls back to the Touch Canvas screen', async ({ page }) => {
  // No permission granted via context.grantPermissions and no
  // --use-fake-device-for-media-stream flag: getUserMedia rejects with
  // NotAllowedError, same as a real user denying the prompt.
  await page.goto('/')
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.getByText('Camera unavailable')).toBeVisible()
})
