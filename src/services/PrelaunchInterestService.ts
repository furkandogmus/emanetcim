import { APP_LOCALES, DEFAULT_APP_LOCALE } from "@/i18n/locales";
import prisma from "@/lib/db";
import logger from "@/lib/logger";
import { Prisma } from "@prisma/client";
import { notificationService } from "@/services/NotificationService";

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

/**
 * Kabaca RFC 5322: bosluksuz yerel kisim, `@`, en az bir noktali alan adi.
 * Amac tam dogrulama degil -- ADRESE BENZEMEYEN girdiyi gondermeden elemek.
 */
/**
 * Desteklenmeyen dil `null`a duser (= platform dili).
 *
 * Olculdu (2026-09-02): `locale: "klingon"` oldugu gibi kaydediliyordu. Bu
 * deger sonradan bildirim dilini secmek icin okunuyor; taninmayan bir kod
 * `pickLocale`da varsayilana duser, yani zarar sessiz -- ama kayit yine de
 * anlamsiz ve "hangi dilde haber verdik" sorusu cevapsiz kalir.
 */
function gecerliDil(l: string | null | undefined): string | null {
  if (!l) return null;
  return (APP_LOCALES as readonly string[]).includes(l) ? l : null;
}

const EPOSTA_BICIMI = /^[^\s@]+@[^\s@.]+\.[^\s@]+$/;

