import type { Page } from "@playwright/test";

/** CheckoutClient mounts default check-in/out after `useEffect` (client-only). */
export async function waitForCheckoutDatesReady(page: Page) {
  await page.getByTestId("checkout-dates-ready").waitFor({
    state: "attached",
    timeout: 15_000,
  });
}
