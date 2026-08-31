import prisma from "@/lib/db";
import { computeSplit, EARNING_BOOKING_STATUSES } from "@/lib/platform-split";
import { Prisma } from "@prisma/client";

/**
 * Esnaf kazanç özeti — TOPLAMA VERİTABANINDA YAPILIR.
 *
 * NEDEN VAR (2026-08-31'de ölçüldü), üç ayrı kusur:
 *
 * 1. SINIRSIZ SORGU. `partner/earnings/page.tsx` `prisma.booking.findMany` ile
 *    dükkanın TÜM rezervasyonlarını (sayfalama yok, tarih sınırı yok) belleğe
 *    çekip JS'te topluyordu. Sonra hepsi `PartnerEarningsClient`'a geçiriliyor
 *    ve tek tek DOM'a basılıyordu. Günde 20 rezervasyonluk bir dükkan bir yılda
 *    7.300 satır demektir: sunucuda 7.300 nesne, RSC yükünde 7.300 kayıt,
 *    tarayıcıda 7.300 DOM düğümü — tek bir ekran için.
 *
 * 2. TOPLAM KAZANÇ 100'DE KESİLİYORDU. Ana panel (`partner/page.tsx`) toplamı
 *    `getPartnerBookings()`in döndürdüğü sayfadan hesaplıyordu; o fonksiyonun
 *    varsayılan `limit`i **100**. Yani 100'den fazla rezervasyonu olan esnafın
 *    ana paneldeki "toplam kazanç"ı sessizce eksikti ve kazanç sayfasındaki
 *    (sınırsız okuyan) rakamla TUTMUYORDU. Bu, `EARNING_BOOKING_STATUSES`
 *    yorumunda anlatılan "iki ekranda iki farklı hakediş" hatasının aynısıdır —
 *    o sefer durum tanımından, bu sefer sayfalamadan.
 *

 * ÇİFT `AT TIME ZONE` BİLEREK. Prisma'nın `DateTime` alanları Postgres'te
 * `timestamp without time zone` olarak duruyor (doğrulandı: `information_schema`)
 * ve içlerine UTC yazılıyor. Böyle bir sütunda TEK `AT TIME ZONE 'Europe/Istanbul'`
 * değeri İstanbul'da yazılmış SAYAR ve ters yöne çevirir. Ölçüldü: kaydedilen
 * `2026-08-24 07:00` UTC için tek dönüşüm `04:00`, doğrusu `10:00` — yani tek
 * dönüşüm hatayı düzeltmek yerine 3 saatten 6 saate çıkarıyordu. Önce
 * `AT TIME ZONE 'UTC'` naif değeri `timestamptz`e yükseltir, sonraki dönüşüm
 * dükkanın yerel saatine indirir.
 *
 * 3. SAAT DİLİMİ SUNUCUNUNKİYDİ. Aylık gruplama ve "yoğun saatler" grafiği
 *    `new Date(...).getHours()` / `getMonth()` kullanıyordu; bunlar SUNUCUNUN
 *    yerel saat dilimini okur. Üretim konteyneri UTC çalışıyor, yani İstanbul'daki
 *    bir dükkan için grafik **3 saat kaymış** gösteriliyordu: esnaf 09:00'da
 *    aldığı valizi 06:00 sütununda görüyordu. `Shop.timezone` alanı zaten var ve
 *    hiç kullanılmıyordu. Ayrıca ayın ilk/son günündeki rezervasyonlar yanlış aya
 *    yazılıyordu.
 */

/** Postgres'e giden saat dilimi adı. Geçersizse sorgu HATA VERİR, o yüzden süzülür. */
const TZ_RE = /^[A-Za-z]+(?:\/[A-Za-z0-9_+-]+){1,2}$/;
const FALLBACK_TZ = "Europe/Istanbul";

/**
 * `AT TIME ZONE`'a giden değeri güvenli hâle getirir.
 *
 * Parametre olarak bağlanıyor (enjeksiyon yolu yok) ama Postgres tanımadığı bir
 * ad görürse `invalid value for parameter TimeZone` ile PATLAR ve esnafın kazanç
 * sayfası tamamen açılmaz. Bozuk bir `Shop.timezone` yüzünden sayfayı kaybetmek
 * yerine varsayılana düşmek doğru: gösterilen rakam yine doğru, yalnız gruplama
 * platformun ana saat dilimine göre yapılır.
 */
export function safeTimezone(tz: string | null | undefined): string {
  const value = tz?.trim();
  return value && TZ_RE.test(value) ? value : FALLBACK_TZ;
}

export type MonthlyEarning = {
  /** `YYYY-MM`, dükkanın saat dilimine göre. */
  month: string;
  grossTotal: number;
  /** Esnaf payı. */
  netTotal: number;
  /** Platform komisyonu — nakit tahsilatta esnafın platforma BORCU. */
  commissionTotal: number;
  count: number;
};

export type PartnerEarningsSummary = {
  totalGross: number;
  totalNet: number;
  totalCommission: number;
  /** Hakedişe sayılan rezervasyon adedi. */
  earningBookingCount: number;
  /** Dükkana düşen TÜM rezervasyonlar (dönüşüm oranının paydası). */
  allBookingCount: number;
  monthly: MonthlyEarning[];
  peakHours: { hour: string; count: number }[];
  avgStayHours: number;
};

