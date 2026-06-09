# BagajPark — Lansman Pazarlama ve Reklam Planı

> Hazırlanma: 2026-06-10. Hedef: canlıya çıkış sonrası ilk 90 günde organik + ücretli kanallardan ilk rezervasyonları üretmek.

---

## 1. Konumlandırma ve hedef kitle

**Tek cümle:** "Valizini güvenli bir esnafa bırak, şehri elin boş gez — dakikalar içinde rezervasyon."

| Segment | İhtiyaç | Kanal |
|---|---|---|
| Yabancı turist (İstanbul/Antalya/Kapadokya) | Otel check-in öncesi/sonrası bagaj | Google EN arama, TripAdvisor/Reddit, OTA blogları |
| Yerli gezgin / hafta sonu kaçamağı | Otobüs–uçak arası boş saatler | Google TR arama, Instagram |
| İş seyahati | Toplantı öncesi valiz | Google TR, LinkedIn (düşük öncelik) |
| Esnaf (arz tarafı) | Pasif ek gelir | Yüz yüze saha, become-partner sayfası, esnaf WhatsApp grupları |

Pazar yeri olduğumuz için **arz önce gelir**: reklam harcamasına başlamadan önce İstanbul'da en az 15–20 aktif nokta hedeflenmeli (Sultanahmet, Taksim/Beyoğlu, Kadıköy, havalimanı hatları).

## 2. SEO — mevcut durum ve içerik planı

