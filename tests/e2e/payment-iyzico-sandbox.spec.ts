import { test, expect } from '@playwright/test';
import {
  IYZICO_SANDBOX_ERRORS,
  IYZICO_SANDBOX_SUCCESS,
  isRealIyzicoSandboxConfigured,
} from './helpers/iyzico-sandbox';

/**
 * Bu dosya yalnızca gerçek iyzico sandbox API anahtarlarıyla anlamlıdır.
 * Yerelde: `.env.local` içinde panelden alınan sandbox `IYZICO_API_KEY` / `IYZICO_SECRET_KEY`
 * ve `IYZICO_BASE_URL=https://sandbox-api.iyzipay.com` (veya varsayılan).
 *
 * Anahtar yoksa veya `sandbox-api-key` placeholder ise tüm testler skip edilir (dev bypass kart numarasını yok sayar).
 */

test.describe.configure({ mode: 'serial' });

test.describe('iyzico sandbox — gerçek API (yerel .env)', () => {
  test.beforeEach(({}, testInfo) => {
    testInfo.skip(
      !isRealIyzicoSandboxConfigured(),
      'Gerçek sandbox: .env.local içinde IYZICO_API_KEY ve IYZICO_SECRET_KEY (placeholder değil) tanımlayın.'
    );
    test.setTimeout(90_000);
  });

  async function openCheckoutAsGuest(page: import('@playwright/test').Page) {
    await page.goto('/tr/login');
    await page.getByRole('button', { name: 'Misafir Demo' }).first().click();
    await expect(page).toHaveURL(/\/tr\/bookings/, { timeout: 20_000 });
    await page.goto('/tr/search');
    await page.getByTestId('shop-list-item').first().click();
    await expect(page).toHaveURL(/\/tr\/checkout\//);
    await page.getByTestId('checkout-footer-primary').click();
    await page.getByTestId('checkout-footer-primary').click();
  }

  async function fillCard(page: import('@playwright/test').Page, cardNumber: string) {
    await page.getByPlaceholder(/Kart üzerindeki isim|Name on card/i).fill('Sandbox Test');
    await page.getByPlaceholder('0000 0000 0000 0000').fill(cardNumber);
    await page.getByPlaceholder(/AA\/YY|MM\/YY/i).fill('12/30');
    await page.getByPlaceholder('CVV').fill('123');
  }

  async function submitPayment(page: import('@playwright/test').Page) {
    await page.getByTestId('checkout-footer-primary').click();
  }

  test('başarılı: Halkbank MasterCard (kredi)', async ({ page }) => {
    await openCheckoutAsGuest(page);
    await fillCard(page, IYZICO_SANDBOX_SUCCESS.HALKBANK_MC_CREDIT);
    await submitPayment(page);
    await expect(page.getByRole('heading', { name: /Rezervasyon Başarılı/i })).toBeVisible({
      timeout: 45_000,
    });
  });

  test('başarılı: Akbank MasterCard (debit)', async ({ page }) => {
    await openCheckoutAsGuest(page);
    await fillCard(page, IYZICO_SANDBOX_SUCCESS.AKBANK_MC_DEBIT);
    await submitPayment(page);
    await expect(page.getByRole('heading', { name: /Rezervasyon Başarılı/i })).toBeVisible({
      timeout: 45_000,
    });
  });

  test('başarılı: Denizbank Visa (debit)', async ({ page }) => {
    await openCheckoutAsGuest(page);
    await fillCard(page, IYZICO_SANDBOX_SUCCESS.DENIZBANK_VISA_DEBIT);
    await submitPayment(page);
    await expect(page.getByRole('heading', { name: /Rezervasyon Başarılı/i })).toBeVisible({
      timeout: 45_000,
    });
  });

  test('başarılı: QNB MasterCard (kredi)', async ({ page }) => {
    await openCheckoutAsGuest(page);
    await fillCard(page, IYZICO_SANDBOX_SUCCESS.QNB_MC_CREDIT);
    await submitPayment(page);
    await expect(page.getByRole('heading', { name: /Rezervasyon Başarılı/i })).toBeVisible({
      timeout: 45_000,
    });
  });

  test('başarılı: Vakıfbank Visa (kredi)', async ({ page }) => {
    await openCheckoutAsGuest(page);
    await fillCard(page, IYZICO_SANDBOX_SUCCESS.VAKIF_VISA_CREDIT);
    await submitPayment(page);
    await expect(page.getByRole('heading', { name: /Rezervasyon Başarılı/i })).toBeVisible({
      timeout: 45_000,
    });
  });

  test('başarısız: yetersiz bakiye', async ({ page }) => {
    await openCheckoutAsGuest(page);
    await fillCard(page, IYZICO_SANDBOX_ERRORS.NOT_SUFFICIENT_FUNDS);
    await submitPayment(page);
    await expect(page.getByTestId('checkout-payment-error')).toContainText(/Ödeme başarısız/i, {
      timeout: 45_000,
    });
    await expect(page.getByRole('heading', { name: /Rezervasyon Başarılı/i })).not.toBeVisible();
  });

  test('başarısız: süresi dolmuş kart', async ({ page }) => {
    await openCheckoutAsGuest(page);
    await fillCard(page, IYZICO_SANDBOX_ERRORS.EXPIRED_CARD);
    await submitPayment(page);
    await expect(page.getByTestId('checkout-payment-error')).toContainText(/Ödeme başarısız/i, {
      timeout: 45_000,
    });
  });

  test('başarısız: geçersiz CVC', async ({ page }) => {
    await openCheckoutAsGuest(page);
    await fillCard(page, IYZICO_SANDBOX_ERRORS.INVALID_CVC2);
    await submitPayment(page);
    await expect(page.getByTestId('checkout-payment-error')).toContainText(/Ödeme başarısız/i, {
      timeout: 45_000,
    });
  });

  test('başarısız: genel hata', async ({ page }) => {
    await openCheckoutAsGuest(page);
    await fillCard(page, IYZICO_SANDBOX_ERRORS.GENERAL_ERROR);
    await submitPayment(page);
    await expect(page.getByTestId('checkout-payment-error')).toContainText(/Ödeme başarısız/i, {
      timeout: 45_000,
    });
  });

  test('başarısız: fraud şüphesi', async ({ page }) => {
    await openCheckoutAsGuest(page);
    await fillCard(page, IYZICO_SANDBOX_ERRORS.FRAUD_SUSPECT);
    await submitPayment(page);
    await expect(page.getByTestId('checkout-payment-error')).toContainText(/Ödeme başarısız/i, {
      timeout: 45_000,
    });
  });

  test('başarısız: Do not honour', async ({ page }) => {
    await openCheckoutAsGuest(page);
    await fillCard(page, IYZICO_SANDBOX_ERRORS.DO_NOT_HONOUR);
    await submitPayment(page);
    await expect(page.getByTestId('checkout-payment-error')).toContainText(/Ödeme başarısız/i, {
      timeout: 45_000,
    });
  });
});
