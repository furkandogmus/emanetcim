import config from "@/lib/config";

/**
 * Hizmet saglayicinin hukuki kimligi; KVKK ve Kullanim Kosullari buradan okur.
 * Tescilli bilgi uydurulamaz: bos alan uretimde hic cizilmez, gelistirmede yer
 * tutucu gosterir. Sirket kuruldugunda yalnizca NEXT_PUBLIC_COMPANY_* doldurulur
 * (derleme aninda gomulur, yeni imaj ister).
 */

export type LegalEntityField =
  | "legalName"
  | "mersisNo"
  | "taxOffice"
  | "taxNumber"
  | "address"
  | "kep";

export type LegalEntity = Record<LegalEntityField, string | null> & {
  /** Marka adi; tescilli unvan degildir. */
  tradeName: string;
  /** KVKK m.11 basvuru adresi; tanimsizsa destek adresi. */
  dataRequestEmail: string;
};

const ENV_KEYS: Record<LegalEntityField, string> = {
  legalName: "NEXT_PUBLIC_COMPANY_LEGAL_NAME",
  mersisNo: "NEXT_PUBLIC_COMPANY_MERSIS_NO",
  taxOffice: "NEXT_PUBLIC_COMPANY_TAX_OFFICE",
  taxNumber: "NEXT_PUBLIC_COMPANY_TAX_NUMBER",
  address: "NEXT_PUBLIC_COMPANY_ADDRESS",
  kep: "NEXT_PUBLIC_COMPANY_KEP",
};

export const LEGAL_ENTITY_PLACEHOLDERS: Record<LegalEntityField, string> = {
  legalName: "[ŞİRKET TİCARİ UNVANI]",
  mersisNo: "[MERSİS NO]",
  taxOffice: "[VERGİ DAİRESİ]",
  taxNumber: "[VERGİ KİMLİK NO]",
  address: "[MERKEZ ADRESİ]",
  kep: "[KEP ADRESİ]",
};

/** Kunye satirlarinin sirasi. */
export const LEGAL_ENTITY_ROWS: readonly LegalEntityField[] = [
  "legalName",
  "mersisNo",
  "address",
  "taxOffice",
  "taxNumber",
  "kep",
];

function read(name: string, env: NodeJS.ProcessEnv): string | null {
  const v = env[name]?.trim();
  return v ? v : null;
}

export function getLegalEntity(env: NodeJS.ProcessEnv = process.env): LegalEntity {
  const fields = Object.fromEntries(
    (Object.keys(ENV_KEYS) as LegalEntityField[]).map((f) => [f, read(ENV_KEYS[f], env)]),
  ) as Record<LegalEntityField, string | null>;

  return {
    ...fields,
    tradeName: config.branding.name,
    dataRequestEmail: read("NEXT_PUBLIC_KVKK_EMAIL", env) ?? config.contact.email,
  };
}

/** Dolu deger, yoksa gelistirmede yer tutucu, uretimde `null` (satir cizilmez). */
export function legalEntityDisplay(
  entity: LegalEntity,
  field: LegalEntityField,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  if (entity[field]) return entity[field];
  return env.NODE_ENV === "production" ? null : LEGAL_ENTITY_PLACEHOLDERS[field];
}
