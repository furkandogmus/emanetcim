/**
 * Anonimlestirilmis hesabin e-posta alani bu alan adiyla biter (`AccountPrivacyService.anonymizeSelf`).
 * Satir silinmedigi icin "silinmis hesap" sorgularda bu sonekle ayirt edilir.
 */
export const ANONYMIZED_EMAIL_DOMAIN = "@invalid.local";

/** Hesap anonimlestirilmis mi (silinmis hesap). */
export function isAnonymizedEmail(email: string | null | undefined): boolean {
  return !!email && email.trim().toLowerCase().endsWith(ANONYMIZED_EMAIL_DOMAIN);
}
