import { expect, type Page } from "@playwright/test";
import { openCheckoutFromSearchList } from "./search-to-checkout";
import { waitForCheckoutDatesReady } from "./checkout";

/**
 * Manuel tahsilat akışı (aktif sağlayıcı `manual`): kart alanı YOK.
 * Checkout 2 adım — (1) valiz/slot, (2) özet → "Rezervasyon Onaylandı!".
 * Rezervasyon doğrudan APPROVED olur; esnaf QR/`?booking=<id>` ile teslim alır.
 */
/**
 * Çerez şeridi sayfanın altını kapatıyor ve alt gezinme çubuğuna tıklamayı engelliyor.
 * Her testte kabul etmek yerine tercihi baştan yazarız (uygulamanın kendi anahtarı).
 */
export async function presetCookieConsent(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("bagajpark-cookie-consent", "all");
    } catch {
      /* yok say */
    }
  });
}

export async function loginAsDemoGuest(page: Page) {
  await presetCookieConsent(page);
  await page.goto("/tr/login");
  await page.getByRole("button", { name: /Misafir Demo/i }).first().click();
  await expect(page).toHaveURL(/\/tr\/bookings/, { timeout: 20000 });
}

export async function loginAsDemoPartner(page: Page) {
  await presetCookieConsent(page);
  await page.goto("/tr/login");
  await page.getByText("Esnaf Girişi").click();
  await expect(page).toHaveURL(/\/tr\/partner/, { timeout: 20000 });
}

/** Arama → ilk dükkan → checkout → onay. Döndürdüğü şey: yeni rezervasyonun UUID'si. */
/**
 * Demo esnafın (esnaf@test.com) 7/24 açık dükkanı — seed'de `00:00-23:59`.
 * Check-in çalışma saati dışında `SHOP_CLOSED` ile reddedilir; Sultanahmet dükkanı
 * gece kapalı olduğu için test saate bağlı düşüyordu.
 */
export const DEMO_PARTNER_SHOP = /Galata/i;

export async function createBookingAsGuest(page: Page, shopName?: RegExp): Promise<string> {
  await page.goto("/tr/search");
  await expect(page.getByTestId("nearby-heading").first()).toContainText(/Yakındaki/i);
  await openCheckoutFromSearchList(page, shopName);
  await waitForCheckoutDatesReady(page);
  await page.getByTestId("checkout-footer-primary").click(); // adım 1 → 2
  await page.getByTestId("checkout-footer-primary").click(); // gönder
  await expect(
    page.getByRole("heading", { name: /Rezervasyon Onaylandı/i }),
  ).toBeVisible({ timeout: 20000 });

  // Başarı kartı kısa ID gösterir; tam UUID "Rezervasyonlarım" listesindeki linkte.
  await page.goto("/tr/bookings");
  const href = await page.locator('a[href*="/bookings/"]').first().getAttribute("href");
  const id = href?.match(/\/bookings\/([0-9a-f-]{36})/i)?.[1];
  expect(id, `rezervasyon linki bulunamadı: ${href}`).toBeTruthy();
  return id!;
}
