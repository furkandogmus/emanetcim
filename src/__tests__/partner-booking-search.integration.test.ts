/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.unmock("@/lib/db");

/**
 * Esnaf aramasinin SQL'i gercek Postgres'te (kural 3, 2026-11-22). Katlama,
 * LIKE kacirma ve telefon rakam kuyrugu sahte Prisma ile olculemez.
 * CI'da (`CI=true` + `DATABASE_URL`) ya da `RUN_DB_TESTS=1` ile kosar.
 */
const run =
  Boolean(process.env.DATABASE_URL) && (process.env.CI === "true" || process.env.RUN_DB_TESTS === "1");

describe.skipIf(!run)("esnaf rezervasyon aramasi (gercek DB)", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;
  let findPartnerBookingIds: (shopIds: string[], q: string) => Promise<string[]>;
  const suf = `srch-${Date.now()}`;
  const ids: Record<string, string> = {};
  let shopA = "";
  let shopA2 = "";
  let shopB = "";
  const userIds: string[] = [];

  beforeAll(async () => {
    prisma = (await import("@/lib/db")).default;
    ({ findPartnerBookingIds } = await import("@/services/PartnerBookingSearchService"));

    const owner = async (tag: string) => {
      const u = await prisma.user.create({ data: { email: `${tag}-${suf}@test.local`, role: "PARTNER" } });
      userIds.push(u.id);
      return u.id;
    };
    const ownerA = await owner("a");
    const ownerB = await owner("b");
    shopA = (await prisma.shop.create({ data: { ownerId: ownerA, name: "A" } })).id;
    shopA2 = (await prisma.shop.create({ data: { ownerId: ownerA, name: "A2" } })).id;
    shopB = (await prisma.shop.create({ data: { ownerId: ownerB, name: "B" } })).id;

    const guest = async (name: string, phone: string | null) => {
      const u = await prisma.user.create({ data: { name, phone, email: `${name.length}-${Math.random()}-${suf}@test.local` } });
      userIds.push(u.id);
      return u.id;
    };
    const ilker = await guest("İLKER Şahin", "+90 555 111 2233");
    const other = await guest("Ayşe_Yılmaz", "05559998877");
    const sameNameOtherPartner = await guest("İlker Başka", "5554443322");

    const booking = async (key: string, data: Record<string, unknown>) => {
      const b = await prisma.booking.create({
        data: {
          checkInTime: new Date(),
          checkOutTime: new Date(Date.now() + 3600_000),
          ...data,
        },
      });
      ids[key] = b.id;
    };
    await booking("ilker", { shopId: shopA, guestId: ilker });
    await booking("ayse", { shopId: shopA2, guestId: other });
    await booking("guestPhone", { shopId: shopA, guestEmail: `g-${suf}@test.local`, guestPhone: "(0532) 765-4321" });
    await booking("otherPartner", { shopId: shopB, guestId: sameNameOtherPartner });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.booking.deleteMany({ where: { id: { in: Object.values(ids) } } });
    await prisma.shop.deleteMany({ where: { id: { in: [shopA, shopA2, shopB] } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  const own = () => [shopA, shopA2];

  it("ad: harf ve Turkce aksan duyarsiz 'icerir'", async () => {
    for (const q of ["ilker", "İlker", "ILKER", "şahin", "SAHIN", "lker ş"]) {
      expect(await findPartnerBookingIds(own(), q), q).toEqual([ids.ilker]);
    }
  });

  it("baska esnafin rezervasyonu ASLA donmez", async () => {
    const found = await findPartnerBookingIds(own(), "ilker");
    expect(found).not.toContain(ids.otherPartner);
    expect(await findPartnerBookingIds([shopB], "ilker")).toEqual([ids.otherPartner]);
    expect(await findPartnerBookingIds([], "ilker")).toEqual([]);
  });

  it("kod: kimligin on eki, harf duyarsiz, tire/EMN- toleransli", async () => {
    const code = ids.ayse.replace(/-/g, "").slice(0, 8);
    for (const q of [code.toUpperCase(), code.slice(0, 6), `${code.slice(0, 4)}-${code.slice(4, 8)}`, `EMN-${code.slice(0, 6).toUpperCase()}`]) {
      expect(await findPartnerBookingIds(own(), q), q).toContain(ids.ayse);
    }
    // On ek DEGIL, ortadan bir parca eslesmez.
    expect(await findPartnerBookingIds(own(), code.slice(2, 8))).not.toContain(ids.ayse);
  });

  it("telefon: >=4 rakam, rakamlarin SONU; misafir sutunu da taranir", async () => {
    expect(await findPartnerBookingIds(own(), "2233")).toEqual([ids.ilker]);
    expect(await findPartnerBookingIds(own(), "111 2233")).toEqual([ids.ilker]);
    expect(await findPartnerBookingIds(own(), "4321")).toEqual([ids.guestPhone]);
    // Sonu degil: eslesmez.
    expect(await findPartnerBookingIds(own(), "5551")).not.toContain(ids.ilker);
  });

  it("LIKE jokerleri duz karakterdir", async () => {
    expect(await findPartnerBookingIds(own(), "%%")).toEqual([]);
    expect(await findPartnerBookingIds(own(), "e_y")).toEqual([ids.ayse]);
    expect(await findPartnerBookingIds(own(), "a_")).toEqual([]);
  });
});
