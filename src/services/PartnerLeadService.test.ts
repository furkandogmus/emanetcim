import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({ default: {} }));
vi.mock("@/services/NotificationService", () => ({ notificationService: {} }));
vi.mock("@/services/ShopService", () => ({ shopService: {} }));
vi.mock("@/lib/partner-reset-link", () => ({ createPartnerResetLink: vi.fn() }));

import { leadConversionDraft, normalizeTrPhone } from "./PartnerLeadService";

describe("normalizeTrPhone", () => {
  it.each([
    ["0532 123 45 67", "5321234567"],
    ["+90 532 123 45 67", "5321234567"],
    ["5321234567", "5321234567"],
    ["0212 555 12 34", "2125551234"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeTrPhone(input)).toBe(expected);
  });

  it.each(["123", "0612 555 12 34", "05321234567 9", "abc"])("%s reddedilir", (input) => {
    expect(normalizeTrPhone(input)).toBeNull();
  });
});

describe("leadConversionDraft (on dolgu)", () => {
  const lead = { fullName: "Deneme Esnaf", phone: "5321234567", shopName: "Deneme Emanet", address: "Ornek Mah. No 1" };

  it("ad, GSM, dukkan adi ve adres on kayittan gelir; konum bos kalir", () => {
    expect(leadConversionDraft(lead)).toEqual({
      ownerName: "Deneme Esnaf",
      phone: "05321234567",
      email: "",
      shopName: "Deneme Emanet",
      shopAddress: "Ornek Mah. No 1",
      city: "",
      district: "",
      location: "",
    });
  });

  it("sabit hat esnaf hesabina yazilamaz: telefon bos gelir", () => {
    expect(leadConversionDraft({ ...lead, phone: "2125551234" }).phone).toBe("");
  });

  it("dukkan adi yoksa bos", () => {
    expect(leadConversionDraft({ ...lead, shopName: null }).shopName).toBe("");
  });
});
