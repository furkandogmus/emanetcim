import { expect, type Page } from "@playwright/test";

/** Arama listesinden mağaza detayı → Rezervasyon yap → checkout. */
export async function openCheckoutFromSearchList(page: Page) {
  await page.getByTestId("shop-list-item").first().click();
  await expect(page).toHaveURL(/\/tr\/shop\//);
  await page.getByTestId("shop-book-now").click();
  await expect(page).toHaveURL(/\/tr\/checkout\//);
}
