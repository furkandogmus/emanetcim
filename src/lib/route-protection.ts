/**
 * `startsWith("/partner")` de eslesir ama "/partners" da eslesirdi -- o
 * herkese acik tanitim sayfasi (Header/Footer/FAQ'dan baglaniyor). Bu yuzden
 * segment sinirini (`/partner` veya `/partner/...`) acikca kontrol ediyoruz.
 */
export function isAdminPath(pathWithoutLocale: string): boolean {
  return (
    pathWithoutLocale === "/admin" ||
    pathWithoutLocale.startsWith("/admin/") ||
    pathWithoutLocale === "/api/admin" ||
    pathWithoutLocale.startsWith("/api/admin/")
  );
}

export function isPartnerPath(pathWithoutLocale: string): boolean {
  return (
    pathWithoutLocale === "/partner" ||
    pathWithoutLocale.startsWith("/partner/") ||
    pathWithoutLocale === "/api/partner" ||
    pathWithoutLocale.startsWith("/api/partner/")
  );
}
