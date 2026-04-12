/**
 * Stress Test için DB Seed Script
 *
 * Farklı seviyelerde test verisi oluşturur:
 *   npx tsx tests/stress/seed-test-data.ts --level smoke     # 10 kullanıcı
 *   npx tsx tests/stress/seed-test-data.ts --level load      # 100 kullanıcı
 *   npx tsx tests/stress/seed-test-data.ts --level stress    # 1,000 kullanıcı
 *   npx tsx tests/stress/seed-test-data.ts --level spike     # 10,000 kullanıcı
 *   npx tsx tests/stress/seed-test-data.ts --level breakpoint # 100,000 kullanıcı
 *
 * UYARI: Sadece test ortamında çalıştırın!
 */

import { PrismaClient, Role, BookingStatus } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const LEVELS: Record<string, number> = {
  smoke: 10,
  load: 100,
  stress: 1_000,
  spike: 10_000,
  breakpoint: 100_000,
};

const BATCH_SIZE = 500;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomInt(min: number, max: number): number {
  return Math.floor(randomFloat(min, max + 1));
}

// İstanbul merkezli rastgele koordinatlar
function randomIstanbulCoords() {
  return {
    lat: randomFloat(40.95, 41.15),
    lng: randomFloat(28.85, 29.15),
  };
}

const ISTANBUL_DISTRICTS = [
  "Sultanahmet", "Taksim", "Kadıköy", "Beşiktaş", "Beyoğlu",
  "Fatih", "Üsküdar", "Şişli", "Bakırköy", "Ataşehir",
  "Maltepe", "Kartal", "Pendik", "Sarıyer", "Eyüp",
  "Bağcılar", "Bahçelievler", "Bayrampaşa", "Gaziosmanpaşa", "Kağıthane",
];

const SHOP_NAMES = [
  "Bagaj Durağı", "Emanet Noktası", "Güvenli Depo", "Valiz Saklama",
  "Bavul Durağı", "Çanta Evi", "Bagaj Market", "SafeKeep",
  "LuggagePoint", "BagDrop", "StoreMore", "TravelLight",
  "Emanetçim", "Bagaj Merkezi", "Depo Plus", "EasyBag",
];

async function createShops(count: number) {
  console.log(`🏪 ${count} mağaza oluşturuluyor...`);
  const passwordHash = await hashPassword("TestPartner123!");
  const shops = [];

  for (let i = 0; i < count; i++) {
    const coords = randomIstanbulCoords();
    const district = ISTANBUL_DISTRICTS[i % ISTANBUL_DISTRICTS.length];
    const shopName = `${SHOP_NAMES[i % SHOP_NAMES.length]} ${district} #${i + 1}`;

    shops.push({
      owner: {
        email: `partner_stress_${i}@test.bagajpark.com`,
        name: `Partner ${district} ${i}`,
        phone: `5${String(300000000 + i).padStart(9, "0")}`,
        passwordHash,
        role: Role.PARTNER,
      },
      shop: {
        name: shopName,
        address: `${district} Mahallesi, Test Sokak No: ${i + 1}, İstanbul`,
        latitude: coords.lat,
        longitude: coords.lng,
        dailyRate: randomInt(30, 80) * 100, // kuruş cinsinden
        isActive: true,
        capacity: randomInt(10, 100),
      },
    });
  }

  for (let batch = 0; batch < shops.length; batch += BATCH_SIZE) {
    const chunk = shops.slice(batch, batch + BATCH_SIZE);
    await Promise.all(
      chunk.map(async ({ owner, shop }) => {
        try {
          const user = await prisma.user.create({
            data: {
              email: owner.email,
              name: owner.name,
              phone: owner.phone,
              passwordHash: owner.passwordHash,
              role: owner.role,
              emailVerified: new Date(),
            },
          });
          await prisma.shop.create({
            data: {
              ...shop,
              ownerId: user.id,
            },
          });
        } catch {
          // Duplicate — skip
        }
      })
    );
    process.stdout.write(`\r  📦 ${Math.min(batch + BATCH_SIZE, shops.length)}/${shops.length}`);
  }
  console.log(" ✅");
  return shops.length;
}

async function createGuests(count: number) {
  console.log(`👤 ${count} misafir kullanıcı oluşturuluyor...`);
  const passwordHash = await hashPassword("StressTest123!");

  for (let batch = 0; batch < count; batch += BATCH_SIZE) {
    const size = Math.min(BATCH_SIZE, count - batch);
    const users = Array.from({ length: size }, (_, i) => {
      const idx = batch + i;
      return {
        email: `guest_stress_${idx}@test.bagajpark.com`,
        name: `StressGuest_${idx}`,
        passwordHash,
        role: Role.GUEST,
        emailVerified: new Date(),
      };
    });

    // Prisma createMany for bulk insert
    await prisma.user.createMany({
      data: users,
      skipDuplicates: true,
    });

    process.stdout.write(`\r  👤 ${Math.min(batch + BATCH_SIZE, count)}/${count}`);
  }
  console.log(" ✅");
}

