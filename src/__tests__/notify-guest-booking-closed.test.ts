import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * `notifyGuestBookingClosed` metni: yonetici aciklamasi misafire ASLA gitmez
 * (ic not); esnafin "diger" aciklamasi iptalin sebebi oldugu icin gider ve
 * kacirilir. Gelmedi kendi basligini tasir; suresi dolma hic bildirim uretmez.
 */

const m = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/lib/db", () => ({ default: { booking: { findUnique: m.findUnique } } }));
vi.mock("@/lib/logger", () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/site-base-url", () => ({ getSiteBaseUrl: () => "https://ornek.test" }));

import { notificationService } from "@/services/NotificationService";

const ADMIN_NOTE = "GIZLI-IC-NOT misafir tehdit etti";

let sendEmail: ReturnType<typeof vi.spyOn>;
let sendPush: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.restoreAllMocks();
  m.findUnique.mockReset().mockResolvedValue({
    guestId: "g1",
    guestEmail: null,
    guest: { email: "misafir@ornek.com" },
    shop: { name: "Kadıköy Emanet" },
  });
  sendEmail = vi.spyOn(notificationService, "sendEmail").mockResolvedValue(true);
  sendPush = vi.spyOn(notificationService, "sendMobilePush").mockResolvedValue(true);
});

function sent() {
  expect(sendEmail).toHaveBeenCalledTimes(1);
  const [to, subject, text, , html] = sendEmail.mock.calls[0] as [string, string, string, string, string];
  return { to, subject, text, html };
}

describe("notifyGuestBookingClosed", () => {
  it("yonetici iptali: aciklama ne duz metinde ne HTML'de", async () => {
    await notificationService.notifyGuestBookingClosed({
      bookingId: "b1",
      reason: "admin_cancel",
      note: ADMIN_NOTE,
      locale: "tr",
    });
    const e = sent();
    expect(e.to).toBe("misafir@ornek.com");
    expect(e.text).not.toContain("GIZLI-IC-NOT");
    expect(e.html).not.toContain("GIZLI-IC-NOT");
    expect(e.text).toContain("destek ekibi");
  });

  it("esnaf iptali 'diger': neden etiketi ve aciklama gider, HTML'de kacirilir", async () => {
    await notificationService.notifyGuestBookingClosed({
      bookingId: "b1",
      reason: "partner_cancel",
      detail: "other",
      note: "Su kesildi <b>bugun</b>",
      locale: "en",
    });
    const e = sent();
    expect(e.text).toContain("Reason: Other");
    expect(e.text).toContain("Su kesildi");
    expect(e.html).toContain("Su kesildi &lt;b&gt;bugun&lt;/b&gt;");
    expect(e.html).not.toContain("<b>bugun</b>");
  });

  it("esnaf iptali 'diger' disi: aciklama gitmez, yalniz etiket", async () => {
    await notificationService.notifyGuestBookingClosed({
      bookingId: "b1",
      reason: "partner_cancel",
      detail: "capacity",
      note: "ic not",
      locale: "en",
    });
    const e = sent();
    expect(e.text).toContain("The shop has no space left");
    expect(e.text).not.toContain("ic not");
  });

  it("gelmedi kendi konusunu tasir", async () => {
    await notificationService.notifyGuestBookingClosed({ bookingId: "b1", reason: "no_show", locale: "en" });
    expect(sent().subject).toBe("BagajPark: We missed you");
  });

  it("suresi dolma hic bildirim uretmez", async () => {
    await notificationService.notifyGuestBookingClosed({ bookingId: "b1", reason: "expired_no_dropoff", locale: "tr" });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendPush).not.toHaveBeenCalled();
  });

  it("e-postasi olmayan misafire e-posta gitmez", async () => {
    m.findUnique.mockResolvedValue({ guestId: "g1", guestEmail: null, guest: { email: null }, shop: { name: "X" } });
    await notificationService.notifyGuestBookingClosed({ bookingId: "b1", reason: "guest_cancel", locale: "tr" });
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
