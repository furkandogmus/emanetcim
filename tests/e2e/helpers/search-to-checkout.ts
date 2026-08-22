import { expect, type Page } from "@playwright/test";

/** Arama listesinden mağaza detayı → Rezervasyon yap → checkout. */
export async function openCheckoutFromSearchList(page: Page, shopName?: RegExp) {
  const items = page.getByTestId("shop-list-item");
  const target = shopName ? items.filter({ hasText: shopName }).first() : items.first();
  await target.click();
  await expect(page).toHaveURL(/\/tr\/shop\//);
  await page.getByTestId("shop-book-now").click();
  await expect(page).toHaveURL(/\/tr\/checkout\//);
}
