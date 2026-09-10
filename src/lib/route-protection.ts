/**
 * `startsWith("/partner")` de eslesir ama "/partners" da eslesirdi -- o
 * herkese acik tanitim sayfasi (Header/Footer/FAQ'dan baglaniyor). Bu yuzden
 * segment sinirini (`/partner` veya `/partner/...`) acikca kontrol ediyoruz.
 *
 * `/api/admin` VE `/api/partner` ARTIK BURADA YOK (2026-09-10'da bulundu,
 * `/api/internal` icin proxy.ts'te yapilan ayni duzeltme).
 *
 * `proxy.ts`teki `pathname.startsWith('/api/')` erken donusu, bu fonksiyonlarin
 * cagirildigi rol-kontrolu blogundan (asagida) ONCE calisir -- yani `/api/admin`/
 * `/api/partner` eslesmesi HICBIR ZAMAN ulasilamiyordu, olu koddu. Testler
 * (`isAdminPath("/api/admin") === true`) bu iki namespace'in ortadan
 * korundugu izlenimini veriyordu ama gercekte HER `/api/admin/**` rotasi
 * (ve gelecekte eklenecek her `/api/partner/**` rotasi) KENDI kapisini
 * kurmak zorunda -- ve bugun itibariyle (denetlendi) hepsi zaten `auth()`/
 * `getMobileSession()` + rol kontroluyle kendini koruyor. Silinmesi hicbir
 * korumayi kaldirmiyor, cunku ilettigi koruma zaten yoktu.
 */
export function isAdminPath(pathWithoutLocale: string): boolean {
  return pathWithoutLocale === "/admin" || pathWithoutLocale.startsWith("/admin/");
}

export function isPartnerPath(pathWithoutLocale: string): boolean {
  return pathWithoutLocale === "/partner" || pathWithoutLocale.startsWith("/partner/");
}
