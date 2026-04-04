import { test, expect } from '@playwright/test';

test.describe('Admin — platform settings', () => {
  test('Admin demo ile platform ayarları sayfası yüklenir', async ({ page }) => {
    await page.goto('/tr/login');
    await page.getByText('Admin Girişi').click();
    await expect(page).toHaveURL(/\/tr\/admin/, { timeout: 20_000 });

    await page.goto('/tr/admin/platform-settings');
    await expect(page.getByRole('heading', { name: /platform ayarları/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('button', { name: /KAYDET/i })).toBeVisible();
  });
});
