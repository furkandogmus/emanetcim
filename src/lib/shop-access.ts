import prisma from "@/lib/db";

/**
 * Dukkan YETKI KAPISI: "bu kullanici bu dukkanda ne yapabilir" sorusunun tek cevabi.
 *
 * Iki seviye:
 *   - `operate`: rezervasyonu gor, QR / teslim al / teslim et, gelmedi, valiz revizyonu,
 *     "misafiri bekle", muhur operasyonu. Sahip, personel ve yonetici.
 *   - `manage`: kazanc, odeme/banka, dukkan ayarlari/saat/fiyat/foto, afis, ekip,
 *     iptal/onay/ret. Sahip ve yonetici; personel ASLA.
 *
 * Yetki her istekte veritabanindan okunur (bellek/oturum onbellegi yok): sahip personeli
 * cikardigi an bir sonraki istek reddedilir. Personel `PARTNER` rolu ALMAZ (sektor
 * standardi: personel esnaf degildir, onboarding/merchant hesabi yok); rolu ne olursa
 * olsun yetkisi `ShopMember` satirindan gelir.
 */

export type ShopAccessLevel = "operate" | "manage";
export type ShopRelation = "admin" | "owner" | "staff";
export type ShopAccessActor = { id: string; role: string };
export type ShopAccessCode = "NOT_FOUND" | "FORBIDDEN";

export type ShopAccessResult =
  | { ok: true; relation: ShopRelation; shop: { id: string; ownerId: string } }
  | { ok: false; code: ShopAccessCode };

export function relationAllows(relation: ShopRelation | null, level: ShopAccessLevel): boolean {
  if (!relation) return false;
  if (level === "operate") return true;
  return relation === "admin" || relation === "owner";
}

/** Dukkan satiri elde varsa ikinci sorgu yapilmaz; personel icin tek `findUnique`. */
export async function resolveShopRelation(
  actor: ShopAccessActor,
  shop: { id: string; ownerId: string },
): Promise<ShopRelation | null> {
  if (actor.role === "ADMIN") return "admin";
  if (shop.ownerId === actor.id) return "owner";
  const member = await prisma.shopMember.findUnique({
    where: { shopId_userId: { shopId: shop.id, userId: actor.id } },
    select: { id: true },
  });
  return member ? "staff" : null;
}

export async function hasShopAccess(
  actor: ShopAccessActor,
  shop: { id: string; ownerId: string },
  level: ShopAccessLevel,
): Promise<boolean> {
  return relationAllows(await resolveShopRelation(actor, shop), level);
}

/**
 * Kimligi istemciden gelen dukkan icin kapi. Yetkisiz ile yok AYIRT EDILMEZ disinda
 * (cagiran isterse ikisini de 404'e cevirir); burada ikisi ayri kod.
 */
export async function assertShopAccess(
  actor: ShopAccessActor,
  shopId: string,
  level: ShopAccessLevel,
): Promise<ShopAccessResult> {
  const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { id: true, ownerId: true } });
  if (!shop) return { ok: false, code: "NOT_FOUND" };
  const relation = await resolveShopRelation(actor, shop);
  if (!relationAllows(relation, level)) return { ok: false, code: "FORBIDDEN" };
  return { ok: true, relation: relation!, shop };
}

export type AccessibleShop = { id: string; name: string; isActive: boolean; relation: "owner" | "staff" };

/** Sabit sira: once sahip olunanlar (en yeni), sonra personel olunanlar (en yeni). */
export async function listAccessibleShops(
  userId: string,
  level: ShopAccessLevel,
): Promise<AccessibleShop[]> {
  const owned = await prisma.shop.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, isActive: true },
  });
  const result: AccessibleShop[] = owned.map((s) => ({ ...s, relation: "owner" }));
  if (level === "manage") return result;
  const memberships = await prisma.shopMember.findMany({
    where: { userId, shop: { ownerId: { not: userId } } },
    orderBy: { shop: { createdAt: "desc" } },
    select: { shop: { select: { id: true, name: true, isActive: true } } },
  });
  for (const m of memberships) result.push({ ...m.shop, relation: "staff" });
  return result;
}

/** Kullanicinin personel oldugu dukkan sayisi (rolu ne olursa olsun). */
export function countStaffShops(userId: string): Promise<number> {
  return prisma.shopMember.count({ where: { userId } });
}

/** `operate` seviyesinde erisilen dukkan kimlikleri: liste ve arama sorgularinin kapsami. */
export async function operableShopIds(userId: string): Promise<string[]> {
  return (await listAccessibleShops(userId, "operate")).map((s) => s.id);
}
