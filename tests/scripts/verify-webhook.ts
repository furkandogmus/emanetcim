import prisma from "../../src/lib/db";
import { paymentService } from "../../src/services/PaymentService";

async function verifyWebhook() {
  console.log("--- Webhook Doğrulama Başlatılıyor ---");

  // 1. Önce PENDING bir rezervasyon bul
  let booking = await prisma.booking.findFirst({
    where: { status: 'PENDING' }
  });

  if (!booking) {
    console.log("PENDING rezervasyon bulunamadı, bir tane oluşturuluyor...");
    const guest = await prisma.user.findFirst({ where: { role: 'GUEST' } });
    const shop = await prisma.shop.findFirst();
    
    if (!guest || !shop) {
        console.error("Gerekli veri eksik (User/Shop)");
        return;
    }

    booking = await prisma.booking.create({
      data: {
        guestId: guest.id,
        shopId: shop.id,
        status: 'PENDING',
        checkInTime: new Date(),
        checkOutTime: new Date(),
        totalPrice: 150.0
      }
    });
  }

  console.log(`Hedef Rezervasyon ID: ${booking.id}`);

  // 2. Webhook simülasyonu (Payload)
  const mockPayload = {
    status: 'success',
    paymentId: `TEST_PAY_{Math.random().toString(36).substr(2, 9)}`,
    conversationId: booking.id
  };

  console.log("Simüle edilen Webhook Gönderiliyor...");
  
  const result = await paymentService.processWebhook(mockPayload);
  console.log("Sonuç:", result);

  // 3. Veritabanını kontrol et
  const updatedBooking = await prisma.booking.findUnique({
    where: { id: booking.id }
  });

  if (updatedBooking?.status === 'PAID') {
    console.log("✅ BAŞARILI: Rezervasyon 'PAID' durumuna geçti.");
    
    const log = await prisma.paymentLog.findFirst({
        where: { bookingId: booking.id }
    });
    if (log) console.log(`✅ BAŞARILI: Ödeme Logu oluşturuldu: ${log.transactionId}`);
  } else {
    console.error("❌ HATA: Rezervasyon durumu güncellenemedi!");
  }
}

verifyWebhook()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