type MonthRow = { month: string; gross: Prisma.Decimal | null; count: bigint };
type HourRow = { hour: number; count: bigint };
type StayRow = { avg_hours: number | null };

/**
 * Hakedişe sayılan durumlar — SQL tarafına aynı listeden geçer.
 * `platform-split.ts` tek doğru kaynak olmaya devam eder.
 */
const EARNING_STATUS_SQL = Prisma.join(
  EARNING_BOOKING_STATUSES.map((s) => Prisma.sql`${s}`),
);

class PartnerEarningsService {
  /**
   * Dükkanın kazanç özeti. Tek gidiş-dönüşte dört toplama.
   *
   * TOPLAMLAR AYLARDAN TÜRETİLİR, ayrı hesaplanmaz. Brüt toplamı bir kez, her ayı
   * bir kez bölmek iki farklı sonuç verebilir (yuvarlama). Esnafın ekranında aylık
   * satırların toplamı üstteki toplama TUTMAK ZORUNDA — aksi hâlde hangisinin
   * doğru olduğunu soracak kimse yok. Bkz. `platform-split.ts`: "mutabakatta bir
   * kuruşluk açık aramak zorunda kalmayın".
   */
  async getSummary(
    shopId: string,
    timezone: string | null | undefined,
    commissionRate: number,
  ): Promise<PartnerEarningsSummary> {
    const tz = safeTimezone(timezone);

    const [monthRows, hourRows, stayRows, allBookingCount] = await Promise.all([
      prisma.$queryRaw<MonthRow[]>`
        SELECT to_char(date_trunc('month', "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${tz}), 'YYYY-MM') AS month,
               SUM("totalPrice") AS gross,
               COUNT(*) AS count
        FROM "Booking"
        WHERE "shopId" = ${shopId}
          AND "status"::text IN (${EARNING_STATUS_SQL})
        GROUP BY 1
        ORDER BY 1 DESC
      `,
      prisma.$queryRaw<HourRow[]>`
        SELECT EXTRACT(HOUR FROM "checkInTime" AT TIME ZONE 'UTC' AT TIME ZONE ${tz})::int AS hour,
               COUNT(*) AS count
        FROM "Booking"
        WHERE "shopId" = ${shopId}
          AND "status"::text IN (${EARNING_STATUS_SQL})
        GROUP BY 1
      `,
      prisma.$queryRaw<StayRow[]>`
        SELECT AVG(EXTRACT(EPOCH FROM ("checkOutTime" - "checkInTime")) / 3600.0)::float8 AS avg_hours
        FROM "Booking"
        WHERE "shopId" = ${shopId}
          AND "status"::text IN (${EARNING_STATUS_SQL})
      `,
      prisma.booking.count({ where: { shopId } }),
    ]);

    const monthly: MonthlyEarning[] = monthRows.map((r) => {
      const split = computeSplit(Number(r.gross ?? 0), commissionRate);
      return {
        month: r.month,
        grossTotal: split.grossAmount,
        netTotal: split.merchantAmount,
        commissionTotal: split.platformCommission,
        count: Number(r.count),
      };
    });

    const round2 = (n: number) => Math.round(n * 100) / 100;
    const totalGross = round2(monthly.reduce((s, m) => s + m.grossTotal, 0));
    const totalNet = round2(monthly.reduce((s, m) => s + m.netTotal, 0));
    // Fark olarak: iki tarafı ayrı yuvarlamak toplamı brütten kaydırır.
    const totalCommission = round2(totalGross - totalNet);

    const countByHour = new Map(hourRows.map((r) => [Number(r.hour), Number(r.count)]));
    const peakHours = Array.from({ length: 24 }, (_, h) => ({
      hour: `${String(h).padStart(2, "0")}:00`,
      count: countByHour.get(h) ?? 0,
    }));

    return {
      totalGross,
      totalNet,
      totalCommission,
      earningBookingCount: monthly.reduce((s, m) => s + m.count, 0),
      allBookingCount,
      monthly,
      peakHours,
      avgStayHours: Math.round(stayRows[0]?.avg_hours ?? 0),
    };
  }

  /**
   * Ana panelin "toplam kazanç" kartı için TEK sayı.
   *
   * Ayrı bir yol değil: aynı `EARNING_BOOKING_STATUSES` kümesi, aynı `computeSplit`.
   * Ana panel bunu rezervasyon LİSTESİNDEN hesapladığı için 100'de kesiliyordu.
   */
  async getTotals(
    shopId: string,
    commissionRate: number,
  ): Promise<{ gross: number; net: number; commission: number }> {
    const agg = await prisma.booking.aggregate({
      where: { shopId, status: { in: [...EARNING_BOOKING_STATUSES] } },
      _sum: { totalPrice: true },
    });
    const split = computeSplit(Number(agg._sum.totalPrice ?? 0), commissionRate);
    return {
      gross: split.grossAmount,
      net: split.merchantAmount,
      commission: split.platformCommission,
    };
  }
}

export const partnerEarningsService = new PartnerEarningsService();
