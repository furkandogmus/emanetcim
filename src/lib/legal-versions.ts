/** Kayıt / KVKK için sözleşme anahtarları ve sürüm (env ile yönetilir). */
export const LEGAL_DOC_TERMS = "terms";
export const LEGAL_DOC_PRIVACY = "privacy";

export function getLegalDocumentVersion(docKey: string): string {
  if (docKey === LEGAL_DOC_TERMS) {
    return process.env.LEGAL_TERMS_VERSION?.trim() || "1";
  }
  if (docKey === LEGAL_DOC_PRIVACY) {
    return process.env.LEGAL_PRIVACY_VERSION?.trim() || "1";
  }
  return "1";
}
