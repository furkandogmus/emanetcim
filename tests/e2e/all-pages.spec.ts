import { test, expect } from '@playwright/test';

test.describe('Emanetçi All Pages Flows', () => {
  test('Search Page: should show nearby shops and map', async ({ page }) => {
    await page.goto('/tr/search');

    await expect(page.getByTestId('nearby-heading')).toContainText(/Yakındaki Noktalar/i);
    await expect(page.getByText(/Galata Gift & Luggage/i)).toBeVisible();
    await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible({ timeout: 15000 });
  });

  test('Checkout Page: price, extra medium bag, and payment success (demo)', async ({ page }) => {
    await page.goto('/tr/login');
    await page.getByRole('button', { name: 'Misafir Demo' }).first().click();
    await expect(page).toHaveURL(/\/tr\/bookings/, { timeout: 20000 });

    await page.goto('/tr/search');
    await page.getByTestId('shop-list-item').first().click();
    await expect(page).toHaveURL(/\/tr\/checkout\//);

    await expect(page.getByTestId('checkout-total-amount')).toHaveText('₺95');
    await page.getByRole('button', { name: 'Increase' }).nth(1).click();
    await expect(page.getByTestId('checkout-total-amount')).toHaveText('₺175');

    await page.getByPlaceholder('Kart Üzerindeki İsim').fill('Test User');
    await page.getByPlaceholder('0000 0000 0000 0000').fill('5528790000000008');
    await page.getByPlaceholder('AA/YY').fill('12/30');
    await page.getByPlaceholder('CVV').fill('123');

    await page.getByRole('button', { name: /ÖDEMEYİ TAMAMLA VE REZERVASYON YAP/i }).click();

    await expect(page.getByRole('heading', { name: /Rezervasyon Başarılı/i })).toBeVisible({
      timeout: 20000,
    });
    await expect(page.getByText(/RESERVASYON ID/i)).toBeVisible();
  });

  test('Partner Page: open QR scanner then close', async ({ page }) => {
    await page.goto('/tr/login');
    await page.getByText('Esnaf Girişi').click();
    await expect(page).toHaveURL(/\/tr\/partner/, { timeout: 20000 });

    await expect(page.getByText(/galata gift/i)).toBeVisible();

    await page.getByText('YENİ VALİZ TESLİM AL').click();
    await expect(page.getByRole('heading', { name: 'QR Kodu Okutun' })).toBeVisible();

    await page
      .locator('div.fixed.inset-0.z-50')
      .filter({ has: page.getByRole('heading', { name: 'QR Kodu Okutun' }) })
      .locator('button')
      .first()
      .click();
    await expect(page.getByRole('heading', { name: 'QR Kodu Okutun' })).not.toBeVisible();
  });

  test('Admin Page: stats and chart after admin demo login', async ({ page }) => {
    await page.goto('/tr/login');
    await page.getByText('Admin Girişi').click();
    await expect(page).toHaveURL(/\/tr\/admin/, { timeout: 20000 });

    await expect(page.locator('h1')).toContainText(/Yönetim Masası/i);
    await expect(page.getByText(/₺[\d.,]+/).first()).toBeVisible();
    await expect(page.locator('text=Canlı Analiz')).toBeVisible();
  });

  test('Login Page: should show social and demo options', async ({ page }) => {
    await page.goto('/tr/login');

    await expect(page.locator('h1')).toContainText(/Giriş Yap/i);
    await expect(page.getByRole('button', { name: 'Misafir Demo' }).first()).toBeVisible();
  });
});