async function createBookings(guestCount: number) {
  const bookingCount = Math.floor(guestCount * 0.3); // %30'u booking yapar
  console.log(`📋 ${bookingCount} rezervasyon oluşturuluyor...`);

  const shops = await prisma.shop.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  if (shops.length === 0) {
    console.log("  ⚠️  Aktif mağaza yok, booking atlanıyor");
    return;
  }

  const guests = await prisma.user.findMany({
    where: {
      role: Role.GUEST,
      email: { startsWith: "guest_stress_" },
    },
    select: { id: true },
    take: bookingCount,
  });

  const statuses = [
    BookingStatus.WAITING_APPROVAL,
    BookingStatus.APPROVED,
    BookingStatus.PAID,
    BookingStatus.CHECKED_IN,
    BookingStatus.CHECKED_OUT,
    BookingStatus.CANCELLED,
  ];

  for (let batch = 0; batch < guests.length; batch += BATCH_SIZE) {
    const chunk = guests.slice(batch, batch + BATCH_SIZE);
    const bookings = chunk.map((guest, i) => {
      const shop = shops[(batch + i) % shops.length];
      const checkIn = new Date();
      checkIn.setDate(checkIn.getDate() + randomInt(1, 30));
      const checkOut = new Date(checkIn);
      checkOut.setHours(checkOut.getHours() + randomInt(2, 48));
      const bagS = randomInt(0, 3);
      const bagM = randomInt(0, 2);
      const bagXl = randomInt(0, 1);
      const totalBags = bagS + bagM + bagXl || 1;

      return {
        guestId: guest.id,
        shopId: shop.id,
        bagCountS: bagS,
        bagCountM: bagM,
        bagCountXl: bagXl,
        totalBags,
        unitPrice: 5000,
        totalPrice: totalBags * 5000,
        insuranceFee: 500,
        checkInTime: checkIn,
        checkOutTime: checkOut,
        status: statuses[randomInt(0, statuses.length - 1)],
      };
    });

    await prisma.booking.createMany({
      data: bookings,
      skipDuplicates: true,
    });

    process.stdout.write(`\r  📋 ${Math.min(batch + BATCH_SIZE, guests.length)}/${guests.length}`);
  }
  console.log(" ✅");
}

async function main() {
  const levelArg = process.argv.find((a) => a.startsWith("--level="))?.split("=")[1]
    || process.argv[process.argv.indexOf("--level") + 1]
    || "smoke";

  const level = levelArg.toLowerCase();
  const userCount = LEVELS[level];

  if (!userCount) {
    console.error(`❌ Geçersiz seviye: ${level}`);
    console.error(`   Geçerli seviyeler: ${Object.keys(LEVELS).join(", ")}`);
    process.exit(1);
  }

  // Güvenlik kontrolü
  if (process.env.NODE_ENV === "production" && !process.env.ALLOW_STRESS_SEED) {
    console.error("❌ Production ortamında seed yapılamaz!");
    console.error("   ALLOW_STRESS_SEED=1 ile override edebilirsiniz (kendi riskiniz)");
    process.exit(1);
  }

  const shopCount = Math.max(5, Math.floor(userCount / 20));

  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log(`║  BagajPark Stress Test Seed — ${level.toUpperCase()}`);
  console.log("╠══════════════════════════════════════════════════════════╣");
  console.log(`║  Kullanıcı:    ${userCount.toLocaleString()}`);
  console.log(`║  Mağaza:       ${shopCount}`);
  console.log(`║  Rezervasyon:  ~${Math.floor(userCount * 0.3).toLocaleString()}`);
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log("");

  const startTime = Date.now();

  await createShops(shopCount);
  await createGuests(userCount);
  await createBookings(userCount);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("");
  console.log(`🎉 Seed tamamlandı! (${elapsed}s)`);
  console.log(`   Toplam kullanıcı: ${userCount.toLocaleString()}`);
  console.log(`   Toplam mağaza:    ${shopCount}`);
}

async function cleanup() {
  console.log("🧹 Stress test verilerini temizleniyor...");

  await prisma.booking.deleteMany({
    where: {
      guest: { email: { startsWith: "guest_stress_" } },
    },
  });
  await prisma.shop.deleteMany({
    where: {
      owner: { email: { startsWith: "partner_stress_" } },
    },
  });
  await prisma.user.deleteMany({
    where: {
      OR: [
        { email: { startsWith: "guest_stress_" } },
        { email: { startsWith: "partner_stress_" } },
      ],
    },
  });

  console.log("✅ Temizlik tamamlandı!");
}

// --cleanup flag'i ile temizlik yapılabilir
if (process.argv.includes("--cleanup")) {
  cleanup()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
} else {
  main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}
