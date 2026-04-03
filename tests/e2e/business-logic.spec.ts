import { test, expect } from '@playwright/test';

test.describe('Emanetçi Deep Business Logic', () => {
  // UC_M_04: Valiz adedi ve fiyat (seed: Galata pricePerDay 80 → M=80, sigorta 15)
  test('should show checkout total for default medium bag (1 day)', async ({ page }) => {
    await page.goto('/tr/search');
    await page.getByTestId('shop-list-item').first().click();
    await expect(page).toHaveURL(/\/tr\/checkout\//);
    await expect(page.getByTestId('checkout-total-amount')).toHaveText('₺95');
  });

  test('should adjust total when bag counts change', async ({ page }) => {
    await page.goto('/tr/search');
    await page.getByTestId('shop-list-item').first().click();
    await expect(page).toHaveURL(/\/tr\/checkout\//);

    await page.getByRole('button', { name: 'Increase' }).nth(0).click();
    await expect(page.getByTestId('checkout-total-amount')).toHaveText('₺159');

    await page.getByRole('button', { name: 'Increase' }).nth(2).click();
    await expect(page.getByTestId('checkout-total-amount')).toHaveText('₺279');
  });

  test('multi-day stay increases service total (3 days, 1×M: 80×3 + 15)', async ({ page }) => {
    await page.goto('/tr/search');
    await page.getByTestId('shop-list-item').first().click();
    await expect(page).toHaveURL(/\/tr\/checkout\//);
    await expect(page.getByTestId('checkout-total-amount')).toHaveText('₺95');

    await page.getByTestId('checkout-stay-days-increase').click();
    await page.getByTestId('checkout-stay-days-increase').click();
    await expect(page.getByTestId('checkout-stay-days-value')).toHaveText('3');
    await expect(page.getByTestId('checkout-total-amount')).toHaveText('₺255');
    await expect(page.getByTestId('checkout-service-total')).toHaveText('₺240');
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
