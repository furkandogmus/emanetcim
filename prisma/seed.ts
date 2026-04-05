import 'dotenv/config';
import { Role, BookingStatus, SealStatus } from '@prisma/client';
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
    where: { email: 'admin@test.com' },
    update: { 
      passwordHash,
      emailVerified: new Date(),
      role: Role.ADMIN,
    },
    create: {
      email: 'admin@test.com',
      name: 'Test Admin',
      role: Role.ADMIN,
      passwordHash,
      emailVerified: new Date(),
      phone: '+905001112233',
    },
  });

  const partner = await prisma.user.upsert({
    where: { email: 'esnaf@test.com' },
    update: { 
      passwordHash,
      emailVerified: new Date(),
      role: Role.PARTNER,
    },
    create: {
      email: 'esnaf@test.com',
      name: 'Örnek Esnaf (Mehmet Usta)',
      role: Role.PARTNER,
      passwordHash,
      emailVerified: new Date(),
      phone: '+905004445566',
    },
  });

  const guest = await prisma.user.upsert({
    where: { email: 'misafir@test.com' },
    update: { passwordHash, emailVerified: new Date() },
    create: {
      email: 'misafir@test.com',
      name: 'Test Misafir',
      role: Role.GUEST,
      passwordHash,
      emailVerified: new Date(),
      phone: '+905007778899',
    },
  });

  const testShop = await prisma.shop.upsert({
    where: { subMerchantKey: 'test-shop-123' },
    update: {
      isActive: true,
      ownerId: partner.id,
      pricePerDay: 80,
    },
    create: {
      id: SEED_GALATA_SHOP_ID,
      ownerId: partner.id,
      name: 'Emanetçi Test Noktası (Galata)',
      address: 'Galata Kulesi Sk. No:12, Beyoğlu, İstanbul',
      latitude: 41.0256,
      longitude: 28.9741,
      capacity: 50,
      isActive: true,
      rating: 5.0,
      pricePerDay: 80,
      subMerchantKey: 'test-shop-123',
      subMerchantType: 'PRIVATE_COMPANY',
      hasRestroom: true,
      open247: true,
      openingTime: '00:00',
      closingTime: '23:59',
    },
  });

  const sultanahmetShop = await prisma.shop.upsert({
    where: { subMerchantKey: 'sultan-456' },
    update: { isActive: true },
    create: {
      ownerId: partner.id,
      name: 'Sultanahmet Corner (Test)',
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
        { shopId: testShop.id, quantity: 50, status: 'PENDING' },
        { shopId: testShop.id, quantity: 100, status: 'SHIPPED' },
        { shopId: sultanahmetShop.id, quantity: 25, status: 'DELIVERED' },
      ],
    });
  }

  const existingSample = await prisma.booking.findFirst({
    where: { guestId: guest.id, shopId: testShop.id, status: BookingStatus.PAID },
  });
  if (!existingSample) {
    await prisma.booking.create({
      data: {
        guestId: guest.id,
        shopId: testShop.id,
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

  await prisma.seal.createMany({
    data: Array.from({ length: 40 }, (_, i) => ({
      serialNumber: 100100 + i,
      shopId: testShop.id,
      status: SealStatus.ASSIGNED,
      assignedAt: new Date(),
    })),
    skipDuplicates: true,
  });

  console.log('Seedleme tamamlandı!');
  console.table({
    'Admin Email': admin.email,
    'Partner Email': partner.email,
    'Guest Email': guest.email,
    'Test Shop ID': testShop.id,
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
