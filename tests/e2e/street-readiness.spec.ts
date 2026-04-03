import { test, expect } from '@playwright/test';

/**
 * Sokak senaryosu: misafir arama → checkout → (demo) ödeme başarısı.
 * Partner check-in/out QR + kamera gerektirdiği için ayrı manuel / cihaz testi önerilir.
 */
test.describe('Emanetçi: guest booking smoke', () => {
  test('Search → checkout → payment success', async ({ page }) => {
    await page.goto('/tr');
    await expect(page.locator('h1')).toContainText(/Güvenle Bırak|Valizini/i);

    await page.goto('/tr/login');
    await page.getByRole('button', { name: 'Misafir Demo' }).first().click();
    await expect(page).toHaveURL(/\/tr\/bookings/, { timeout: 20000 });

    await page.goto('/tr/search');
    await expect(page.getByText(/Galata Gift & Luggage/i)).toBeVisible();
    await page.getByText(/Galata Gift & Luggage/i).first().click();

    await expect(page).toHaveURL(/\/tr\/checkout\//);
    await expect(page.locator('h1')).toContainText(/Ödeme ve Onay/i);

    await page.getByPlaceholder('Kart Üzerindeki İsim').fill('Street Test');
    await page.getByPlaceholder('0000 0000 0000 0000').fill('5528790000000008');
    await page.getByPlaceholder('AA/YY').fill('12/30');
    await page.getByPlaceholder('CVV').fill('123');

    await page.getByRole('button', { name: /ÖDEMEYİ TAMAMLA VE REZERVASYON YAP/i }).click();

    await expect(page.getByRole('heading', { name: /Rezervasyon Başarılı/i })).toBeVisible({
      timeout: 20000,
    });

    await page.getByRole('link', { name: 'Rezervasyonlarım' }).click();
    await expect(page).toHaveURL(/\/tr\/bookings/);
    await expect(page.getByText('PAID').first()).toBeVisible();
  });
});
