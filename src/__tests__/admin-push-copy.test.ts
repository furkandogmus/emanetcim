import { describe, expect, it } from "vitest";

import { ADMIN_PUSH_COPY, adminPushLang, disputeReasonLabel } from "@/lib/admin-push-copy";

describe("yonetici push metni", () => {
  it("sikayet nedeni enum yerine cevrilmis etiketle yazilir", () => {
    expect(ADMIN_PUSH_COPY.tr.dispute({ code: "AB12", reason: "THEFT" }).body).toBe("Rezervasyon AB12 · Hırsızlık");
    expect(ADMIN_PUSH_COPY.en.dispute({ code: "AB12", reason: "DAMAGE" }).body).toBe("Booking AB12 · Damage");
  });

  it("bilinmeyen neden ham deger olarak basilmaz", () => {
    expect(disputeReasonLabel("tr", "<b>x</b>")).toBe("Diğer");
    expect(disputeReasonLabel("en", undefined)).toBe("Other");
  });

  it("ad yoksa genel metin; cihaz dili tr degilse Ingilizce", () => {
    expect(ADMIN_PUSH_COPY.tr.partnerApplication({}).body).toBe("Yeni bir esnaf başvurusu onay bekliyor.");
    expect(adminPushLang("tr-TR")).toBe("tr");
    expect(adminPushLang("de-DE")).toBe("en");
    expect(adminPushLang(null)).toBe("en");
  });
});
