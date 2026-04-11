import { test, expect } from '@playwright/test';
import { waitForCheckoutDatesReady } from './helpers/checkout';
import { openCheckoutFromSearchList } from './helpers/search-to-checkout';

/**
 * Sokak senaryosu: misafir arama → checkout → (demo) ödeme başarısı.
 * Partner check-in/out QR + kamera gerektirdiği için ayrı manuel / cihaz testi önerilir.
 */
test.describe('BagajPark: guest booking smoke', () => {
  test('Search → checkout → payment success', async ({ page }) => {
    await page.goto('/tr');
    await expect(page.locator('h1')).toContainText(/Güvenle Bırak|Valizini/i);

    await page.goto('/tr/login');
    await page.getByRole('button', { name: 'Misafir Demo' }).first().click();
    await expect(page).toHaveURL(/\/tr\/bookings/, { timeout: 20000 });

    await page.goto('/tr/search');
    await expect(page.getByTestId('shop-list-item').first()).toBeVisible();
    await openCheckoutFromSearchList(page);
    await expect(page.locator('h1')).toContainText(/Ödeme ve Onay/i);
    await waitForCheckoutDatesReady(page);

    await page.getByTestId('checkout-footer-primary').click();
    await page.getByTestId('checkout-footer-primary').click();

    await page.getByPlaceholder(/Kart üzerindeki isim|Name on card/i).fill('Street Test');
    await page.getByPlaceholder('0000 0000 0000 0000').fill('5528790000000008');
    await page.getByPlaceholder(/AA\/YY|MM\/YY/i).fill('12/30');
    await page.getByPlaceholder('CVV').fill('123');

    await page.getByTestId('checkout-footer-primary').click();

    await expect(page.getByRole('heading', { name: /Rezervasyon Başarılı/i })).toBeVisible({
      timeout: 20000,
    });

    await page.getByRole('link', { name: 'Rezervasyonlarım' }).click();
    await expect(page).toHaveURL(/\/tr\/bookings/);
    await expect(page.getByText('PAID').first()).toBeVisible();
  });
});
