import prisma from "@/lib/db";

const DEFAULT_POSTS = [
  /*
    ISTANBUL YAZILARI BURADAN KALDIRILDI (2026-09-01).

    Ayni iki slug artik `content/blog/cities/istanbul.ts` icinde ve
    `scripts/blog-city-posts.ts` ile yaziliyor. Ikisi bir arada durursa
    hangisinin kazandigi CALISMA SIRASINA bagli kaliyordu: bos bir
    veritabaninda once bu dosya calisip eski jenerik govdeyi yaziyor, sonra
    script uzerine yaziyordu -- ya da tersi. Slug `@unique` oldugu icin
    catisma sessiz: kimse hata gormuyor, sadece yanlis metin yayinda kaliyor.

    Sehre bagli olmayan uc yazi burada kaldi; onlarin kod tarafinda baska bir
    kaynagi yok.
  */
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
      <p>Sabah çıkış yaptıktan hemen sonra en yakındaki BagajPark noktasına bavullarınızı teslim edin. Ardından, daha önce vakit bulamadığınız sergileri gezebilir, son bir akşam yemeği yiyebilir veya rahatça hediyelik eşya alışverişi yapabilirsiniz. Uçuş saatiniz yaklaştığında bavulunuzu bıraktığınız noktadan teslim alıp doğrudan yola çıkabilirsiniz.</p>
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
];

export async function ensureDefaultBlogPosts(locale: string) {
  const existing = await prisma.blogPost.findMany({
    where: { locale, isPublished: true },
    orderBy: { createdAt: "desc" },
  });

  if (existing.length > 0) {
    return existing;
  }

  const postsToCreate = DEFAULT_POSTS.filter((p) => p.locale === locale);
  if (postsToCreate.length === 0) {
    return [];
  }

  for (const post of postsToCreate) {
    await prisma.blogPost.upsert({
      where: { slug: post.slug },
      update: {
        title: post.title,
        excerpt: post.excerpt,
        content: post.content,
        coverImage: post.coverImage,
        authorName: post.authorName,
        isPublished: post.isPublished,
      },
      create: post,
    });
  }

  return prisma.blogPost.findMany({
    where: { locale, isPublished: true },
    orderBy: { createdAt: "desc" },
  });
}
