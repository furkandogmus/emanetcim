import { describe, expect, it } from "vitest";
import {
  isValidTrMobile,
  normalizeMerchantProfile,
  validateMerchantProfile,
  type MerchantProfileInput,
} from "@/lib/tr/merchant";

/** Gecerli test degerleri: TCKN NVI algoritmasindan, VKN Maliye algoritmasindan. */
const TCKN = "10000000146";
const VKN = "1000000019";
const IBAN = "TR330006100519786457841326";

function individual(over: Partial<MerchantProfileInput> = {}): MerchantProfileInput {
  return {
    legalType: "INDIVIDUAL",
    legalName: "Ayse Yilmaz",
    tckn: TCKN,
    iban: IBAN,
    ibanHolder: "Ayse Yilmaz",
    addressLine: "Bagdat Cad. No 1",
    city: "Istanbul",
    phone: "05321234567",
    email: "ayse@example.com",
    ...over,
  };
}

function company(over: Partial<MerchantProfileInput> = {}): MerchantProfileInput {
  return {
    legalType: "COMPANY",
    legalName: "Ornek Emanet Ltd. Sti.",
    vkn: VKN,
    taxOffice: "Kadikoy",
    iban: IBAN,
    ibanHolder: "Ornek Emanet Ltd. Sti.",
    addressLine: "Bagdat Cad. No 2",
    city: "Istanbul",
    phone: "+905321234567",
    email: "info@example.com",
    ...over,
  };
}

describe("gerçek kişi (INDIVIDUAL)", () => {
  it("gecerli basvuruyu kabul eder", () => {
    expect(validateMerchantProfile(individual())).toEqual({});
  });

  it("TCKN zorunlu", () => {
    expect(validateMerchantProfile(individual({ tckn: "" })).tckn).toBe("required");
  });

  it("gecersiz TCKN'yi yakalar", () => {
    expect(validateMerchantProfile(individual({ tckn: "12345678901" })).tckn).toBe("invalid");
  });

  it("VKN ve vergi dairesi GERCEK KISIDE olmamali", () => {
    // Gercek kisi vergi mukellefi degildir. Dolu gelmesi formun yanlis tipte
    // doldurulduguna isarettir ve PSP'de reddedilir.
    const e = validateMerchantProfile(individual({ vkn: VKN, taxOffice: "Kadikoy" }));
    expect(e.vkn).toBe("notAllowedForIndividual");
    expect(e.taxOffice).toBe("notAllowedForIndividual");
  });
});

describe("şirket (COMPANY / SOLE_PROPRIETORSHIP)", () => {
  it("gecerli basvuruyu kabul eder", () => {
    expect(validateMerchantProfile(company())).toEqual({});
    expect(validateMerchantProfile(company({ legalType: "SOLE_PROPRIETORSHIP" }))).toEqual({});
  });

  it("VKN ve vergi dairesi zorunlu", () => {
    const e = validateMerchantProfile(company({ vkn: "", taxOffice: "" }));
    expect(e.vkn).toBe("required");
    expect(e.taxOffice).toBe("required");
  });

  it("gecersiz VKN'yi yakalar", () => {
    expect(validateMerchantProfile(company({ vkn: "1234567890" })).vkn).toBe("invalid");
  });

  it("TCKN SIRKETTE olmamali", () => {
    expect(validateMerchantProfile(company({ tckn: TCKN })).tckn).toBe("notAllowedForCompany");
  });
});

describe("ortak alanlar", () => {
  it("IBAN zorunlu ve gecerli olmali", () => {
    expect(validateMerchantProfile(individual({ iban: "" })).iban).toBe("required");
    expect(validateMerchantProfile(individual({ iban: "TR000000000000000000000000" })).iban).toBe("invalid");
  });

  it("IBAN sahibi zorunlu -- PSP unvanla karsilastirir", () => {
    expect(validateMerchantProfile(individual({ ibanHolder: "  " })).ibanHolder).toBe("required");
  });

  it("adres ve sehir zorunlu", () => {
    expect(validateMerchantProfile(individual({ addressLine: "" })).addressLine).toBe("required");
    expect(validateMerchantProfile(individual({ city: "" })).city).toBe("required");
  });

  it("e-posta bicimi kontrol edilir", () => {
    expect(validateMerchantProfile(individual({ email: "gecersiz" })).email).toBe("invalid");
  });

  it("cok kisa unvani reddeder", () => {
    expect(validateMerchantProfile(individual({ legalName: "AB" })).legalName).toBe("tooShort");
  });
});

describe("TR cep telefonu", () => {
  it("gecerli bicimleri kabul eder", () => {
    expect(isValidTrMobile("05321234567")).toBe(true);
    expect(isValidTrMobile("+905321234567")).toBe(true);
    expect(isValidTrMobile("5321234567")).toBe(true);
    expect(isValidTrMobile("0532 123 45 67")).toBe(true);
  });

  it("sabit hatti reddeder", () => {
    // Hakedis bildirimleri SMS ile gidiyor; sabit hat sessizce ulasmaz.
    expect(isValidTrMobile("02121234567")).toBe(false);
  });

  it("eksik/fazla haneyi reddeder", () => {
    expect(isValidTrMobile("053212345")).toBe(false);
    expect(isValidTrMobile("053212345678")).toBe(false);
  });
});

describe("normalizasyon", () => {
  it("tipe ait OLMAYAN alanlari saklamaz", () => {
    // Gercek kisinin VKN'si defterde durursa bir sonraki okuyan hangisinin
    // dogru oldugunu bilemez.
    const n = normalizeMerchantProfile(individual({ vkn: VKN, taxOffice: "Kadikoy" }));
    expect(n.vkn).toBeNull();
    expect(n.taxOffice).toBeNull();
    expect(n.tckn).toBe(TCKN);
  });

  it("sirkette TCKN saklanmaz", () => {
    const n = normalizeMerchantProfile(company({ tckn: TCKN }));
    expect(n.tckn).toBeNull();
    expect(n.vkn).toBe(VKN);
  });

  it("IBAN ve e-postayi tek bicime cevirir", () => {
    const n = normalizeMerchantProfile(individual({
      iban: "tr33 0006 1005 1978 6457 8413 26",
      email: "  Ayse@Example.COM ",
    }));
    expect(n.iban).toBe(IBAN);
    expect(n.email).toBe("ayse@example.com");
  });
});
