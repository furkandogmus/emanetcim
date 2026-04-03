import { test, expect } from '@playwright/test';

test.describe('Emanetçi Deep Business Logic', () => {
  // UC_M_04: Valiz adedi ve fiyat (seed: Galata pricePerDay 80 → M=80, sigorta 15)
  test('should show checkout total for default medium bag', async ({ page }) => {
    await page.goto('/tr/search');
    await page.getByTestId('shop-list-item').first().click();
    await expect(page).toHaveURL(/\/tr\/checkout\//);
    await expect(page.locator('text=₺95')).toBeVisible();
  });

  test('should adjust total when bag counts change', async ({ page }) => {
    await page.goto('/tr/search');
    await page.getByTestId('shop-list-item').first().click();
    await expect(page).toHaveURL(/\/tr\/checkout\//);

    await page.getByRole('button', { name: 'Increase' }).nth(0).click();
    await expect(page.locator('text=₺159')).toBeVisible();

    await page.getByRole('button', { name: 'Increase' }).nth(2).click();
    await expect(page.locator('text=₺279')).toBeVisible();
  });

  test('Guest: demo login and see seeded booking', async ({ page }) => {
    await page.goto('/tr/login');
    await page.getByRole('button', { name: 'Misafir Demo' }).first().click();
    await expect(page).toHaveURL(/\/tr\/bookings/, { timeout: 20000 });
    await expect(page.getByText(/Galata Gift/i).first()).toBeVisible();
  });

  test('Partner: settings capacity UI', async ({ page }) => {
    await page.goto('/tr/login');
    await page.getByText('Esnaf Girişi').click();
    await expect(page).toHaveURL(/\/tr\/partner/, { timeout: 20000 });
    await page.goto('/tr/partner/settings');
    await expect(page.getByText('15', { exact: true }).first()).toBeVisible();
  });
});