Teknik SEO büyük oranda hazır (hreflang ×14 dil, sitemap, robots, JSON-LD: WebSite/Organization/FAQ/Breadcrumb, şehir landing'leri). Kalan işler `docs/LAUNCH_CHECKLIST.md`'de.

### İçerik takvimi (blog, ilk 8 hafta — TR + EN çiftli yayın)

1. "İstanbul'da bagaj emanet: havalimanı, Sultanahmet ve Taksim rehberi" / EN karşılığı ("luggage storage Istanbul")
2. "Otel check-out sonrası valiz nereye bırakılır?" / "Where to leave luggage after hotel checkout"
3. "İstanbul Havalimanı emanet ücretleri vs BagajPark karşılaştırması"
4. "Kapadokya'da 1 gün: valizsiz gezi rotası"
5. "Bagaj emanetinde sigorta nasıl çalışır?" (güven içeriği — dönüşüm sayfalarına iç link)
6. "Antalya kaleiçi bagaj emanet noktaları"
7. "Esnaflar için: dükkânınız BagajPark noktası olursa ne kazanırsınız?" (arz tarafı SEO)
8. "İzmir Alsancak — Basmane arası valizsiz gezi"

Kural: her yazı bir şehir landing'ine (`/luggage-storage/{slug}`) ve `/search`e iç link verir; başlıkta hedef sorgu geçer; 800+ kelime; FAQ bloğu + FAQPage JSON-LD.

### Şehir sayfası genişletmesi
- Mevcut 12 şehir slug'ı var; TR odaklı eksikler: **bursa, eskişehir, trabzon, fethiye, alanya, marmaris** (arz açıldıkça eklenir, `storage-cities.ts` + `CityStorage` i18n anahtarları).
- Şehir sayfalarındaki Unsplash hero görseli yerine şehir bazlı yerel/optimize görsel (LCP + telif).

### Yerel SEO
- Her partner dükkân için **Google Business Profile** "luggage storage" kategorisinde kayıt teşviki; profil açıklamasına BagajPark rezervasyon linki (UTM'li).
- `LocalBusiness` JSON-LD shop sayfalarında olduğundan emin olun (varsa koordinat + openingHours alanlarıyla zenginleştirin).

## 3. Google Ads — kampanya yapısı

Bütçe önerisi (başlangıç): **günlük 600–900 TL** (~%70 Arama TR/EN, %20 Performance Max, %10 marka koruma). İlk 2 hafta veri toplama; tCPA'ya rezervasyon dönüşümü 30+ olunca geçilir.

### Kampanya 1 — TR Arama (jenerik)
Ad group'lar: `bagaj emanet`, `valiz emanet`, `emanet dolabı`, `şehir + bagaj emanet` (İstanbul/Antalya/İzmir ayrı ad group).

Anahtar kelimeler (phrase/exact): "bagaj emanet", "valiz emanet yeri", "istanbul bagaj emanet", "taksim emanetçi", "sultanahmet bagaj bırakma", "havalimanı emanet ücreti", "valiz nereye bırakılır".

Örnek RSA:
- Başlıklar: "Bagaj Emanet — Dakikada Rezervasyon" · "Valizini Bırak, Şehri Gez" · "Sigortalı Bagaj Emanet Noktaları" · "İstanbul'da Yakınında Emanet Noktası" · "Saatlik Değil, Günlük Sabit Fiyat"
- Açıklamalar: "Merkezi noktalardaki güvenli esnaflara valizini bırak. Online rezervasyon, şeffaf fiyat, sigorta dahil." · "Otel check-in öncesi valiz derdi yok. En yakın BagajPark noktasını bul, 2 dakikada ayırt."

### Kampanya 2 — EN Arama (turist, konum hedefi: Türkiye + kaynak ülkeler)
Ad group'lar: `luggage storage istanbul`, `bag drop istanbul`, `luggage storage antalya/cappadocia`.
Anahtar kelimeler: "luggage storage istanbul", "left luggage istanbul", "bag storage near sultanahmet", "where to leave luggage istanbul", "luggage storage istanbul airport alternative".

### Kampanya 3 — Marka koruma
"bagajpark", "bagaj park" exact; düşük bütçe, rakip teklif girerse savunma.

### Negatif kelimeler (hesap düzeyi)
"iş ilanı", "kiralık dolap satın al", "ikinci el valiz", "bagaj fiyatları thy", "ek bagaj", "bagaj hakkı", "kayıp bagaj" — havayolu bagaj sorguları bütçeyi yer.

### Dönüşüm izleme
- Plausible custom event'leri: `booking_started`, `booking_paid`, `partner_apply` (CookieConsent `all` koşuluna dikkat).
- Google Ads dönüşümü için ya GA4/gtag eklenmeli (çerez onayına bağlı) ya da Plausible→server-side import; **ilk fazda en azından "Teşekkürler/ödeme başarılı" sayfa URL hedefi** tanımlayın.
- UTM standardı: `utm_source=google&utm_medium=cpc&utm_campaign=tr-search-{city}`.

## 4. Meta (Instagram/Facebook)
- İlk fazda **retargeting yok** (piksel + çerez onayı işi); bunun yerine organik: haftada 3 Reels — "valizle gezilmez" mini skeçleri, partner dükkân tanıtımları, şehir rehberi carousel'leri.
- `marketing/video/` klasörü bunun için kullanılabilir; 9:16, 15–30 sn, TR altyazı + EN versiyon.
- Lansmandan 4–6 hafta sonra trafik kampanyası (hedef: İstanbul'a seyahat ilgisi, EN + TR kreatif ayrı).

## 5. Ücretsiz/PR kanalları (ilk 30 gün)
- TripAdvisor forum + Reddit r/istanbul "where to store luggage" başlıklarında **bilgilendirici** yanıtlar (spam değil; tek link, şehir landing'ine).
- Ekşi Sözlük "bagaj emanet" başlığı; Webrazzi/StartupCentrum lansman haberi pitch'i.
- Otel resepsiyonları ile anlaşma: doluyken BagajPark'a yönlendirme kartı (QR → UTM'li link).
- App Store / Play Store (mobil uygulama yayınlanınca): ASO başlık "BagajPark: Bagaj & Valiz Emanet", anahtar kelime alanına TR+EN sorgular.

## 6. Ölçüm ve hedefler (ilk 90 gün)

| Metrik | 30 gün | 90 gün |
|---|---|---|
| Aktif nokta (İstanbul) | 15 | 50 (betadan çıkış eşiği) |
| Organik tıklama/ay (GSC) | 500 | 3.000 |
| Ücretli dönüşüm maliyeti | öğrenme | < ortalama sepetin %50'si |
| Rezervasyon/ay | 30 | 250 |
| Blog yayını | 8 | 24 |

Haftalık rutin: GSC sorgu raporu → yeni içerik fikri; Ads arama terimleri raporu → negatif kelime ekleme; Plausible funnel kontrolü.
