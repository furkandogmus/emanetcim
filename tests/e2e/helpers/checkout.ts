import type { Page } from "@playwright/test";

/**
 * Checkout artık slot ızgarası kullanıyor; "tarihler hazır" sinyali konaklama
 * bölümünün (`checkout-stay-days`) DOM'a gelmesidir. Eski `checkout-dates-ready`
 * testid'i hiçbir bileşende yoktu — 8 e2e bu yüzden zaman aşımına düşüyordu.
 */
export async function waitForCheckoutDatesReady(page: Page) {
  await page.getByTestId("checkout-stay-days").waitFor({
    state: "attached",
    timeout: 15_000,
  });
}
