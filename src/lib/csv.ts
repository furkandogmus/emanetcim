/**
 * CSV export icin ortak hucre kacislama. Iki gorevi var:
 *  1. RFC 4180 tirnak kacislama (tirnagi ikile).
 *  2. CSV/Formula Injection onleme: hucre `=`, `+`, `-`, `@` veya
 *     tab/CR ile basliyorsa Excel/Sheets/LibreOffice bunu acilista FORMUL
 *     olarak calistirir (ornegin `=HYPERLINK(...)` disari veri sizdirir).
 *     Bu tabanlarin bir kismi (dukkan adi, esnaf basvurusundaki serbest
 *     metin alanlari) tamamen kullanici kontrollu oldugundan her export
 *     bu fonksiyondan gecmeli.
 */
export function csvCell(value: string | number | null | undefined): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) {
    s = `'${s}`;
  }
  return `"${s.replace(/"/g, '""')}"`;
}
