import { test, expect } from "@playwright/test";

/** `CookieConsent` bileşeni ile aynı anahtar — e2e bağımsız kalsın diye burada tekrarlanır. */
const COOKIE_CONSENT_STORAGE_KEY = "emanetci-cookie-consent";

test.describe("SEO: robots ve sitemap", () => {
  test("robots.txt: sitemap adresi ve temel disallow kuralları", async ({
    request,
  }) => {
    const res = await request.get("/robots.txt");
    expect(res.ok()).toBeTruthy();
    const text = await res.text();
    expect(text).toMatch(/sitemap:\s*http:\/\/localhost:3000\/sitemap\.xml/i);
    expect(text).toContain("Disallow: /api/");
    expect(text).toContain("/tr/admin");
  });

  test("sitemap.xml: tr ve en genel sayfalar", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.ok()).toBeTruthy();
    const text = await res.text();
    expect(text).toContain("http://localhost:3000/tr");
    expect(text).toContain("http://localhost:3000/en");
    expect(text).toContain("/tr/search");
    expect(text).toContain("/en/search");
  });
});

test.describe("Çerez onayı banner", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tr");
    await page.evaluate((key) => {
      try {
        localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    }, COOKIE_CONSENT_STORAGE_KEY);
    await page.reload();
  });

  test("ilk ziyarette banner görünür; kabul sonrası kaybolur", async ({
    page,
  }) => {
    const banner = page.getByTestId("cookie-consent-banner");
    await expect(banner).toBeVisible();

    await page.getByTestId("cookie-consent-accept").click();
    await expect(banner).toHaveCount(0);

    const stored = await page.evaluate((key) => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    }, COOKIE_CONSENT_STORAGE_KEY);
    expect(stored).toBe("all");
  });

  test("yalnızca zorunlu seçildiğinde essential kaydedilir", async ({
    page,
  }) => {
    await expect(page.getByTestId("cookie-consent-banner")).toBeVisible();
    await page.getByTestId("cookie-consent-essential").click();

    const stored = await page.evaluate((key) => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    }, COOKIE_CONSENT_STORAGE_KEY);
    expect(stored).toBe("essential");
  });
});
