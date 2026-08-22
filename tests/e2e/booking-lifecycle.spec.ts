import { test, expect } from "@playwright/test";
import {
  DEMO_PARTNER_SHOP,
  createBookingAsGuest,
  loginAsDemoGuest,
  loginAsDemoPartner,
} from "./helpers/booking-flow";

/**
 * Tam yaşam döngüsü — manuel tahsilat (dükkanda ödeme) akışına göre yazıldı.
 *
 * Eski sürüm kart ödeme dönemindendi ("Kart üzerindeki isim", `/partner/reservations`
 * gibi artık var olmayan yüzeyler) ve 2026-08-22'ye kadar hiç geçmiyordu.
 */
test.describe("Rezervasyon yaşam döngüsü (manuel tahsilat)", () => {
  test.setTimeout(120_000);
  /**
   * SERİ: iki test de aynı demo misafir hesabını kullanır. Paralel koşunca
   * misafir testinin iptali esnaf testinin rezervasyonunu vuruyordu.
   */
  test.describe.configure({ mode: "serial" });

  test("Misafir: arama → rezervasyon → iptal", async ({ page }) => {
    await loginAsDemoGuest(page);
    const bookingId = await createBookingAsGuest(page);

    // Liste en yeni rezervasyonu üstte gösterir; durum etiketi "Onaylandı — Dükkanda öde".
    await page.goto("/tr/bookings");
    await expect(page.getByText(/Onaylandı/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(`a[href*="${bookingId}"]`).first()).toBeAttached();

    // İptal: yalnızca BU rezervasyonun kartındaki "İptal Et" (kart, detay linkini içerir).
    const card = page.locator("article, li, div").filter({
      has: page.locator(`a[href*="${bookingId}"]`),
    }).filter({ has: page.getByRole("button", { name: /^İptal Et$/i }) }).last();
    await card.getByRole("button", { name: /^İptal Et$/i }).click();
    await page.getByRole("button", { name: /İptali onayla/i }).click();
    await expect(page.getByText(/iptal edildi|İptal tamamlandı/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("Esnaf: onaylı rezervasyonu teslim al → teslim et", async ({ page: guestPage, browser }) => {
    await loginAsDemoGuest(guestPage);
    // Rezervasyon demo esnafın dükkanına olmalı; başka dükkanın rezervasyonunu göremez.
    const bookingId = await createBookingAsGuest(guestPage, DEMO_PARTNER_SHOP);

    // Esnaf AYRI bir tarayıcı bağlamında: çerez temizleyip aynı sekmede giriş yapmak
    // istemci oturum önbelleği yüzünden /search'e geri sekiyordu.
    const partnerContext = await browser.newContext();
    const page = await partnerContext.newPage();
    await loginAsDemoPartner(page);

    // QR'ın URL karşılığı: esnaf paneli ?booking=<id> ile check-in kutusunu açar.
    await page.goto(`/tr/partner?booking=${bookingId}`);
    const checkInButton = page.getByRole("button", { name: /MÜHÜRLE VE BAŞLAT/i });
    await expect(checkInButton).toBeVisible({ timeout: 15_000 });
    await checkInButton.click();
    await expect(page.getByText(/Emanet Başarıyla Alındı/i)).toBeVisible({ timeout: 15_000 });

    // Teslim: QR'ın URL karşılığı `?checkoutBooking=<id>` teslim kutusunu doğrudan açar.
    // (Panelin geçmiş listesi yalnızca esnafın İLK dükkanını gösterir — çok dükkanlı
    // esnafta diğer dükkanın valizi listede yoktur; bkz. DEFECT_BACKLOG P2.)
    await page.goto(`/tr/partner?checkoutBooking=${bookingId}`);
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15_000 });

    // Mühür kaydı varsa tek tek onay, yoksa genel onay kutusu.
    const sealBoxes = page.getByRole("dialog").getByRole("checkbox");
    if ((await sealBoxes.count()) > 0) {
      for (let i = 0; i < (await sealBoxes.count()); i++) await sealBoxes.nth(i).check();
      await page.getByRole("button", { name: /Tüm mühürleri onayla/i }).click();
    } else {
      await page.getByRole("dialog").getByRole("button", { name: /ONAYLA/i }).click();
    }
    await expect(page.getByText(/Teslim tamamlandı/i)).toBeVisible({ timeout: 15_000 });
    await partnerContext.close();
  });
});
