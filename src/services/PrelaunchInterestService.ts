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

export type RecordWantInput = {
  shopId: string;
  /** Cerezdeki anonim tarayici kimligi. */
  anonId: string;
  locale?: string | null;
  source?: "web" | "mobile";
};

export type RecordWantResult =
  | { ok: true; alreadyCounted: boolean; count: number }
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
   * TEK TIKLIK istek. E-posta istemez.
   *
   * NEDEN AYRI BIR SINYAL: e-posta birakmak yuksek surtunmeli bir adim ve
   * "burada bir nokta olsun mu?" sorusunun cevabini bekletiyordu. Tek tik o
   * soruyu ucuza sorar; e-posta bir adim otesidir. Ikisi ayni sayiya
   * karistirilmaz -- biri ilginin GENISLIGINI, digeri niyetin DERINLIGINI
   * olcer ve sehir acma karari ikisine birden bakar.
   *
   * `alreadyCounted` hata degil: ayni tarayici ikinci kez tikladiginda istedigi
   * sey zaten olmustur, ona hata gostermek anlamsiz. Ama SAYI sismemeli;
   * `@@unique([shopId, anonId])` bunu veritabaninda garantiler.
   *
   * Sayi HER DURUMDA taze okunur (ilk tik da, tekrar tik da): istemciye
   * gosterilen rakam bu noktanin gercek toplamidir, o an artan bir yerel
   * sayac degil.
   */
  async recordWant(input: RecordWantInput): Promise<RecordWantResult> {
    const shop = await prisma.shop.findUnique({
      where: { id: input.shopId },
      select: { isPrelaunch: true },
    });
    if (!shop) return { ok: false, code: "shop_not_found" };
    if (!shop.isPrelaunch) return { ok: false, code: "shop_not_prelaunch" };

    let alreadyCounted = false;
    try {
      await prisma.prelaunchWant.create({
        data: {
          shopId: input.shopId,
          anonId: input.anonId,
          locale: input.locale ?? null,
          source: input.source ?? "web",
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        alreadyCounted = true;
      } else {
        logger.error({ err, shopId: input.shopId }, "prelaunch_want_failed");
        throw err;
      }
    }

    const count = await prisma.prelaunchWant.count({
      where: { shopId: input.shopId },
    });
    return { ok: true, alreadyCounted, count };
  }

  /** Bir noktayi kac kisi istedi. Detay sayfasi sunucuda bunu okur. */
  async wantCount(shopId: string): Promise<number> {
    return prisma.prelaunchWant.count({ where: { shopId } });
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
      wantCount: number;
    }[]
  > {
    const shops = await prisma.shop.findMany({
      where: { isPrelaunch: true },
      select: {
        id: true,
        name: true,
        city: true,
        district: true,
        _count: { select: { prelaunchInterests: true, prelaunchWants: true } },
      },
    });

    return shops
      .map((s) => ({
        shopId: s.id,
        shopName: s.name,
        city: s.city,
        district: s.district,
        interestCount: s._count.prelaunchInterests,
        wantCount: s._count.prelaunchWants,
      }))
      /*
        Once TEK TIK sayisi: en genis sinyal o. E-posta esitligi bozar --
        ayni sayida tiklama alan iki noktadan niyeti derin olan one gecer.
      */
      .sort(
        (a, b) =>
          b.wantCount - a.wantCount || b.interestCount - a.interestCount,
      );
  }
}

export const prelaunchInterestService = new PrelaunchInterestService();
