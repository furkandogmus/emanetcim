import 'dotenv/config';
import { Role, BookingStatus, SealStatus } from '@prisma/client';
import prisma from '../src/lib/db';
import { hashPassword } from '../src/lib/auth-password';

/** E2E ve dokümantasyonla uyumlu sabit dükkan id (checkout URL). */
export const SEED_GALATA_SHOP_ID = 'e2e00000-0000-4000-8000-000000000001';

/**
 * Seed Script - BagajPark Test Verileri
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
    where: { id: SEED_GALATA_SHOP_ID },
    update: {
      isActive: true,
      ownerId: partner.id,
      pricePerDay: 80,
    },
    create: {
      id: SEED_GALATA_SHOP_ID,
      ownerId: partner.id,
      name: 'BagajPark Test Noktası (Galata)',
      address: 'Galata Kulesi Sk. No:12, Beyoğlu, İstanbul',
      latitude: 41.0256,
      longitude: 28.9741,
      capacity: 50,
      isActive: true,
      rating: 5.0,
      pricePerDay: 80,
      hasRestroom: true,
      open247: true,
      openingTime: '00:00',
      closingTime: '23:59',
    },
  });

  const sultanahmetShop = await prisma.shop.upsert({
    where: { id: 'e2e00000-0000-4000-8000-000000000002' },
    update: { isActive: true },
    create: {
      id: 'e2e00000-0000-4000-8000-000000000002',
      ownerId: partner.id,
      name: 'Sultanahmet Corner (Test)',
      address: 'Ayasofya Meydanı No:2, İstanbul',
      latitude: 41.0085,
      longitude: 28.9802,
      capacity: 15,
      isActive: true,
      rating: 4.7,
      pricePerDay: 70,
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

  // Seed Blog Posts
  const blogPostsCount = await prisma.blogPost.count();
  if (blogPostsCount === 0) {
    console.log("Blog yazıları seedleniyor...");
    await prisma.blogPost.createMany({
      data: [
        {
          locale: "tr",
          slug: "istanbul-valiz-emanet-rehberi",
          title: "İstanbul Seyahatinde Valiz Çilesine Son: Güvenli Emanet Rehberi",
          excerpt: "İstanbul sokaklarını valizlerinizi sürüklemeden, özgürce gezmeniz için en iyi emanet çözümlerini ve ipuçlarını derledik.",
          coverImage: "https://images.unsplash.com/photo-1549877452-9c387954fbc2?auto=format&fit=crop&w=1200&q=80",
          authorName: "BagajPark Seyahat Editörü",
          isPublished: true,
          content: `
            <h2>İstanbul Sokaklarında Özgürce Dolaşmak Mümkün</h2>
            <p>Tarihi yarımadadan Galata'ya, Kadıköy'ün hareketli sokaklarından Beşiktaş'a kadar İstanbul, her köşesinde keşfedilecek binlerce detayı barındıran devasa bir metropoldür. Ancak bu muhteşem şehri gezerken yanınızda ağır valizler taşımak, seyahat deneyiminizi ciddi anlamda olumsuz etkileyebilir. Özellikle tarihi bölgelerdeki taş döşemeli sokaklar, yokuşlar ve kalabalık caddeler, tekerlekli bavullarla seyahat etmeyi neredeyse imkansız hale getirir.</p>

            <h2>Tarihi Yarımada ve Sultanahmet Gezileri</h2>
            <p>Ayasofya Camii, Yerebatan Sarnıcı ve Topkapı Sarayı gibi noktaları ziyaret ederken güvenlik önlemleri nedeniyle büyük sırt çantaları veya valizlerle içeri girmeniz mümkün değildir. Bu tarihi yapıların girişlerinde emanet ofisleri bulunmamaktadır. Dolayısıyla gezintiye başlamadan önce bagajlarınızı güvenli bir yere bırakmanız gerekir.</p>

            <h2>Havalimanı ve Terminal Emanetlerinin Sınırları</h2>
            <p>Birçok gezgin valizlerini havalimanı veya tren istasyonlarındaki emanet dolaplarına bırakmayı düşünür. Ancak bu dolapların kapasiteleri sınırlıdır ve yüksek saatlik/günlük ücretleri nedeniyle bütçenizi zorlayabilir. Ayrıca şehre uzak terminallere sadece bavul bırakıp geri dönmek büyük bir zaman kaybıdır.</p>

            <h2>BagajPark ile Yerel Esnaf Güvencesi</h2>
            <p>BagajPark, İstanbul genelindeki yüzlerce güvenilir cafe, otel ve mağaza ile iş birliği yaparak seyahatinizi kolaylaştırır. Sisteme giriş yapıp konumunuza en yakın emanet noktasını seçerek rezervasyon yapabilirsiniz. Teslim ettiğiniz her bagaj özel güvenlik mühürleriyle kapatılır ve anlaşmalı kurumlarca çalınmaya veya hasara karşı sigortalanır. Böylece yüklerinizden kurtulup İstanbul'un tadını son ana kadar çıkarabilirsiniz.</p>
          `.trim(),
        },
        {
          locale: "en",
          slug: "istanbul-luggage-storage-guide",
          title: "No More Suitcase Struggle in Istanbul: Secure Luggage Storage Guide",
          excerpt: "Discover the best options and tips for storing your luggage securely in Istanbul so you can explore the city hassle-free.",
          coverImage: "https://images.unsplash.com/photo-1549877452-9c387954fbc2?auto=format&fit=crop&w=1200&q=80",
          authorName: "BagajPark Travel Editor",
          isPublished: true,
          content: `
            <h2>Explore Istanbul Without Heavy Suitcases</h2>
            <p>From the historical peninsula to Galata, the lively streets of Kadikoy, and the coastal vibe of Besiktas, Istanbul is a massive metropolis filled with endless historical gems. However, dragging heavy suitcases around this city can quickly ruin your experience. Cobblestone paths, steep hills, and crowded avenues make traveling with wheeled bags extremely difficult.</p>

            <h2>Visiting Historic Sultanahmet</h2>
            <p>When visiting landmarks like Hagia Sophia, the Basilica Cistern, or Topkapi Palace, you cannot enter with large bags due to strict security measures. Since these monuments do not offer cloakrooms or locker services, finding a nearby luggage storage option beforehand is essential.</p>

            <h2>The Limits of Airport and Station Lockers</h2>
            <p>While airport or major train station lockers seem like an option, they are often located far from the city center, have limited capacity, and charge high hourly rates. Traveling all the way back to a transit hub just to drop off a bag is a massive waste of precious travel time.</p>

            <h2>Secure Storage in Local Partners with BagajPark</h2>
            <p>BagajPark collaborates with trusted local cafes, hotels, and retail shops across Istanbul to solve this problem. Through the online platform, you can book a verified location close to you in seconds. Every stored bag is locked with a numbered security seal and covered by insurance, letting you wander the streets of Istanbul completely weight-free.</p>
          `.trim(),
        },
        {
          locale: "tr",
          slug: "seyahatte-hafif-olma-yollari",
          title: "Seyahatte Hafif Olmanın Yolları ve Akıllı Bagaj Çözümleri",
          excerpt: "Hafif seyahat etmenin ipuçlarını öğrenin: Valiz hazırlama tekniklerinden gün kurtaran pratik bagaj depolama yöntemlerine kadar her şey.",
          coverImage: "https://images.unsplash.com/photo-1553913861-c0fddf2619ee?auto=format&fit=crop&w=1200&q=80",
          authorName: "BagajPark Seyahat Editörü",
          isPublished: true,
          content: `
            <h2>Hafif Seyahat Etmenin Avantajları</h2>
            <p>Daha az eşyayla yola çıkmak sadece fiziksel olarak rahatlamanızı sağlamaz, aynı zamanda zihinsel olarak da seyahate daha çok odaklanmanıza yardımcı olur. Kayıp bagaj stresi yaşamamak, uçaktan iner inmez doğrudan şehre karışabilmek ve toplu taşımayı rahatça kullanabilmek hafif seyahat etmenin en büyük faydalarındandır.</p>

            <h2>Akıllı Valiz Hazırlama Teknikleri</h2>
            <p>Valiz hazırlarken kıyafetlerinizi katlamak yerine rulo yapmak hem alandan tasarruf sağlar hem de buruşmalarını önler. Seyahatiniz boyunca birbiriyle eşleşebilecek nötr renklerde parçalardan oluşan bir kapsül gardırop oluşturun. Çok amaçlı kozmetik ürünleri ve katlanabilir seyahat aksesuarları da valiz hacmini önemli ölçüde azaltır.</p>

            <h2>Check-out Sonrası Süre Yönetimi</h2>
            <p>Otel veya Airbnb dairenizden sabah saat 11:00'de ayrılmak durumunda kalabilirsiniz ancak uçağınız akşam saatlerinde olabilir. Bu gibi durumlarda, tüm gün valizlerinizle dolaşmak yerine BagajPark gibi akıllı bagaj çözümlerini kullanarak dilediğiniz semtteki emanet noktalarımıza eşyalarınızı bırakabilir ve son gününüzü en verimli şekilde değerlendirebilirsiniz.</p>
          `.trim(),
        },
        {
          locale: "en",
          slug: "how-to-pack-light-travel",
          title: "How to Pack Light: Smart Baggage Tips for Travelers",
          excerpt: "Learn the secrets to packing light, minimizing travel stress, and utilizing convenient luggage storage during your trips.",
          coverImage: "https://images.unsplash.com/photo-1553913861-c0fddf2619ee?auto=format&fit=crop&w=1200&q=80",
          authorName: "BagajPark Travel Editor",
          isPublished: true,
          content: `
            <h2>The Benefits of Luggage-Free Packing</h2>
            <p>Traveling light not only spares your back but also clears your mind, letting you focus fully on the sights. Avoiding checked baggage fees, bypassing the baggage carousel, and easily navigating public transport are just a few reasons why traveling light is a game-changer.</p>

            <h2>Smart Packing Hacks</h2>
            <p>Rolling your clothes instead of folding them saves massive space and minimizes wrinkles. Build a capsule wardrobe with neutral colors that can be mixed and matched easily. Opt for travel-sized toiletries, solid cosmetics, and multi-functional gear to keep your suitcase weight low.</p>

            <h2>Managing the Post-Checkout Gap</h2>
            <p>It is common to check out of your accommodation by 11:00 AM while your flight leaves in the evening. Instead of carrying your bags through restaurants and shops, use a secure storage network like BagajPark. You can store your luggage at a nearby shop and enjoy the rest of your trip to the fullest.</p>
          `.trim(),
        },
        {
          locale: "tr",
          slug: "ucus-oncesi-bavulsuz-gezin",
          title: "Uçuş Öncesi Boş Zamanı Değerlendirme: Son Günü Bavulsuz Geçirin",
          excerpt: "Tatilin son gününde check-out sonrası uçuş saatine kadar geçen süreyi bavulsuz ve konforlu geçirmenin yollarını keşfedin.",
          coverImage: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1200&q=80",
          authorName: "BagajPark Seyahat Editörü",
          isPublished: true,
          content: `
            <h2>Tatilin Son Gününü Ziyan Etmeyin</h2>
            <p>Tatillerin en verimsiz geçen zamanı genellikle son gündür. Otelden çıkış yaptıktan sonra havaalanına gidene kadar geçen 6-8 saatlik sürede bagajların yanınızda olması, sizi sabit bir kafede oturmaya veya doğrudan havaalanına gidip saatlerce beklemeye zorlar. Oysa doğru bir planlama ile son günü harika bir şehir turuna dönüştürebilirsiniz.</p>

            <h2>Bavulsuz Bir Son Gün Planı</h2>
            <p>Sabab çıkış yaptıktan hemen sonra en yakındaki BagajPark noktasına bavullarınızı teslim edin. Ardından, daha önce vakit bulamadığınız sergileri gezebilir, son bir akşam yemeği yiyebilir veya rahatça hediyelik eşya alışverişi yapabilirsiniz. Uçuş saatiniz yaklaştığında bavulunuzu bıraktığınız noktadan teslim alıp doğrudan yola çıkabilirsiniz.</p>
          `.trim(),
        },
        {
          locale: "en",
          slug: "explore-luggage-free-before-flight",
          title: "Maximize Your Last Day: Explore Luggage-Free Before Your Flight",
          excerpt: "Discover how to make the most of your final vacation day after hotel checkout and before your departure flight.",
          coverImage: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1200&q=80",
          authorName: "BagajPark Travel Editor",
          isPublished: true,
          content: `
            <h2>Don't Waste Your Final Travel Day</h2>
            <p>The last day of a trip is often the least productive. After checking out of your hotel, carrying your luggage around forces you to sit at a cafe for hours or head directly to the airport too early. With proper planning, you can turn those final hours into an exciting part of your journey.</p>

            <h2>A Smart Last-Day Itinerary</h2>
            <p>Right after checkout, deposit your bags at a local BagajPark point. With your hands free, you can visit a museum you missed, enjoy a relaxed lunch, or buy local souvenirs without burden. Before heading to the airport, pick up your luggage in seconds and travel with ease.</p>
          `.trim(),
        }
      ]
    });
    console.log("Blog yazıları başarıyla seedlendi.");
  }

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
