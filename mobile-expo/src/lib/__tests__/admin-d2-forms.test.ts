import { describe, expect, it } from "@jest/globals";

import {
  EMPTY_CAMPAIGN_FORM,
  campaignBody,
  campaignFormIssues,
  campaignToForm,
  isCampaignExpired,
} from "@/lib/admin-campaigns";
import { EMPTY_PARTNER_FORM, formFromGuest, partnerBody, partnerFormIssues } from "@/lib/admin-partner-new";
import { checkTone, jobTone, systemHeadline } from "@/lib/admin-system";
import type { AdminCampaign } from "@/lib/types";

const CAMPAIGN: AdminCampaign = {
  id: "c1",
  name: "Yaz",
  message: null,
  discountPercent: 12.5,
  isActive: true,
  startsAt: null,
  endsAt: "2026-12-31T00:00:00.000Z",
  createdAt: "2026-11-01T10:00:00.000Z",
};

describe("kampanya formu", () => {
  it("bos ad ve aralik disi indirim gonderilmez", () => {
    expect(campaignFormIssues(EMPTY_CAMPAIGN_FORM)).toEqual(["name"]);
    expect(campaignFormIssues({ ...EMPTY_CAMPAIGN_FORM, name: "A", discount: "150" })).toEqual(["discount"]);
    expect(campaignFormIssues({ ...EMPTY_CAMPAIGN_FORM, name: "A", discount: "abc" })).toEqual(["discount"]);
    expect(campaignFormIssues({ ...EMPTY_CAMPAIGN_FORM, name: "A", endsAt: "31.12.2026" })).toEqual(["endsAt"]);
    expect(campaignFormIssues({ ...EMPTY_CAMPAIGN_FORM, name: "A", endsAt: "2026-02-30" })).toEqual(["endsAt"]);
  });

  it("govde web formuyla ayni: tarih UTC gece yarisi, bos alan null, virgullu ondalik", () => {
    expect(campaignBody({ name: " Kis ", message: "  ", discount: "7,5", endsAt: "2026-12-31" })).toEqual({
      name: "Kis",
      message: null,
      discountPercent: 7.5,
      endsAt: "2026-12-31T00:00:00.000Z",
    });
    expect(campaignBody({ ...EMPTY_CAMPAIGN_FORM, name: "A" })).toMatchObject({ discountPercent: null, endsAt: null });
  });

  it("duzenleme formu kayittan dolar ve ayni govdeyi geri uretir", () => {
    const f = campaignToForm(CAMPAIGN);
    expect(f).toEqual({ name: "Yaz", message: "", discount: "12.5", endsAt: "2026-12-31" });
    expect(campaignBody(f).endsAt).toBe(CAMPAIGN.endsAt);
  });

  it("bitis gecmisse suresi dolmus sayilir", () => {
    expect(isCampaignExpired(CAMPAIGN, new Date("2027-01-01T00:00:00Z"))).toBe(true);
    expect(isCampaignExpired(CAMPAIGN, new Date("2026-12-01T00:00:00Z"))).toBe(false);
    expect(isCampaignExpired({ endsAt: null })).toBe(false);
  });
});

describe("esnaf olusturma formu", () => {
  const filled = {
    ...EMPTY_PARTNER_FORM,
    ownerName: "Ali Veli",
    phone: "0555 000 00 00",
    shopName: "Ornek Bufe",
    shopAddress: "Ornek Mah. No:1",
    location: "36.5, 31.9",
  };

  it("yeni hesapta ad zorunlu, cevirmede degil", () => {
    expect(partnerFormIssues({ ...filled, ownerName: "" }, false)).toEqual(["ownerName"]);
    expect(partnerFormIssues({ ...filled, ownerName: "" }, true)).toEqual([]);
    expect(partnerFormIssues({ ...filled, phone: "555" }, false)).toEqual(["phone"]);
    expect(partnerFormIssues({ ...filled, email: "bozuk" }, false)).toEqual(["email"]);
  });

  it("cevirme govdesi ad ve e-posta tasimaz (sunucu strict)", () => {
    const body = partnerBody({ ...filled, email: "x@example.com", city: "" }, "u1");
    expect(body).toEqual({
      fromUserId: "u1",
      phone: "0555 000 00 00",
      shopName: "Ornek Bufe",
      shopAddress: "Ornek Mah. No:1",
      location: "36.5, 31.9",
    });
    expect(partnerBody({ ...filled, email: " x@example.com " }, null)).toMatchObject({
      ownerName: "Ali Veli",
      email: "x@example.com",
    });
    expect(partnerBody(filled, null)).not.toHaveProperty("email");
  });

  it("misafirden gelen form kimlik alanlarini doldurur", () => {
    expect(formFromGuest({ id: "u1", name: "Ayse", email: "a@example.com", phone: null })).toMatchObject({
      ownerName: "Ayse",
      email: "a@example.com",
      phone: "",
    });
  });
});

describe("sistem ekrani tonlari", () => {
  it("cron'u kurulmamis is kirmizi degil, beklemede", () => {
    expect(jobTone({ status: "stale", enforced: true })).toBe("danger");
    expect(jobTone({ status: "never_run", enforced: false })).toBe("muted");
    expect(jobTone({ status: "ok", enforced: true })).toBe("ok");
  });

  it("SMS eksikligi uyari, veritabani eksikligi hata", () => {
    expect(checkTone("missing", true)).toBe("warning");
    expect(checkTone("error")).toBe("danger");
    expect(checkTone("ok")).toBe("ok");
  });

  it("gecikmis zorunlu is varken baslik 'sorun yok' demez", () => {
    expect(systemHeadline({ healthLevel: "ok", enforcedStale: 1 })).toBe("warning");
    expect(systemHeadline({ healthLevel: "error", enforcedStale: 2 })).toBe("error");
    expect(systemHeadline({ healthLevel: "ok", enforcedStale: 0 })).toBe("ok");
  });
});