export type RecordInterestResult =
  | { ok: true; alreadyRegistered: boolean }
  /* `invalid_email`: gerekce `record` icinde. */
  | { ok: false; code: "shop_not_prelaunch" | "shop_not_found" | "invalid_email" };

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

    /*
      ADRES DOGRULANMADAN E-POSTA GONDERILMEZ (2026-09-02'de olculdu).

      Servis dogrudan cagrildiginda su kayitlar giriyordu VE her birine
      "acilinca haber verecegiz" e-postasi gonderilmeye calisiliyordu:

          "duz-metin"           -> kaydedildi, gonderim denendi
          ""      (bos)         -> kaydedildi, gonderim denendi
          490 karakterlik dize  -> kaydedildi, gonderim denendi

      Asil zarar kayit kirliligi degil GONDEREN ITIBARI: gecersiz adreslere
      yapilan her deneme bir bounce uretir, bounce orani yukseldiginde saglayici
      hesabi kisitlar ve o an TUM e-postalar durur -- rezervasyon onaylari,
      hatirlatmalar, parola sifirlama dahil. Yani bir talep-testi formundaki
      dogrulama eksigi, urunun butun bildirim yolunu riske atiyordu.

      Tasiyicilar zod ile doguruyor; bu, ayni oturumda besinci kez cikan sinif:
      kural tasiyicida var, serviste yok. CLAUDE.md "yazma islemleri yalnizca
      `src/services/` uzerinden" diyor, son savunma hatti orasi olmali.

      320 karakter RFC 5321'in adres siniri.
    */
    if (!EPOSTA_BICIMI.test(email) || email.length > 320) {
      return { ok: false, code: "invalid_email" };
    }

    const shop = await prisma.shop.findUnique({
      where: { id: input.shopId },
      select: { isPrelaunch: true, name: true },
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
          locale: gecerliDil(input.locale),
          source: input.source ?? "web",
        },
      });
      /*
        TEYIT ATESLE-UNUT: kullaniciyi bekletmez ve DUSURMEZ.

        Kayit zaten yazildi; e-posta gonderimi patlarsa kisiye "kaydolamadin"
        demek YANLIS olurdu -- kaydoldu. Bu yuzden hata yalnizca loglaniyor.
        `.catch` zorunlu: yakalanmamis bir red Node'da sureci indirir
        (mandal: unhandled-rejection, tavan 0).
      */
      void notificationService
        .notifyPrelaunchInterestReceived(
          email,
          input.shopId,
          shop.name,
          gecerliDil(input.locale) ?? DEFAULT_APP_LOCALE,
        )
        .catch((err) =>
          logger.warn({ err, shopId: input.shopId }, "prelaunch_interest_confirm_failed"),
        );

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
          locale: gecerliDil(input.locale),
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

  /**
   * EN COK ISTENEN noktalar — esnafa gosterilen talep haritasinin verisi.
   *
   * Yalnizca SINYAL ALMIS noktalar doner. Sifirlari da listelemek, "bu
   * sehirlerde talep var" diyen bir sayfayi 482 satirlik bir sifir listesine
   * cevirir ve iddiayi cururdu: bir esnafa gosterilen rakam, onun dukkan
   * acmasina gerekce olacak rakamdir.
   */
  async topDemand(limit = 30): Promise<
    {
      shopId: string;
      shopName: string;
      city: string | null;
      district: string | null;
      wantCount: number;
      interestCount: number;
    }[]
  > {
    const rows = await this.summary();
    return rows
      .filter((r) => r.wantCount > 0 || r.interestCount > 0)
      .slice(0, limit);
  }

  /**
   * Nokta HIZMETE ACILDIGINDA "haber ver" diyenlere e-posta gonderir.
   *
   * NEDEN VAR (2026-08-31'de olculdu): `PrelaunchInterest` kayitlari yalnizca
   * YAZILIYOR ve SAYILIYOR'du; onlardan bir sey gonderen tek satir kod yoktu.
   * Oysa kisi e-postasini tam olarak su soz karsiliginda birakiyor: "acildigi
   * gun ilk sen haberdar ol". Urunun en degerli sinyali, karsiligi olmayan bir
   * vaat uzerine toplaniyordu.
   *
   * IDEMPOTENT: yalnizca `notifiedAt` bos olanlara gonderir ve gonderdigini
   * damgalar. Ikinci kosu (elle tekrar, yeniden deneme, iki yonetici) kimseye
   * ikinci kez e-posta gondermez -- bir pazarlama e-postasini iki kez
   * gondermek, hic gondermemekten daha cok zarar verir.
   *
   * TEK TEK gonderilir ve HATA YUTULMAZ ama AKISI DURDURMAZ: bir adresin
   * basarisiz olmasi geri kalan yuzlerce kisinin haber almamasi anlamina
   * gelmemeli. Damga yalnizca gonderim basarili olduysa atilir, yani basarisiz
   * kalanlar bir sonraki kosuda tekrar denenir.
   */
  async notifyOpened(shopId: string): Promise<{
    sent: number;
    failed: number;
    alreadyNotified: number;
  }> {
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { name: true, isPrelaunch: true },
    });
    if (!shop) return { sent: 0, failed: 0, alreadyNotified: 0 };

    /*
      Nokta HALA prelaunch ise haber vermek YANLIS olurdu: kisi gelir ve
      rezervasyon alamaz. Bu kontrol, yanlis sirayla cagrilan bir betigin
      yuzlerce kisiye bos vaat gondermesini engelliyor.
    */
    if (shop.isPrelaunch) {
      logger.warn({ shopId }, "prelaunch_notify_skipped_still_prelaunch");
      return { sent: 0, failed: 0, alreadyNotified: 0 };
    }

    const [pending, alreadyNotified] = await Promise.all([
      prisma.prelaunchInterest.findMany({
        where: { shopId, notifiedAt: null },
        select: { id: true, email: true, locale: true },
      }),
      prisma.prelaunchInterest.count({
        where: { shopId, notifiedAt: { not: null } },
      }),
    ]);

    let sent = 0;
    let failed = 0;
    for (const row of pending) {
      try {
        await notificationService.notifyPrelaunchOpened(
          row.email,
          shopId,
          shop.name,
          row.locale ?? "tr",
        );
        await prisma.prelaunchInterest.update({
          where: { id: row.id },
          data: { notifiedAt: new Date() },
        });
        sent++;
      } catch (err) {
        failed++;
        logger.error({ err, shopId }, "prelaunch_notify_failed");
      }
    }

    return { sent, failed, alreadyNotified };
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
