import { test, expect } from '@playwright/test';
import { IYZICO_SANDBOX_SUCCESS } from './helpers/iyzico-sandbox';

/**
 * Kullanım: `npx playwright test tests/e2e/use-cases.spec.ts -g "UC: Misafir"`
 *
 * iyzico sandbox kartları: https://docs.iyzico.com/en/add-ons/test-cards
 * Geliştirmede IYZICO_API_KEY yoksa veya `sandbox-api-key` ise ödeme simüle edilir (kart numarası önemsiz).
 */

/** Özet (adım 2) ve ödeme (adım 3) ekranlarına geçer */
async function goToCheckoutPayment(page: import('@playwright/test').Page) {
  await page.getByTestId('checkout-footer-primary').click();
  await page.getByTestId('checkout-footer-primary').click();
}

async function fillSandboxCard(page: import('@playwright/test').Page) {
  await page.getByPlaceholder(/Kart üzerindeki isim|Name on card/i).fill('Test User');
  await page.getByPlaceholder('0000 0000 0000 0000').fill(IYZICO_SANDBOX_SUCCESS.HALKBANK_MC_CREDIT);
  await page.getByPlaceholder(/AA\/YY|MM\/YY/i).fill('12/30');
  await page.getByPlaceholder('CVV').fill('123');
}

test.describe('UC: Misafir — Arama ve harita (seed)', () => {
  test('Yakındaki noktalar ve harita görünür', async ({ page }) => {
    await page.goto('/tr/search');

    await expect(page.getByTestId('nearby-heading')).toContainText(/Yakındaki/i);
    await expect(page.getByText(/Galata Gift & Luggage/i)).toBeVisible();
    await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible({ timeout: 15000 });
  });
});

test.describe('UC: Misafir — Checkout fiyat ve çanta (anonim)', () => {
  test('Varsayılan 1 gün 1×M toplam ₺95', async ({ page }) => {
    await page.goto('/tr/search');
    await page.getByTestId('shop-list-item').first().click();
    await expect(page).toHaveURL(/\/tr\/checkout\//);
    await page.getByTestId('checkout-footer-primary').click();
    await expect(page.getByTestId('checkout-total-amount')).toHaveText('₺95');
  });

  test('Çanta adetleri değişince toplam güncellenir', async ({ page }) => {
    await page.goto('/tr/search');
    await page.getByTestId('shop-list-item').first().click();
    await expect(page).toHaveURL(/\/tr\/checkout\//);

    await page.getByRole('button', { name: 'Increase' }).nth(0).click();
    await page.getByTestId('checkout-footer-primary').click();
    await expect(page.getByTestId('checkout-total-amount')).toHaveText('₺159');

    await page.getByRole('button', { name: 'Geri' }).click();
    await page.getByRole('button', { name: 'Increase' }).nth(2).click();
    await page.getByTestId('checkout-footer-primary').click();
    await expect(page.getByTestId('checkout-total-amount')).toHaveText('₺279');
  });

  test('Çok günlük konaklama: 3 gün 1×M (80×3+15)', async ({ page }) => {
    await page.goto('/tr/search');
    await page.getByTestId('shop-list-item').first().click();
    await expect(page).toHaveURL(/\/tr\/checkout\//);
    await page.getByTestId('checkout-footer-primary').click();
    await expect(page.getByTestId('checkout-total-amount')).toHaveText('₺95');

    await page.getByRole('button', { name: 'Geri' }).click();
    await page.getByTestId('checkout-stay-days-increase').click();
    await page.getByTestId('checkout-stay-days-increase').click();
    await expect(page.getByTestId('checkout-stay-days-value')).toHaveText('3');
    await page.getByTestId('checkout-footer-primary').click();
    await expect(page.getByTestId('checkout-total-amount')).toHaveText('₺255');
    await expect(page.getByTestId('checkout-service-total')).toHaveText('₺240');
  });
});

test.describe('UC: Misafir — Demo giriş ve rezervasyonlar', () => {
  test('Misafir demo ile giriş ve seed rezervasyon', async ({ page }) => {
    await page.goto('/tr/login');
    await page.getByRole('button', { name: 'Misafir Demo' }).first().click();
    await expect(page).toHaveURL(/\/tr\/bookings/, { timeout: 20000 });
    await expect(page.getByText(/Galata Gift/i).first()).toBeVisible();
  });
});

test.describe('UC: Misafir — Checkout ödeme (iyzico sandbox kartı)', () => {
  test('Misafir demo → arama → ödeme → başarı sayfası', async ({ page }) => {
    await page.goto('/tr/login');
    await page.getByRole('button', { name: 'Misafir Demo' }).first().click();
    await expect(page).toHaveURL(/\/tr\/bookings/, { timeout: 20000 });

    await page.goto('/tr/search');
    await page.getByTestId('shop-list-item').first().click();
    await expect(page).toHaveURL(/\/tr\/checkout\//);

    await page.getByTestId('checkout-footer-primary').click();
    await expect(page.getByTestId('checkout-total-amount')).toHaveText('₺95');
    await page.getByRole('button', { name: 'Geri' }).click();
    await page.getByRole('button', { name: 'Increase' }).nth(1).click();
    await goToCheckoutPayment(page);

    await fillSandboxCard(page);

    await page.getByTestId('checkout-footer-primary').click();

    await expect(page.getByRole('heading', { name: /Rezervasyon Başarılı/i })).toBeVisible({
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
    await page.goto('/tr/partner/settings');
    await expect(page.getByTestId('partner-settings-capacity')).toBeVisible();
    await expect(page.getByTestId('partner-settings-capacity')).toHaveValue(/^(15|25)$/);
  });
});

test.describe('UC: Admin — Yönetim paneli', () => {
  test('Admin demo ile istatistik ve grafik', async ({ page }) => {
    await page.goto('/tr/login');
    await page.getByText('Admin Girişi').click();
    await expect(page).toHaveURL(/\/tr\/admin/, { timeout: 20000 });

    await expect(page.locator('h1')).toContainText(/Yönetim Masası/i);
    await expect(page.getByText(/₺[\d.,]+/).first()).toBeVisible();
    await expect(page.locator('text=Canlı Analiz')).toBeVisible();
  });
});

test.describe('UC: Genel — Login sayfası', () => {
  test('Sosyal ve demo seçenekleri görünür', async ({ page }) => {
    await page.goto('/tr/login');

    await expect(page.locator('h1')).toContainText(/Giriş Yap/i);
    await expect(page.getByRole('button', { name: 'Misafir Demo' }).first()).toBeVisible();
  });
});
