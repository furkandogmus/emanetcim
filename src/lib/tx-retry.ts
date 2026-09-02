import { Prisma } from "@prisma/client";
import logger from "@/lib/logger";

/**
 * Prisma'nın yazma çakışması / kilitlenme kodu.
 *
 * Postgres tarafında `40001` (serialization_failure) ve `40P01`
 * (deadlock_detected) buraya düşer. Prisma'nın mesajı da aynı şeyi söylüyor:
 * *"Transaction failed due to a write conflict or a deadlock. Please retry
 * your transaction"*.
 */
const WRITE_CONFLICT = "P2034";

function isWriteConflict(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === WRITE_CONFLICT;
}

/**
 * `Serializable` bir işlemi çakışma halinde YENİDEN DENER.
 *
 * NEDEN VAR (2026-09-02'de gerçek veritabanında ölçüldü): rezervasyon
 * oluşturma `Serializable` izolasyon + `FOR UPDATE` ile korunuyor ve kapasiteyi
 * doğru koruyor. Ama çakışan işlemler yeniden DENENMİYORDU. Aynı slota altı
 * eşzamanlı istek gönderildiğinde:
 *
 *     kapasite 50, 6 istek x 10 valiz
 *     başarılı: 1, reddedilen: 5
 *     hepsi: "Transaction failed due to a write conflict or a deadlock"
 *     slot defterinde toplam: 10 / 50
 *
 * Yani kapasite aşılmıyordu -- korunan buydu ve doğru çalışıyordu -- ama YER
 * VARKEN beş misafir "beklenmeyen hata" alıyordu. Popüler bir dükkanda aynı
 * saate aynı anda birkaç kişi rezervasyon yaptığında görülecek şey tam olarak
 * bu: biri geçer, diğerleri hata görür ve büyük olasılıkla vazgeçer.
 *
 * `Serializable` bu hatayı ÜRETMEK üzere tasarlanmıştır; çağıranın onu yeniden
 * denemesi beklenir. Postgres'in kendi mesajı bile "please retry" diyor.
 *
 * YALNIZCA ÇAKIŞMA yeniden denenir. Kapasite aşımı, geçersiz tarih, prelaunch
 * dükkan gibi İŞ redleri deterministiktir: onları yeniden denemek aynı cevabı
 * daha yavaş almaktan başka bir şey yapmaz ve gerçek bir hatayı gizleyebilir.
 *
 * Bekleme JITTER'lı: sabit gecikme, çakışan işlemleri aynı anda yeniden
 * uyandırıp ikinci bir çakışma üretir.
 */
export async function retryOnWriteConflict<T>(
  fn: () => Promise<T>,
  opts: { attempts?: number; baseDelayMs?: number; label?: string } = {},
): Promise<T> {
  /*
    BES DENEME, UC DEGIL. Uc denemeyle olculdu: alti es zamanli istekten dordu
    geciyor, ikisi tukeniyordu. Cakisan islemler birbirini uyandirdikca sira
    uzuyor; toplam bekleme burada bile 25+50+100+200 ms mertebesinde, yani
    kullanicinin fark etmeyecegi bir gecikme karsiliginda basarisiz istek
    sayisi sifira iniyor.
  */
  const attempts = opts.attempts ?? 5;
  const base = opts.baseDelayMs ?? 25;

  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      if (!isWriteConflict(e)) throw e;
      last = e;
      if (i === attempts - 1) break;

      const bekle = base * 2 ** i + Math.floor(Math.random() * base);
      logger.warn(
        { attempt: i + 1, attempts, waitMs: bekle, label: opts.label },
        "tx_write_conflict_retry",
      );
      await new Promise((r) => setTimeout(r, bekle));
    }
  }

  logger.error(
    { attempts, label: opts.label },
    "tx_write_conflict_exhausted",
  );
  throw last;
}
