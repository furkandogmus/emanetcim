import { Role } from "@prisma/client";
import { auth } from "@/auth";

/**
 * Server action YETKİ KAPISI — tek yer.
 *
 * NEDEN VAR (2026-08-25'te ölçüldü): aynı üç kontrol (`giriş yapmış mı`,
 * `admin mi`, `esnaf mı`) **12 dosyada ~28 kez** elle yazılmıştı. Sorun tekrar
 * değildi sadece; kopyalar **beş farklı başarısızlık konvansiyonu** kullanıyordu:
 *
 *   1. `throw new Error("Unauthorized")`            — 8 yerde
 *   2. `throw new Error("Errors.notAuthorizedAdmin")` — 1 yerde
 *   3. `return { error: "Errors.authRequired" }`      — çoğunluk
 *   4. `return { error: "Errors.unauthorized" }` / `"Errors.notAuthorizedAdmin"`
 *   5. `return { error: "unauthorized" }` (snake_case) — `seal.ts`
 *
 * Kullanıcı açısından sonucu şuydu: **aynı "yetkiniz yok" durumu, hangi dosyaya
 * denk geldiğine göre dört farklı mesaj üretiyordu.** Üstelik 1. gruptaki ham
 * `"Unauthorized"` metni `actionErrorKey`'in tanıdığı bir anahtar değil — yani
 * `generic`e düşüyor ve yönetici "Bilinmeyen bir hata oluştu" okuyordu; sebebi
 * söyleyebilecekken söylemiyordu.
 *
 * İKİ BİÇİM, TEK GÖVDE:
 *   - `requireX()`  → `{ ok, actor | error }` döner. Sonuç dönen action'lar için.
 *   - `assertX()`   → TANINAN bir anahtarla fırlatır. Fırlatan action'lar için;
 *     `actionErrorKey` onu doğru mesaja çevirir.
 *
 * İkisi de aynı `resolveActor`'ı kullanır, yani kural tek yerde durur.
 */

/**
 * Rol JENERIK: `requirePartner()` calisma zamaninda zaten daraltiyor, tip de
 * daralmali. Aksi halde cagiran `PARTNER | ADMIN` bekleyen bir servise `GUEST`
 * ihtimalini tasiyan bir aktor gecirmeye calisir ve ya derleme kirilir ya da
 * `as` ile susturulur — ikincisi kapiyi anlamsiz kilar.
 */
export type Actor<R extends Role = Role> = { id: string; role: R };

export type AuthResult<R extends Role = Role> =
  | { ok: true; actor: Actor<R> }
  | { ok: false; error: AuthErrorKey };

/**
 * Kullanıcıya gösterilen anahtarlar. Üçü de `Errors` sözlüğünde var ve
 * `actionErrorKey`'in TANIDIĞI kümede — fırlatma yolu da aynı metni üretir.
 */
export type AuthErrorKey =
  | "Errors.authRequired"
  | "Errors.notAuthorizedAdmin"
  | "Errors.notAuthorizedPartner"
  | "Errors.unauthorized";

/** Esnaf işlemlerini admin de yapabilir; kural tek yerde yazılı. */
const PARTNER_ROLES = [Role.PARTNER, Role.ADMIN] as const;

async function resolveActor<R extends Role>(
  allowed: readonly R[],
  denied: AuthErrorKey,
): Promise<AuthResult<R>> {
  const session = await auth();
  /*
    Giriş YAPMAMIŞ olmak ile YETKİSİ OLMAMAK ayrı şeyler: ilki "giriş yapın"
    demeli, ikincisi "bu işlem size kapalı". Kopyaların bir kısmı ikisini de
    `authRequired` ile karşılıyordu, yani yetkisiz bir kullanıcıya tekrar giriş
    yapmasını söylüyordu.
  */
  if (!session?.user?.id) return { ok: false, error: "Errors.authRequired" };
  const role = session.user.role;
  if (!(allowed as readonly Role[]).includes(role)) return { ok: false, error: denied };
  return { ok: true, actor: { id: session.user.id, role: role as R } };
}

/** Yalnızca giriş yapmış olmak yeter (rol farketmez). */
export function requireUser(): Promise<AuthResult> {
  return resolveActor([Role.GUEST, Role.PARTNER, Role.ADMIN], "Errors.unauthorized");
}

export function requireAdmin(): Promise<AuthResult<typeof Role.ADMIN>> {
  return resolveActor([Role.ADMIN], "Errors.notAuthorizedAdmin");
}

/** Esnaf paneli işlemleri: `PARTNER` veya `ADMIN`. */
export function requirePartner(): Promise<AuthResult<(typeof PARTNER_ROLES)[number]>> {
  return resolveActor(PARTNER_ROLES, "Errors.notAuthorizedPartner");
}

/**
 * Fırlatan action'lar için. Mesaj TANINAN bir anahtardır: `actionErrorKey` onu
 * `generic`e düşürmez, kullanıcı gerçek sebebi görür.
 */
async function assertRole<R extends Role>(
  allowed: readonly R[],
  denied: AuthErrorKey,
): Promise<Actor<R>> {
  const result = await resolveActor(allowed, denied);
  if (!result.ok) throw new Error(result.error);
  return result.actor;
}

export function assertAdmin(): Promise<Actor<typeof Role.ADMIN>> {
  return assertRole([Role.ADMIN], "Errors.notAuthorizedAdmin");
}

export function assertPartner(): Promise<Actor<(typeof PARTNER_ROLES)[number]>> {
  return assertRole(PARTNER_ROLES, "Errors.notAuthorizedPartner");
}
