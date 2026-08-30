import prisma from "@/lib/db";
import logger from "@/lib/logger";
import { Prisma } from "@prisma/client";

/**
 * Talep testi noktalarina birakilan "acilinca haber ver" kayitlari.
 *
 * NEDEN VAR: bir sehirde esnafla anlasmadan once orada musteri olup olmadigini
 * olcmek gerekiyor. `Shop.isPrelaunch` noktasi aramada normal gorunur; misafir
 * rezervasyona kalkistigi AN "burasi yakinda aciliyor" gorur ve isterse
 * e-postasini birakir. Bu tablo o testin TEK ciktisidir.
 *
 * Neden e-posta, sadece tiklama degil: tiklama merakla da olur, e-posta birakmak
 * niyet BEYANIDIR. Ayrica sehir acildiginda elde hazir bir talep listesi kalir.
 */

export type RecordInterestInput = {
  shopId: string;
  email: string;
  locale?: string | null;
  source?: "web" | "mobile";
};

export type RecordInterestResult =
  | { ok: true; alreadyRegistered: boolean }
  | { ok: false; code: "shop_not_prelaunch" | "shop_not_found" };

class PrelaunchInterestService {
  /**
   * Ilgi kaydini yazar.
   *
   * `alreadyRegistered` BILEREK hata degil: ayni kisi ikinci kez kaydolmaya
   * calistiginda ona hata gostermek anlamsizdir -- istedigi sey zaten olmustur.
   * Ama SAYI sismemeli, yoksa talep haritasi oldugundan buyuk gorunur ve karar
   * tam da o sayiya bakilarak veriliyor. `@@unique([shopId, email])` bunu
   * veritabaninda garantiler; burasi ihlali sessizce basariya cevirir.
   */
  async record(input: RecordInterestInput): Promise<RecordInterestResult> {
    const email = input.email.trim().toLowerCase();

    const shop = await prisma.shop.findUnique({
      where: { id: input.shopId },
      select: { isPrelaunch: true },
    });
    if (!shop) return { ok: false, code: "shop_not_found" };

    /*
      Yalnizca prelaunch noktasi icin kayit alinir.

      NEDEN KONTROL EDILIYOR: nokta hizmete acildiginda `isPrelaunch` false olur
      ve o andan sonra dogru eylem rezervasyon yapmaktir. Kontrol olmasaydi eski
      bir istemci ya da onbellege alinmis bir sayfa, acilmis bir dukkan icin
      "haber ver" yazmaya devam eder ve kisi rezervasyon yapabilecegini hic
      ogrenmezdi.
    */
    if (!shop.isPrelaunch) return { ok: false, code: "shop_not_prelaunch" };

    try {
      await prisma.prelaunchInterest.create({
        data: {
          shopId: input.shopId,
          email,
          locale: input.locale ?? null,
          source: input.source ?? "web",
        },
      });
      return { ok: true, alreadyRegistered: false };
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return { ok: true, alreadyRegistered: true };
      }
      logger.error({ err, shopId: input.shopId }, "prelaunch_interest_failed");
      throw err;
    }
  }

  /**
   * Nokta basina ilgi sayilari — talep haritasinin kendisi.
   *
   * Sehir/ilce ile birlikte doner ki karar "hangi sehirde esnaf ariyoruz"
   * seviyesinde verilebilsin; nokta bazinda kirilim da elde kalir.
   */
  async summary(): Promise<
    {
      shopId: string;
      shopName: string;
      city: string | null;
      district: string | null;
      interestCount: number;
    }[]
  > {
    const shops = await prisma.shop.findMany({
      where: { isPrelaunch: true },
      select: {
        id: true,
        name: true,
        city: true,
        district: true,
        _count: { select: { prelaunchInterests: true } },
      },
    });

    return shops
      .map((s) => ({
        shopId: s.id,
        shopName: s.name,
        city: s.city,
        district: s.district,
        interestCount: s._count.prelaunchInterests,
      }))
      .sort((a, b) => b.interestCount - a.interestCount);
  }
}

export const prelaunchInterestService = new PrelaunchInterestService();
