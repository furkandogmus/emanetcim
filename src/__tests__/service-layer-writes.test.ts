import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * SERVİS KATMANI MANDALI — "yazma işlemleri yalnızca `src/services/`".
 *
 * NEDEN VAR (2026-08-25'te ölçüldü): bu kural `CLAUDE.md`'de yazılıydı ama HİÇBİR
 * ŞEY onu tutmuyordu ve sessizce aşınmıştı: `src/actions` + `src/app` içinde 118
 * doğrudan Prisma yazma çağrısı vardı. Aşınmanın bedeli teorik değildi — aynı iş
 * kuralı web action'ında ve mobil API ucunda İKİ KEZ yazılmıştı ve kopyalar
 * ayrışmıştı:
 *
 *   - **Mobil "reddet"** ham `booking.update({ status: CANCELLED })` yazıyordu:
 *     iade yapılmıyor, `ReservationSlot` satırları silinmiyordu. Reddedilen
 *     rezervasyon dükkanın kapasitesini KALICI olarak tutuyordu.
 *   - **Mobil "teslim aldım"** mühürleri dükkana hiç atamıyordu; esnaf teslim
 *     aldığını bildirdikten sonra check-in "mühür bu dükkana atanmamış" diyordu.
 *   - **Yasaklı kullanıcı silme** aynı ham iptali yapıyordu (aynı sızıntı).
 *   - **Mobil onay** bildirimi `"en"` sabitiyle gönderiyordu.
 *
 * Hiçbiri "unutulmuş bir satır" değil: aynı kuralı iki yere yazmanın kaçınılmaz
 * sonucu. Bu mandal sınırı ölçülebilir kılar.
 *
 * İKİ SEVİYE:
 *   1. **Alan-kritik modeller: KESİN 0.** Para, rezervasyon yaşam döngüsü ve
 *      mühür envanteri. Bunlara servis dışından yazılamaz — nokta.
 *   2. **Geri kalan modeller: TAVAN.** Sayı düşebilir, yükselemez. Tavanı
 *      yükselten bir PR sorunu çözmüyor, saklıyor.
 */

const WRITE_OPS = [
  "create",
  "createMany",
  "update",
  "updateMany",
  "upsert",
  "delete",
  "deleteMany",
] as const;

const WRITE_RE = new RegExp(
  String.raw`\b(?:prisma|tx)\.([a-zA-Z][a-zA-Z0-9]*)\.(?:${WRITE_OPS.join("|")})\(`,
  "g",
);

/**
 * Servis DIŞINDAN yazılması YASAK modeller.
 *
 * Ortak yanları: bir yazma işlemi tek başına anlamlı değil, yanında başka bir
 * defter hareketi gerektiriyor. `Booking.status = CANCELLED` yazmak iade ve slot
 * temizliği olmadan YANLIŞTIR; `Seal.status = ASSIGNED` yazmak talep durumu
 * olmadan yanlıştır; `Coupon.usedCount` para demektir.
 */
const SERVICE_ONLY_MODELS = [
  "booking",
  "reservationSlot",
  "bookingSeal",
  "seal",
  "sealRequest",
  "paymentLog",
  "coupon",
  // Paylasim kaydi para demektir ve tek basina anlamli degildir: bir
  // PaymentSplit satiri ancak karsiliginda tahsil edilmis bir PaymentLog
  // varsa dogrudur. Liste modeli DAHA ILK GUNDEN koruyor -- paymentLog'un
  // basina gelen (servis disindan yazilip karsiliksiz "SUCCESS" uretilmesi)
  // burada hic yasanmasin diye.
  "paymentSplit",
] as const;

/**
 * Kalan modellerin ÖLÇÜLEN tavanları (2026-08-25, **2026-08-31'de düşürüldü**).
 *
 * Bunlar henüz servise taşınmadı ve hepsi aynı aciliyette değil: `user` /
 * `session` / `verificationToken` çoğunlukla kimlik doğrulama akışlarının kendi
 * kayıtları, `contactMessage` / `blogPost` / `campaign` ise içerik CRUD'u.
 * Tavanlar borç kapandıkça DÜŞÜRÜLÜR.
 *
 * 2026-08-31: şifre sıfırlamanın gövdesi `src/services/auth/password-reset.ts`e,
 * oturum iptali `src/services/auth/mobile-session.ts`e taşındı — ikisi de web ve
 * mobil tarafından AYRI AYRI yazılmıştı ve kopyalar ayrışmıştı (web
 * `tokenVersion`'ı artırmıyordu, yani şifre değişse bile çalınmış mobil oturum
 * 30 gün daha yaşıyordu). Borç kapandı, tavanlar ölçülen değere indi:
 * `user` 24→22, `verificationToken` 9→7, `session` 4→3, toplam 91→86.
 */
const CEILINGS: Record<string, number> = {
  account: 1,
  adminRoleChangeRequest: 5,
  analyticsEvent: 1,
  blockedIp: 1,
  blogPost: 4,
  campaign: 4,
  contactMessage: 9,
  contactReply: 1,
  dispute: 3,
  featureFlag: 1,
  jobRun: 2,
  mobilePushToken: 2,
  notificationLog: 1,
  platformSettings: 1,
  pushSubscription: 2,
  review: 1,
  session: 1,
  /*
    7 -> 4 -> 3 (2026-09-01): once onay/red govdeleri `ShopService`e, sonra
    ortalama puan hesabi `ReviewService`e tasindi. Ucu de web action'inda ve
    mobil ucta AYRI AYRI yaziliydi.
  */
  shop: 3,
  /*
    22 -> 20 -> 18 (2026-09-01): telefon guncelleme `PartnerProfileService`e,
    hesap anonimlestirme `AccountPrivacyService`e tasindi.
  */
  user: 18,
  verificationToken: 7,
};

/*
  KALDIRILAN GIRDILER (2026-09-01) -- hepsi `AccountPrivacyService`e tasindi ve
  artik servis disindan HIC yazilmiyor: `legalAcceptance`. `account`, `review` ve
  `session` de yalnizca birer yerde kaldi.
*/

/** Toplam tavan — yeni bir MODELİN sessizce eklenmesini de yakalar. */
const TOTAL_CEILING = 68;

/**
 * Yorumlar ayıklanır: bu dosyaların çoğunda "eskiden burada ham
 * `prisma.booking.update` vardı" gibi AÇIKLAMALAR var ve onlar kod değil.
 * (Bu tuzağa bir kez düşüldü: yorumdaki metin taramayı kirletiyordu.)
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      // `src/services` ve testler kapsam dışı: kural onlar İÇİN değil, onlara doğru.
      if (e.name === "services" || e.name === "__tests__") continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

type Hit = { model: string; file: string };

function collectWrites(): Hit[] {
  const hits: Hit[] = [];
  for (const file of walk(path.join(process.cwd(), "src"))) {
    const src = stripComments(fs.readFileSync(file, "utf8"));
    for (const m of src.matchAll(WRITE_RE)) {
      hits.push({ model: m[1], file: path.relative(process.cwd(), file) });
    }
  }
  return hits;
}

function countBy(hits: Hit[]): Map<string, Hit[]> {
  const map = new Map<string, Hit[]>();
  for (const h of hits) {
    const list = map.get(h.model) ?? [];
    list.push(h);
    map.set(h.model, list);
  }
  return map;
}

describe("yazma işlemleri servis katmanından geçiyor", () => {
  const byModel = countBy(collectWrites());

  it.each(SERVICE_ONLY_MODELS)(
    "`%s` modeline servis DIŞINDAN yazılmıyor",
    (model) => {
      const hits = byModel.get(model) ?? [];
      const files = [...new Set(hits.map((h) => h.file))];
      expect(
        files,
        `\`${model}\` alan-kritik bir model: bir yazma işlemi tek başına anlamlı ` +
          `değil, yanında iade / slot temizliği / envanter hareketi gerekiyor. ` +
          `Bu dosyalardan \`src/services/\` içindeki bir fonksiyonu çağırın:\n` +
          files.join("\n"),
      ).toEqual([]);
    },
  );

  it("kalan modellerin doğrudan yazma sayısı tavanı aşmıyor", () => {
    const over: string[] = [];
    for (const [model, hits] of byModel) {
      if ((SERVICE_ONLY_MODELS as readonly string[]).includes(model)) continue;
      const ceiling = CEILINGS[model];
      if (ceiling === undefined) {
        over.push(
          `${model}: ${hits.length} kullanım, TAVANI YOK — yeni model. ` +
            `Servise taşıyın ya da ölçülen sayıyı CEILINGS'e ekleyin.`,
        );
      } else if (hits.length > ceiling) {
        over.push(
          `${model}: ${hits.length} > ${ceiling}\n  ` +
            [...new Set(hits.map((h) => h.file))].join("\n  "),
        );
      }
    }
    expect(
      over,
      "Doğrudan Prisma yazma borcu ARTMIŞ. Tavanı yükseltmek sorunu çözmez, saklar:\n" +
        over.join("\n"),
    ).toEqual([]);
  });

  it("toplam doğrudan yazma sayısı tavanı aşmıyor", () => {
    const total = [...byModel.values()].reduce((n, h) => n + h.length, 0);
    expect(
      total,
      `Servis dışı doğrudan yazma: ${total} (tavan ${TOTAL_CEILING}). ` +
        `Bu sayı yalnızca DÜŞER.`,
    ).toBeLessThanOrEqual(TOTAL_CEILING);
  });

  it("tavan tablosu ölü girdi taşımıyor", () => {
    // Bir model servise tasindiginda tavani da DUSMELI; yoksa tablo, kapanmis
    // bir borcu acikmis gibi gosterir ve bir sonraki okuyucuyu yaniltir.
    const stale = Object.keys(CEILINGS).filter((m) => !byModel.has(m));
    expect(
      stale,
      `Bu modellere artık servis dışından yazılmıyor; CEILINGS'ten silin:\n${stale.join("\n")}`,
    ).toEqual([]);
  });
});
