import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { signGuestLookupToken } from "@/lib/guest-lookup-token";
import logger from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/internal-api-guard";
import {
  normalizeBookingCode,
  MIN_BOOKING_CODE_LENGTH,
} from "@/lib/booking-code";

export async function POST(req: NextRequest) {
  try {
    /*
      HIZ SINIRI (2026-08-31'de eklendi). Bu uc, kimlik dogrulamasi OLMAYAN ve
      basarisinda `guest-cancel`in kabul ettigi bir tasiyici token ureten tek
      yer. Sinir yoktu; yani e-postasini bildigimiz bir misafirin rezervasyon
      kodunu KABA KUVVETLE bulmak bedavaydi.

      Buyukluk: alt sinir alti hane (`MIN_BOOKING_CODE_LENGTH`), onaltilik
      tabanda ~16,7 milyon olasilik. Sinirsiz bir uc, sabit hizli bir istemciyle
      bunu saatler mertebesine indirir; kod bulununca saldirgan misafirin QR
      token'ini okuyabilir ve rezervasyonu iptal ettirebilir. Depo acik kaynak
      oldugu icin kodun `booking.id`'nin ilk sekiz hanesi oldugu da,
      normalizasyonun ne yaptigi da zaten herkese acik -- sinirlamayi kodun
      gizliligi tasiyamaz.

      Iki kova: IP basina (kaba kuvvet) ve e-posta basina (tek kurbani
      hedefleyip IP degistirme). E-posta kovasi govde okunduktan sonra, cunku
      anahtari govdeden geliyor.
    */
    const ip = clientIp(req);
    if (!(await rateLimit(`booking_lookup:ip:${ip}`, 20, 10 * 60_000))) {
      return NextResponse.json({ ok: false, error: "too_many_requests" }, { status: 429 });
    }

    const { email, bookingId } = await req.json();
    if (!email || !bookingId) {
      return NextResponse.json({ ok: false, error: "Missing email or booking ID" }, { status: 400 });
    }

    /**
     * Misafirin ekranındaki kod BÜYÜK HARF yazılı
     * (`bookings/[id]/page.tsx` → `booking.id.slice(0, 8).toUpperCase()`),
     * kimlik ise küçük harf saklanıyor. Postgres'te `startsWith` harf
     * duyarlıdır: misafir KENDİ ekranındaki kodu yazdığında "Rezervasyon
     * bulunamadı" alıyordu ve hatayı kendi yazımından ayırt edemiyordu.
     *
     * Boşluk ve tire de temizleniyor: kod okunarak aktarılıyor, "d8a7 ff57"
     * ya da "D8A7-FF57" yazılması olağan.
     */
    const code = normalizeBookingCode(bookingId);
    const normalizedEmail = String(email).toLowerCase().trim();

    /*
      6 hane alt sınır: daha kısası aynı e-postanın rezervasyonları içinde bile
      çakışabilir. ÖNCEKİ HÂLİ DAHA KÖTÜYDÜ -- `id: bookingId.length > 8 ?
      bookingId : undefined` yazıyordu ve 8 haneli kodda `id` filtresi TAMAMEN
      düşüyordu: sorgu yalnızca e-postaya bakıp o kişinin ilk rezervasyonunu
      döndürüyordu. Yani yanlış kod yazan bir misafire BAŞKA bir rezervasyonun
      QR'ı veriliyordu (yerelde ölçüldü: aynı e-postada 48 rezervasyon).
    */
    if (code.length < MIN_BOOKING_CODE_LENGTH) {
      return NextResponse.json({ ok: false, error: "Booking not found" }, { status: 404 });
    }

    if (!(await rateLimit(`booking_lookup:email:${normalizedEmail}`, 20, 60 * 60_000))) {
      return NextResponse.json({ ok: false, error: "too_many_requests" }, { status: 429 });
    }

    const guestScope = {
      OR: [{ guestEmail: normalizedEmail }, { guest: { email: normalizedEmail } }],
    };

    /*
      İki eşleşme çıkarsa HİÇBİRİ açılmaz: yanlış rezervasyonun QR'ını vermek,
      hiç vermemekten kötüdür -- esnaf tarar, tarih ve valiz sayısı tutmaz.
    */
    const matches = await prisma.booking.findMany({
      where: { id: { startsWith: code }, ...guestScope },
      select: { id: true },
      take: 2,
    });

    const foundId = matches.length === 1 ? matches[0].id : null;
    if (!foundId) {
      return NextResponse.json({ ok: false, error: "Booking not found" }, { status: 404 });
    }

    const token = await signGuestLookupToken({ bookingId: foundId, email: normalizedEmail });

    return NextResponse.json({ ok: true, token });
  } catch (e) {
    /*
      Ham hata metni İSTEMCİYE GİTMEZ (2026-08-25). `String(e)` bir Prisma
      sorgusunu, dosya yolunu veya şema adını dışarı taşıyabiliyordu; ayrıca
      hiçbir yere loglanmadığı için gerçek sebep de kayboluyordu. Sebep log'a,
      istemciye sabit bir kod.
    */
    logger.error({ err: e }, "booking_lookup_failed");
    return NextResponse.json({ ok: false, error: "lookup_failed" }, { status: 500 });
  }
}
