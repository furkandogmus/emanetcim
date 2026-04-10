/**
 * Mailto "Yanıtla" konusu: kayıtlı konu zaten Re:/RE: ile başlıyorsa tekrar önek ekleme
 * (Exchange/Outlook bazen "Re: : Re ..." üretir; çift RE: istemezsiniz).
 */
export function replySubjectForMailto(storedSubject: string | null | undefined): string {
  const s = (storedSubject ?? "").trim();
  if (!s) return "RE: ";
  if (/^re\s*:/i.test(s)) return s;
  return `RE: ${s}`;
}

/** Görüntüleme / kayıt için: "Re: : Re foo" → "Re: foo" benzeri sadeleştirme */
export function normalizeInboundSubjectLine(subject: string): string {
  let s = subject.trim().replace(/\s+/g, " ");
  // Outlook zinciri: "Re: : Re" tekrarları
  s = s.replace(/^Re:\s*:\s*Re\s+/i, "Re: ");
  return s.trim();
}
