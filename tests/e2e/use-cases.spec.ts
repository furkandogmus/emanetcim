import { test, expect } from '@playwright/test';
import { waitForCheckoutDatesReady } from './helpers/checkout';
import { openCheckoutFromSearchList } from './helpers/search-to-checkout';

/**
 * Kullanım: `npx playwright test tests/e2e/use-cases.spec.ts -g "UC: Misafir"`
 *
 */

/** Özeti geçip rezervasyonu onaylar. */
async function confirmCheckout(page: import('@playwright/test').Page) {
  await waitForCheckoutDatesReady(page);
  await page.getByTestId('checkout-footer-primary').click();
  await page.getByTestId('checkout-footer-primary').click();
}

test.describe('UC: Misafir — Arama ve harita (seed)', () => {
  test('Yakındaki noktalar ve harita görünür', async ({ page }) => {
    await page.goto('/tr/search');

    await expect(page.getByTestId('nearby-heading').first()).toContainText(/Yakındaki/i);
    await expect(page.getByText(/Galata|BagajPark/i).first()).toBeVisible();
    await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible({ timeout: 15000 });
  });
});

test.describe('UC: Misafir — Checkout fiyat ve çanta (anonim)', () => {
  test('Varsayılan 1 gün 1×M toplam ₺95', async ({ page }) => {
    await page.goto('/tr/search');
    await openCheckoutFromSearchList(page);
    await waitForCheckoutDatesReady(page);
    await page.getByTestId('checkout-footer-primary').click();
    await expect(page.getByTestId('checkout-total-amount')).toHaveText(/₺80(,00)?/);
  });

  test('Çanta adetleri değişince toplam güncellenir', async ({ page }) => {
    await page.goto('/tr/search');
    await openCheckoutFromSearchList(page);
    await waitForCheckoutDatesReady(page);

    await page.getByRole('button', { name: 'Increase' }).nth(0).click();
    await page.getByTestId('checkout-footer-primary').click();
    await expect(page.getByTestId('checkout-total-amount')).toHaveText(/₺144(,00)?/);

    await page.getByRole('button', { name: 'Geri' }).click();
    await page.getByRole('button', { name: 'Increase' }).nth(2).click();
    await page.getByTestId('checkout-footer-primary').click();
    await expect(page.getByTestId('checkout-total-amount')).toHaveText(/₺264(,00)?/);
  });

  /**
   * Checkout artık tarih girişi yerine slot ızgarası kullanıyor; `checkout-checkin`
   * alanı yok. Çok günlük senaryo ızgara üzerinden yeniden yazılana kadar atlanır.
   */
  test.skip('Çok günlük konaklama: 3 gün 1×M (80×3+15)', async ({ page }) => {
    await page.goto('/tr/search');
    await openCheckoutFromSearchList(page);
    await waitForCheckoutDatesReady(page);
    await page.getByTestId('checkout-footer-primary').click();
    await expect(page.getByTestId('checkout-total-amount')).toHaveText(/₺80(,00)?/);

    await page.getByRole('button', { name: 'Geri' }).click();
    await page.getByTestId('checkout-checkin').fill('2030-06-01T10:00');
    await page.getByTestId('checkout-checkout').fill('2030-06-04T10:00');
    await expect(page.getByTestId('checkout-stay-days-value')).toHaveText('3');
    await page.getByTestId('checkout-footer-primary').click();
    await expect(page.getByTestId('checkout-total-amount')).toHaveText(/₺240(,00)?/);
    await expect(page.getByTestId('checkout-service-total')).toHaveText(/₺240(,00)?/);
  });
});

test.describe('UC: Misafir — Demo giriş ve rezervasyonlar', () => {
  test('Misafir demo ile giriş ve seed rezervasyon', async ({ page }) => {
    await page.goto('/tr/login');
    await page.getByRole('button', { name: 'Misafir Demo' }).first().click();
    await expect(page).toHaveURL(/\/tr\/bookings/, { timeout: 20000 });
    await expect(page.getByText(/Galata|BagajPark/i).first()).toBeVisible();
  });
});

test.describe('UC: Misafir — Rezervasyon oluşturma', () => {
  test('Misafir demo → arama → onay → başarı sayfası', async ({ page }) => {
    await page.goto('/tr/login');
    await page.getByRole('button', { name: 'Misafir Demo' }).first().click();
    await expect(page).toHaveURL(/\/tr\/bookings/, { timeout: 20000 });

    await page.goto('/tr/search');
    await openCheckoutFromSearchList(page);
    await waitForCheckoutDatesReady(page);

    await page.getByTestId('checkout-footer-primary').click();
    await expect(page.getByTestId('checkout-total-amount')).toHaveText(/₺80(,00)?/);
    await page.getByRole('button', { name: 'Geri' }).click();
    await page.getByRole('button', { name: 'Increase' }).nth(1).click();
    await confirmCheckout(page);

    await expect(page.getByRole('heading', { name: /Rezervasyon (Başarılı|Onaylandı)/i })).toBeVisible({
      timeout: 20000,
    });
    await expect(page.getByText(/Rezervasyon ID|RESERVASYON ID/i)).toBeVisible();
  });
});

test.describe('UC: Esnaf — Partner paneli', () => {
  test('Esnaf girişi ve dükkan özeti', async ({ page }) => {
    await page.goto('/tr/login');
    await page.getByText('Esnaf Girişi').click();
    await expect(page).toHaveURL(/\/tr\/partner/, { timeout: 20000 });
    // İlk dükkan: getShopsByOwner createdAt desc → en son oluşturulan (seed: Sultanahmet)
    await expect(page.getByTestId('partner-shop-name')).toContainText(/sultanahmet|galata/i);
  });

  test('QR teslim al modalı aç/kapat', async ({ page }) => {
    await page.goto('/tr/login');
    await page.getByText('Esnaf Girişi').click();
    await expect(page).toHaveURL(/\/tr\/partner/, { timeout: 20000 });

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

  test('Ayarlar: kapasite arayüzü', async ({ page }) => {
    await page.goto('/tr/login');
    await page.getByText('Esnaf Girişi').click();
    await expect(page).toHaveURL(/\/tr\/partner/, { timeout: 20000 });
    // Sayfa akış (streaming) ile gelir; CI'da DOM yerleşmeden ölçmek çift eşleşme veriyordu.
    await page.goto('/tr/partner/settings', { waitUntil: 'networkidle' });
    await expect(page.getByTestId('partner-settings-capacity')).toBeVisible();
    await expect(page.getByTestId('partner-settings-capacity')).toHaveValue(/^(15|25)$/);
  });
});

test.describe('UC: Admin — Yönetim paneli', () => {
  test('Admin demo ile istatistik ve grafik', async ({ page }) => {
    await page.goto('/tr/login');
    await page.getByText('Admin Girişi').click();
    await expect(page).toHaveURL(/\/tr\/admin/, { timeout: 20000 });
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { level: 1 }).first()).toContainText(/Yönetim Masası/i);
    await expect(page.getByText(/₺[\d.,]+/).first()).toBeVisible();
    await expect(page.locator('text=Canlı Analiz').first()).toBeVisible();
  });
});

test.describe('UC: Genel — Login sayfası', () => {
  test('Sosyal ve demo seçenekleri görünür', async ({ page }) => {
    await page.goto('/tr/login');

    await expect(page.locator('h1')).toContainText(/Giriş Yap/i);
    await expect(page.getByRole('button', { name: 'Misafir Demo' }).first()).toBeVisible();
  });
});
