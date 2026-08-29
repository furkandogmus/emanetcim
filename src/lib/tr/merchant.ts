import { isValidTckn, isValidTrIban, isValidVkn, normalizeTrIban } from "./identity";

/**
 * Alt üye iş yeri (sub-merchant) başvurusunun Türkiye kurallarına göre
 * doğrulanması.
 *
 * NEDEN BURADA, ADAPTÖRDE DEĞİL: hangi alanın zorunlu olduğu PSP'nin değil,
 * Türkiye'deki tüzel kişilik tipinin sonucu. Gerçek kişinin vergi dairesi yoktur,
 * şirketin TCKN'si yoktur. Bunu adaptöre gömmek, sağlayıcı değiştiğinde aynı
 * kuralların ikinci kez (ve büyük ihtimalle eksik) yazılması demek olurdu.
 *
 * Doğrulama başvuru ALINIRKEN yapılır. Aksi halde eksik başvuru PSP'ye gider,
 * oradan gün(ler) sonra "reddedildi" olarak döner ve esnaf neyi düzelteceğini
 * bilmez — alan bazlı hata mesajı ancak burada üretilebilir.
 */

export type MerchantLegalType =
  | "INDIVIDUAL"
  | "SOLE_PROPRIETORSHIP"
  | "COMPANY";

export type MerchantProfileInput = {
  legalType: MerchantLegalType;
  legalName: string;
  tckn?: string | null;
  vkn?: string | null;
  taxOffice?: string | null;
  iban: string;
  ibanHolder: string;
  addressLine: string;
  city: string;
  district?: string | null;
  phone: string;
  email: string;
};

/** Alan adı -> hata anahtarı. Anahtarlar çeviri dosyalarına karşılık gelir. */
export type MerchantValidationErrors = Partial<
  Record<keyof MerchantProfileInput, string>
>;

function isBlank(v: string | null | undefined): boolean {
  return !v || v.trim().length === 0;
}

/** TR cep telefonu: +90 5XX ... veya 05XX ... Sabit hat kabul edilmez. */
export function isValidTrMobile(value: string): boolean {
  const d = value.replace(/\D/g, "");
  // +905xxxxxxxxx -> 12 hane, 05xxxxxxxxx -> 11 hane, 5xxxxxxxxx -> 10 hane
  const national = d.startsWith("90") && d.length === 12
    ? d.slice(2)
    : d.startsWith("0") && d.length === 11
      ? d.slice(1)
      : d;
  return national.length === 10 && national.startsWith("5");
}

/**
 * Başvuruyu doğrular. Boş nesne dönerse başvuru gönderilebilir.
 *
 * Kurallar tüzel kişilik tipine göre değişir:
 *   INDIVIDUAL           -> TCKN zorunlu, VKN ve vergi dairesi OLMAMALI
 *   SOLE_PROPRIETORSHIP  -> VKN + vergi dairesi zorunlu
 *   COMPANY              -> VKN + vergi dairesi zorunlu
 */
export function validateMerchantProfile(
  input: MerchantProfileInput,
): MerchantValidationErrors {
  const errors: MerchantValidationErrors = {};

  if (isBlank(input.legalName)) {
    errors.legalName = "required";
  } else if (input.legalName.trim().length < 3) {
    errors.legalName = "tooShort";
  }

  if (input.legalType === "INDIVIDUAL") {
    if (isBlank(input.tckn)) {
      errors.tckn = "required";
    } else if (!isValidTckn(input.tckn as string)) {
      errors.tckn = "invalid";
    }
    // Gerçek kişi vergi mükellefi değildir; bu alanların dolu gelmesi formun
    // yanlış tipte doldurulduğunu gösterir ve PSP'de reddedilir.
    if (!isBlank(input.vkn)) errors.vkn = "notAllowedForIndividual";
    if (!isBlank(input.taxOffice)) {
      errors.taxOffice = "notAllowedForIndividual";
    }
  } else {
    if (isBlank(input.vkn)) {
      errors.vkn = "required";
    } else if (!isValidVkn(input.vkn as string)) {
      errors.vkn = "invalid";
    }
    if (isBlank(input.taxOffice)) errors.taxOffice = "required";
    if (!isBlank(input.tckn)) errors.tckn = "notAllowedForCompany";
  }

  if (isBlank(input.iban)) {
    errors.iban = "required";
  } else if (!isValidTrIban(input.iban)) {
    errors.iban = "invalid";
  }

  // PSP'ler IBAN sahibi ile unvanı karşılaştırır; boş bırakılırsa başvuru
  // gönderilir ve karşı tarafta reddedilir.
  if (isBlank(input.ibanHolder)) errors.ibanHolder = "required";

  if (isBlank(input.addressLine)) errors.addressLine = "required";
  if (isBlank(input.city)) errors.city = "required";

  if (isBlank(input.phone)) {
    errors.phone = "required";
  } else if (!isValidTrMobile(input.phone)) {
    errors.phone = "invalid";
  }

  if (isBlank(input.email)) {
    errors.email = "required";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    errors.email = "invalid";
  }

  return errors;
}

/** Doğrulanmış başvuruyu saklama biçimine çevirir. */
export function normalizeMerchantProfile(
  input: MerchantProfileInput,
): MerchantProfileInput {
  const individual = input.legalType === "INDIVIDUAL";
  return {
    ...input,
    legalName: input.legalName.trim(),
    // Tipe ait olmayan alanlar SAKLANMAZ: gerçek kişinin VKN'si, şirketin
    // TCKN'si defterde durursa bir sonraki okuyan hangisinin doğru olduğunu
    // bilemez.
    tckn: individual ? (input.tckn ?? "").replace(/\D/g, "") || null : null,
    vkn: individual ? null : (input.vkn ?? "").replace(/\D/g, "") || null,
    taxOffice: individual ? null : (input.taxOffice ?? "").trim() || null,
    iban: normalizeTrIban(input.iban),
    ibanHolder: input.ibanHolder.trim(),
    addressLine: input.addressLine.trim(),
    city: input.city.trim(),
    district: input.district?.trim() || null,
    phone: input.phone.replace(/\s/g, ""),
    email: input.email.trim().toLowerCase(),
  };
}
