import 'dotenv/config';
import { Role, BookingStatus } from '@prisma/client';
import prisma from '../src/lib/db';
import { hashPassword } from '../src/lib/auth-password';

/** E2E ve dokümantasyonla uyumlu sabit dükkan id (checkout URL). */
export const SEED_GALATA_SHOP_ID = 'e2e00000-0000-4000-8000-000000000001';

/**
 * Seed Script - Emanetçi Test Verileri
 */
async function main() {
  console.log('Seedleme başlatılıyor...');

  await prisma.platformSettings.upsert({
    where: { id: 'default' },
    create: { id: 'default' },
    update: {},
  });

  /** Login sayfası ile aynı: `NEXT_PUBLIC_DEMO_PASSWORD` yoksa `Demo123!` (DEMO_PASSWORD tek başına istemcide yok). */
  const demoPassword =
    typeof process.env.NEXT_PUBLIC_DEMO_PASSWORD === 'string' &&
    process.env.NEXT_PUBLIC_DEMO_PASSWORD.length > 0
      ? process.env.NEXT_PUBLIC_DEMO_PASSWORD
      : 'Demo123!';
  const passwordHash = await hashPassword(demoPassword);
  console.log(`Demo hesap şifresi (NEXT_PUBLIC_DEMO_PASSWORD veya varsayılan): ${demoPassword}`);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@emanetci.com' },
    update: { passwordHash },
    create: {
      email: 'admin@emanetci.com',
      name: 'Emanetçi Admin',
      role: Role.ADMIN,
      passwordHash,
    },
  });

  const partnerMatcha = await prisma.user.upsert({
    where: { email: 'galata@shop.com' },
    update: { passwordHash },
    create: {
      email: 'galata@shop.com',
      name: 'Hüseyin Usta',
      role: Role.PARTNER,
      passwordHash,
    },
  });

  const guest = await prisma.user.upsert({
    where: { email: 'misafir@örnek.com' },
    update: { passwordHash },
    create: {
      email: 'misafir@örnek.com',
      name: 'Demo Misafir',
      role: Role.GUEST,
      passwordHash,
    },
  });

  const galataShop = await prisma.shop.upsert({
    where: { subMerchantKey: 'galata-123' },
    update: {
      pricePerDay: 80,
      hasRestroom: true,
    },
    create: {
      id: SEED_GALATA_SHOP_ID,
      ownerId: partnerMatcha.id,
      name: 'Galata Gift & Luggage',
      address: 'Galata Kulesi Sk. No:12, İstanbul',
      latitude: 41.0256,
      longitude: 28.9741,
      capacity: 25,
      isActive: true,
      rating: 4.9,
      pricePerDay: 80,
      subMerchantKey: 'galata-123',
      subMerchantType: 'PRIVATE_COMPANY',
      hasRestroom: true,
      open247: false,
    },
  });

  const sultanahmetShop = await prisma.shop.upsert({
    where: { subMerchantKey: 'sultan-456' },
    update: {},
    create: {
      ownerId: partnerMatcha.id,
      name: 'Sultanahmet Corner',
      address: 'Ayasofya Meydanı No:2, İstanbul',
      latitude: 41.0085,
      longitude: 28.9802,
      capacity: 15,
      isActive: true,
      rating: 4.7,
      pricePerDay: 70,
      subMerchantKey: 'sultan-456',
      subMerchantType: 'PERSONAL',
    },
  });

  await prisma.coupon.upsert({
    where: { code: 'WELCOME10' },
    update: {},
    create: {
      code: 'WELCOME10',
      discount: 10,
      isPercent: true,
      minPrice: 50,
      maxUses: 1000,
      isActive: true,
    },
  });

  const c1 = await prisma.campaign.findFirst({
    where: { name: 'İstanbul Yaz Kampanyası' },
  });
  if (!c1) {
    await prisma.campaign.create({
      data: {
        name: 'İstanbul Yaz Kampanyası',
        discountPercent: 15,
        isActive: true,
        message: 'Yaz sezonu indirimi',
      },
    });
  }
  const c2 = await prisma.campaign.findFirst({ where: { name: 'İlk Rezervasyon' } });
  if (!c2) {
    await prisma.campaign.create({
      data: { name: 'İlk Rezervasyon', discountPercent: 10, isActive: true },
    });
  }

  const sealCount = await prisma.sealRequest.count();
  if (sealCount === 0) {
    await prisma.sealRequest.createMany({
      data: [
        { shopId: galataShop.id, quantity: 50, status: 'PENDING' },
        { shopId: galataShop.id, quantity: 100, status: 'SHIPPED' },
        { shopId: sultanahmetShop.id, quantity: 25, status: 'DELIVERED' },
      ],
    });
  }

  const existingSample = await prisma.booking.findFirst({
    where: { guestId: guest.id, shopId: galataShop.id, status: BookingStatus.PAID },
  });
  if (!existingSample) {
    await prisma.booking.create({
      data: {
        guestId: guest.id,
        shopId: galataShop.id,
        status: BookingStatus.PAID,
        checkInTime: new Date(),
        checkOutTime: new Date(Date.now() + 86400000),
        bagCountS: 0,
        bagCountM: 1,
        bagCountXl: 0,
        unitPrice: 80,
        totalPrice: 95,
        qrCodeToken: `seed_${crypto.randomUUID()}`,
      },
    });
  }

  console.log('Seedleme tamamlandı!');
  console.table({
    'Admin Email': admin.email,
    'Partner Email': partnerMatcha.email,
    'Guest Email': guest.email,
    'Galata Shop ID': galataShop.id,
    'Shops': 2,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
