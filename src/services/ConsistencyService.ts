import prisma from "@/lib/db";
import { EARNING_BOOKING_STATUSES } from "@/lib/platform-split";

/**
 * İKİ KAYDIN SESSİZCE AYRIŞMASINI ARAR.
 *
 * NEDEN VAR (2026-09-02): bu kod tabanındaki hataların büyük bölümü tek bir
 * şekilde ortaya çıktı — aynı gerçeği iki yerde tutan kayıtlardan biri
 * güncellenip diğeri geride kaldı. Bir oturumda dört ayrı örneği bulundu:
 *
 *   - Valiz düzeltmesi `Booking.bagCount*`ı yazıyor, `ReservationSlot.bagCount`a
 *     dokunmuyordu -> dükkan aynı kapasiteyi ikinci kez satabiliyordu.
 *   - Rezervasyon tarihi değişince slot satırları ESKİ saatte kalıyordu ->
 *     eski saatte hayalet, yeni saatte görünmez rezervasyon.
 *   - Teslim alınmış valizin sayısı artırılabiliyordu -> mühürsüz valiz.
 *   - Koordinatsız dükkan onaylanabiliyordu -> hiçbir aramada çıkmıyor.
 *
 * Hepsi kodda düzeltildi. Ama düzeltmeler yalnızca BUNDAN SONRASINI korur:
 * hata sürerken üretilmiş kayıtlar veritabanında öylece durur ve hiçbir ekran
 * onları göstermez. Bu servis o kayıtları SAYAR.
 *
 * OKUMA YAPAR, HİÇBİR ŞEY DÜZELTMEZ. Otomatik onarım bilerek yok: her
 * tutarsızlığın doğru cevabı farklı ve bazıları fiziksel gerçeğe bağlı ("rafta
 * kaç valiz var?"). Sayı görünür olduğunda karar insanındır.
 */

export type ConsistencyFinding = {
  /** Kısa, aranabilir kod. */
  kind:
    | "slot_bag_mismatch"
    | "unsealed_checked_in_bags"
    | "active_shop_without_coordinates"
    | "captured_amount_mismatch";
  count: number;
  /** En fazla 10 örnek kimlik — tamamı değil, araştırmaya başlamak için. */
  samples: string[];
};

export type ConsistencyReport = {
  findings: ConsistencyFinding[];
  /** Hiçbir tutarsızlık yoksa `true`. */
  clean: boolean;
};

const SAMPLE_LIMIT = 10;

export class ConsistencyService {
  async scan(): Promise<ConsistencyReport> {
    const findings: ConsistencyFinding[] = [];

    /*
      1. SLOT DEFTERİ ile rezervasyonun valiz sayısı ayrışmış.

      Müsaitlik hesabı slot defterini okuyor; `Booking.bagCount*` yalnızca
      slotu olmayan eski kayıtlar için. İkisi ayrıştığında dükkan ya fazla
      satar ya da boş yer boşa yanar. Yalnızca AÇIK rezervasyonlara bakılıyor:
      tamamlanmış bir kaydın defteri artık kimseyi etkilemiyor.
    */
    const slotMismatch = await prisma.$queryRaw<{ id: string }[]>`
      SELECT b.id
      FROM "Booking" b
      JOIN (
        SELECT "bookingId", MAX("bagCount") AS bag_count
        FROM "ReservationSlot"
        GROUP BY "bookingId"
      ) rs ON rs."bookingId" = b.id
      WHERE b.status::text IN ('PAID', 'CHECKED_IN', 'APPROVED')
        AND rs.bag_count <> (b."bagCountS" + b."bagCountM" + b."bagCountXl")
      LIMIT 100
    `;
    if (slotMismatch.length > 0) {
      findings.push({
        kind: "slot_bag_mismatch",
        count: slotMismatch.length,
        samples: slotMismatch.slice(0, SAMPLE_LIMIT).map((r) => r.id),
      });
    }

    /*
      2. TESLİM ALINMIŞ ama valizinden AZ mühür bağlı rezervasyon.

      Mühür bu ürünün güven mekanizması: teslimde esnaf onu kontrol ediyor.
      Eksik mühür, o kontrolden geçemeyecek bir valiz demek.
    */
    const unsealed = await prisma.$queryRaw<{ id: string }[]>`
      SELECT b.id
      FROM "Booking" b
      LEFT JOIN (
        SELECT "bookingId", COUNT(*) AS seal_count
        FROM "BookingSeal"
        GROUP BY "bookingId"
      ) s ON s."bookingId" = b.id
      WHERE b.status::text = 'CHECKED_IN'
        AND COALESCE(s.seal_count, 0) > 0
        AND COALESCE(s.seal_count, 0) < (b."bagCountS" + b."bagCountM" + b."bagCountXl")
      LIMIT 100
    `;
    if (unsealed.length > 0) {
      findings.push({
        kind: "unsealed_checked_in_bags",
        count: unsealed.length,
        samples: unsealed.slice(0, SAMPLE_LIMIT).map((r) => r.id),
      });
    }

    /*
      3. AKTİF ama koordinatsız dükkan.

      Arama tamamen mesafe üzerinden çalışıyor; koordinatsız dükkan hiçbir
      aramada çıkmaz. Esnaf onaylandığını bilir ve neden rezervasyon
      gelmediğini bilmez.
    */
    const noCoords = await prisma.shop.findMany({
      where: {
        isActive: true,
        isTest: false,
        OR: [{ latitude: null }, { longitude: null }],
      },
      select: { id: true },
      take: 100,
    });
    if (noCoords.length > 0) {
      findings.push({
        kind: "active_shop_without_coordinates",
        count: noCoords.length,
        samples: noCoords.slice(0, SAMPLE_LIMIT).map((s) => s.id),
      });
    }

    /*
      4. TAHSİL EDİLMİŞ tutar ile rezervasyon tutarı ayrışmış.

      `PaymentLog.amount` gerçekten alınan paradır ve iade onun üzerinden
      hesaplanır. `Booking.totalPrice` sonradan değiştiyse (valiz düzeltmesi)
      ikisi ayrışır: hakediş ve iade yanlış tabana oturur.
    */
    const amountMismatch = await prisma.$queryRaw<{ id: string }[]>`
      SELECT b.id
      FROM "Booking" b
      JOIN "PaymentLog" p ON p."bookingId" = b.id
      WHERE p.status = 'SUCCESS'
        AND b.status::text = ANY(${[...EARNING_BOOKING_STATUSES]}::text[])
        AND p.amount <> b."totalPrice"
      LIMIT 100
    `;
    if (amountMismatch.length > 0) {
      findings.push({
        kind: "captured_amount_mismatch",
        count: amountMismatch.length,
        samples: amountMismatch.slice(0, SAMPLE_LIMIT).map((r) => r.id),
      });
    }

    return { findings, clean: findings.length === 0 };
  }
}

export const consistencyService = new ConsistencyService();
