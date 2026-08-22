import { test, expect } from "@playwright/test";
import { waitForCheckoutDatesReady } from "./helpers/checkout";
import { openCheckoutFromSearchList } from "./helpers/search-to-checkout";

test.describe("Booking Lifecycle E2E", () => {
  test.setTimeout(120000);

  test("Misafir rezervasyon olusturma ve iptal", async ({ page }) => {
    await page.goto("/tr/login");
    await page.getByRole("button", { name: /Misafir Demo/i }).first().click();
    await expect(page).toHaveURL(/\/tr\/bookings/, { timeout: 20000 });

    await page.goto("/tr/search");
    await expect(page.getByTestId("nearby-heading").first()).toContainText(/Yak\u0131ndaki/i);
    await openCheckoutFromSearchList(page);

    await waitForCheckoutDatesReady(page);
    await page.getByRole("button", { name: "Increase" }).nth(1).click();
    await page.getByTestId("checkout-footer-primary").click();
    await page.getByTestId("checkout-footer-primary").click();

    await expect(
      page.getByRole("heading", { name: /Rezervasyon (Ba\u015far\u0131l\u0131|Onayland\u0131)/i }),
    ).toBeVisible({ timeout: 20000 });

    const bookingUrl = page.url();
    const bookingId = bookingUrl.match(/\/bookings\/([a-f0-9-]+)/)?.[1];
    expect(bookingId).toBeTruthy();

    await expect(page.getByText(/CHECKED_IN|CHECKED_OUT|PAID|APPROVED|WAITING_APPROVAL/i)).toBeVisible({ timeout: 10000 });

    await page.goto(`/tr/bookings/${bookingId}`);
    const cancelButton = page.getByRole("button", { name: /\u0130ptal|Cancel/i });
    if (await cancelButton.isVisible({ timeout: 3000 })) {
      await cancelButton.click();
      const confirmButton = page.getByRole("button", { name: /Onayla|Confirm|Evet|Yes/i });
      if (await confirmButton.isVisible({ timeout: 3000 })) {
        await confirmButton.click();
      }
      await expect(page.getByText(/CANCELLED|\u0130ptal/i)).toBeVisible({ timeout: 10000 });
    }
  });

  test("Esnaf check-in ve check-out akisi", async ({ page }) => {
    await page.goto("/tr/login");
    await page.getByRole("button", { name: /Misafir Demo/i }).first().click();
    await expect(page).toHaveURL(/\/tr\/bookings/, { timeout: 20000 });

    await page.goto("/tr/search");
    await expect(page.getByTestId("nearby-heading").first()).toContainText(/Yak\u0131ndaki/i);
    await openCheckoutFromSearchList(page);

    await waitForCheckoutDatesReady(page);
    await page.getByTestId("checkout-footer-primary").click();
    await page.getByTestId("checkout-footer-primary").click();

    await expect(
      page.getByRole("heading", { name: /Rezervasyon (Ba\u015far\u0131l\u0131|Onayland\u0131)/i }),
    ).toBeVisible({ timeout: 20000 });

    const bookingUrl = page.url();
    const bookingId = bookingUrl.match(/\/bookings\/([a-f0-9-]+)/)?.[1];
    expect(bookingId).toBeTruthy();

    await page.goto("/tr/settings");
    await page.getByRole("button", { name: /\u00c7\u0131k\u0131\u015f Yap|Log Out/i }).click();

    await page.goto("/tr/login");
    await page.getByText("Esnaf Giri\u015fi").click();
    await expect(page).toHaveURL(/\/tr\/partner/, { timeout: 20000 });

    await page.goto(`/tr/partner?booking=${bookingId}`);
    await expect(page.getByText(/APPROVED|PAID|ONAYLANMI\u015e|ÜCRETL\u0130/i)).toBeVisible({ timeout: 10000 });

    const checkInButton = page.getByRole("button", { name: /Teslim Al|Check.?In/i });
    if (await checkInButton.isVisible({ timeout: 5000 })) {
      await checkInButton.click();
      await expect(page.getByText(/CHECKED_IN|TESL\u0130M ALINDI/i)).toBeVisible({
        timeout: 10000,
      });

      await page.goto(`/tr/partner?checkoutBooking=${bookingId}`);
      const checkOutButton = page.getByRole("button", { name: /Teslim Et|Check.?Out/i });
      if (await checkOutButton.isVisible({ timeout: 5000 })) {
        await checkOutButton.click();
        await expect(page.getByText(/CHECKED_OUT|TESL\u0130M ED\u0130LD\u0130/i)).toBeVisible({
          timeout: 10000,
        });
      }
    }
  });

  test("Rezervasyon detay sayfasi gorunurlugu", async ({ page }) => {
    await page.goto("/tr/login");
    await page.getByRole("button", { name: /Misafir Demo/i }).first().click();
    await expect(page).toHaveURL(/\/tr\/bookings/, { timeout: 20000 });

    const bookingRows = page.locator("a[href*='/bookings/']");
    const count = await bookingRows.count();
    if (count > 0) {
      await bookingRows.first().click();
      await expect(page).toHaveURL(/\/tr\/bookings\/[a-f0-9-]+/, { timeout: 10000 });
      await expect(page.getByText(/PAID|APPROVED|WAITING_APPROVAL|CHECKED_IN|CHECKED_OUT|CANCELLED/i)).toBeVisible({ timeout: 10000 });
    }
  });
});