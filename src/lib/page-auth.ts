import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { auth } from "@/auth";
import type { Actor } from "@/lib/action-auth";

/**
 * Sayfa (Server Component) YETKİ KAPISI — `action-auth.ts`'in sayfa karşılığı.
 *
 * NEDEN VAR (2026-08-31'de ölçüldü): `action-auth.ts` action'lardaki 28 kopyayı
 * kapattı ama MANDALI yalnızca `src/actions/` tarıyor. Sayfalar hiç kapsanmadı ve
 * esnaf panelinin beş sayfası kontrolü elle yazmaya devam etti — üstelik
 * **iki farklı davranışla**:
 *
 *   - `partner/page.tsx`, `partner/earnings`, `partner/seals`, `partner/bookings`
 *     → yetkisizi `/login?callbackUrl=...`'a atıyordu
 *   - `partner/settings`                → yetkisizi sessizce `/${locale}`'e atıyordu
 *
 * Yani giriş YAPMIŞ bir misafir `/partner/seals`'a girdiğinde tekrar giriş
 * ekranına düşüyor, giriş yapıyor, aynı yere dönüyor ve yine atılıyordu — sonsuz
 * döngü. `/partner/settings`'te ise hiç açıklama görmeden ana sayfaya düşüyordu.
 *
 * KURAL, `action-auth.ts`'teki ayrımın aynısı: giriş yapmamış olmak ile yetkisi
 * olmamak ayrı şeylerdir.
 *
 *   - oturum yok  → `/login?callbackUrl=<sayfa>`  (giriş yapınca geri gelir)
 *   - rol yetersiz → `/${locale}`                  (giriş ekranı çözüm değil)
 */

/** Esnaf paneli sayfaları: `PARTNER` veya `ADMIN` — action kapısıyla aynı küme. */
const PARTNER_ROLES = [Role.PARTNER, Role.ADMIN] as const;

async function resolvePageActor<R extends Role>(
  allowed: readonly R[],
  locale: string,
  /** Giriş sonrası dönülecek yol — BAŞINDA dil ÖNEKİ OLMADAN, ör. `/partner/seals`. */
  path: string,
): Promise<Actor<R>> {
  const session = await auth();

  if (!session?.user?.id) {
    const callbackUrl = encodeURIComponent(`/${locale}${path}`);
    redirect(`/${locale}/login?callbackUrl=${callbackUrl}`);
  }

  const role = session.user.role;
  if (!(allowed as readonly Role[]).includes(role)) {
    // Giriş yapmış ama yetkisiz: login'e yollamak döngü üretir.
    redirect(`/${locale}`);
  }

  return { id: session.user.id, role: role as R };
}

/**
 * Esnaf paneli sayfa kapısı.
 *
 * @param locale  aktif dil (`params`'tan)
 * @param path    dil öneki OLMADAN sayfa yolu, ör. `"/partner/earnings"`
 * @returns       doğrulanmış aktör; başarısızlıkta `redirect()` fırlatır
 */
export function requirePartnerPage(
  locale: string,
  path: string,
): Promise<Actor<(typeof PARTNER_ROLES)[number]>> {
  return resolvePageActor(PARTNER_ROLES, locale, path);
}

/** Yönetim paneli sayfa kapısı — aynı gövde, tek rol. */
export function requireAdminPage(
  locale: string,
  path: string,
): Promise<Actor<typeof Role.ADMIN>> {
  return resolvePageActor([Role.ADMIN], locale, path);
}
