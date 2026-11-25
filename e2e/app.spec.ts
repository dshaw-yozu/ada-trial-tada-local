import { expect, test } from '@playwright/test'

test('the built app renders its heading', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Ada trial' })).toBeVisible()
})
