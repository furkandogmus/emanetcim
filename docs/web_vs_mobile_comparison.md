# BagajPark Web ↔ Mobil Karşılaştırma ve Boşluk Listesi — 2026-09-11

> Bu doküman **tamamen yeniden yazıldı**. Önceki sürüm (`docs/archive/2026-09-11-rakip-ve-parity/web_vs_mobile_comparison_2026-09-09.md`)
> kendi başına "tablonun geri kalanı Haziran'dan beri yeniden gözden geçirilmedi,
> muhtemelen eskimiş" diyordu — bu sürümde **tüm tablo koda karşı yeniden
> doğrulandı** (Explore agent'larıyla, tahmin değil dosya okuyarak). Bazı eski
> "GAP" satırları artık geçersiz çıktı (ör. valiz boyut rehberi mobilde Haziran'dan
> beri var), bazıları ise dokümanın hiç bahsetmediği **gerçek üretim hataları**
> olarak ortaya çıktı (ör. esnaf kazanç ekranı ağ hatasında sessizce ₺0 gösteriyor).

## Özet

- **Zaten eşit/parity olan** çok sayıda özellik var (auth, arama filtreleri, rezervasyon
  yönetimi, esnaf sipariş onay/red, muhur yönetimi) — bunlar aşağıda tekrar listelenmedi,
  önceki dokümanda "[DÜZELTİLDİ]" etiketiyle işaretli olanlar hâlâ geçerli.
- **5 gerçek üretim hatası** bulundu (P0) — bunlar rekabet boşluğu değil, düzeltilmesi
  gereken defektlerdir; `docs/DEFECT_BACKLOG.md`'ye de işlendi.
- **Mobilde eksik olan gerçek özellik/içerik boşlukları** aşağıda platform, öncelik ve
  eforla listelendi.
- **Mobilin web'den daha ileride olduğu** noktalar da var (izin ekranı, offline
  check-in/check-out kuyruğu) — Bölüm 4'te.

## 1. Gerçek Üretim Hataları (Bug, rekabet boşluğu değil) — P0

| # | Hata | Kanıt | Durum |
|---|---|---|---|
| 1 | İptal onay diyaloğunda yanlış başlık kullanılıyor (`booking.cancel_title` anahtarı `booking.cancellation_policy` ile birebir aynı metne sahip) | `mobile/lib/features/booking/booking_detail_screen.dart:589` | ✅ Düzeltildi — yeni `cancel_confirm_title` anahtarı eklendi (bkz. `docs/DEFECT_BACKLOG.md` MOBIL-1) |
| 2 | Arama ekranı dükkan listesi çekme hatasını sessizce yutuyor, harita boş kalıyor | `mobile/lib/features/search/search_screen.dart:498-500` | ✅ Düzeltildi — paylaşılan `ErrorState` eklendi (bkz. MOBIL-2) |
| 3 | Arama filtresi sıfır sonuç verdiğinde boş durum mesajı yok, alan tamamen boş | `mobile/lib/features/search/search_screen.dart:606` | ✅ Düzeltildi — kompakt boş-durum kartı eklendi (bkz. MOBIL-3) |
| 4 | Esnaf kazanç ekranı ağ hatasında sessizce ₺0 gösteriyor (gerçek hata gizleniyor) | `mobile/lib/features/partner/partner_earnings_screen.dart` (`_fetchStats`, `.error` hiç okunmuyor) | ✅ Düzeltildi + regresyon testi eklendi (bkz. MOBIL-4) |
| 5 | Bildirimler sekmesi üretimde her zaman boş — push mesajı hiçbir zaman `notificationProvider`'a yazılmıyor, sunucu tarafı geçmiş ucu da yok | `mobile/lib/core/services/notification_service.dart`, `mobile/lib/core/push/push_service.dart` | **Backlog — büyük efor** (bkz. MOBIL-5) |

## 2. Mobilde Eksik Özellik/İçerik Boşlukları

### P1 — belirgin, misafir/esnaf deneyimini gerçekten etkiliyor

| # | Boşluk | Efor | Kanıt |
|---|---|---|---|
| 6 | Saatlik/slot bazlı rezervasyon mobilde hiç yok; checkout kaba gün-bazlı tahmin gösteriyor | büyük | `mobile/lib/features/checkout/checkout_screen.dart:23-77,342-355`; `slot`/`hourly` için mobile/lib'de 0 sonuç |
| ~~7~~ | ~~Sadakat puanı mobilde hem UI'da hem API'de tamamen yok~~ — **KAPANDI (2026-09-12):** özellik hiç harcanamıyordu (bkz. `docs/DEFECT_BACKLOG.md` B7), web tarafından da komple kaldırıldı; artık bir boşluk değil. | — | — |
| 8 | Hesap verisi dışa aktarma (KVKK/GDPR) mobilde yok | orta | grep `mobile/lib` "export": 0 sonuç |
| 9 | KVKK metni kayıt ekranında yarım cümlede kesiliyor, tam metne link yok | küçük | `mobile/lib/features/auth/register_screen.dart:273-277` vs web'de 90 satırlık tam sayfa |
| 10 | 10.000 TL sigorta tavanı mobilde hiç gösterilmiyor; sigorta ücreti sunucudan değil sabit `₺15.0` kodlanmış | orta | `mobile/lib/features/checkout/checkout_screen.dart:353` |
| 11 | WhatsApp iletişim kanalı mobilde hiçbir ekranda yok | küçük | grep `mobile/lib` "whatsapp": 0 sonuç |
| 12 | Esnaf kazanç ekranında grafik/aylık kırılım yok (web'de `PartnerEarningsCharts.tsx`) | büyük | `mobile/lib/features/partner/partner_earnings_screen.dart` |
| 13 | Koyu modda misafir yolculuğu ve tüm esnaf ekranları "yarım" temalanmış (sabit `Colors.white`, 65+ yer) | büyük | bkz. Bölüm 3 |
| 14 | Esnafın kritik aksiyon butonlarında `Semantics` etiketleri sabit Türkçe/İngilizce (6 dilli web'e karşı dil parite kırılması) | orta | `partner_booking_detail_screen.dart:440,467,503,533,821-834` |
| 15 | Register/e-posta doğrulama/şifre sıfırlama/profil ekranlarında sabit hex renkler koyu modda WCAG AA kontrastının altında | orta | `register_screen.dart:155`, `profile_screen.dart:266,429,442,461,513,741,1092` |

### P2 — gerçek ama daha düşük etkili

| # | Boşluk | Efor |
|---|---|---|
| 16 | Dükkan detayında galeri/lightbox yok, tek fotoğraf gösteriliyor | orta |
| 17 | Toplam yorum sayısı gösterilmiyor, liste 5 ile sınırlı | küçük |
| 18 | Checkout "Neler Dahil" bilgisi tek satıra indirgenmiş (web'de 4 kalemlik ikonlu blok) | küçük |
| 19 | Misafir profilinde telefon numarası düzenlenemiyor | orta |
| 20 | Gizlilik/veri yönetimi tek sayfada birleşik değil (üç özellik dağınık) | küçük |
| 21 | Sigorta/güvence detay sayfası yok | orta |
| 22 | SSS (FAQ) sayfası yok | orta |
| 23 | İletişim formu yok, sadece statik e-posta adresi gösteriliyor | orta |
| 24 | Hakkımızda sayfası yalnızca sürüm numarası gösteriyor ("BagajPark v1.0.0") | küçük |
| 25 | Kullanım Koşulları/Gizlilik Politikası sadece kısa özet, tam hukuki metin değil | küçük |
| 26 | Bağımsız iptal politikası sayfası yok (yalnızca rezervasyon bağlamında) | küçük |
| 27 | Esnaf ana ekranında web'deki "günlük özet" (Pulse) blokları yok (varış/teslim dağılımı, doluluk %, aylık trend) | orta |
| 28 | Testimonial carousel ve fiyat karşılaştırma tablosu mobilde yok | orta |
| 29 | Checkout bagaj sayacı ve yardım ikonu 48×48dp dokunma hedefinin altında | küçük |
| 30 | İptal onayı ve esnaf onayla/reddet akışında ham `AlertDialog` kullanılıyor, proje kuralı olan `ConfirmDialog` değil | küçük |

### P3 — cila

| # | Boşluk | Efor |
|---|---|---|
| 31 | Mühür kanıt fotoğrafı hiçbir zaman misafire gösterilmiyor (web+mobil) | orta |
| 32 | Onboarding görselleri ağ hatasında sessizce kayboluyor (fallback yok) | küçük |
| 33 | Saatlik/slot rezervasyon ve 10.000 TL güvence rakamı web'de arama/dükkan detayında gizli kalıyor (bkz. `rakip_analizi.md` #1) | küçük |

## 3. Mobil Tasarım Denetimi — Ayrıntı

Ayrı bir Flutter tasarım denetiminde (guest ekranları, partner ekranları, paylaşılan
tema/auth/onboarding) 30 bulgu tespit edildi; bunların çoğu yukarıdaki tabloya
yansıtıldı. En sık tekrarlanan kalıp: **`AppColors.bgCard`/`textDark` gibi tema-duyarlı
renkler `home_screen.dart` ve `profile_screen.dart`'ta doğru kullanılırken, arama/dükkan
detayı/rezervasyon/checkout ve TÜM esnaf ekranlarında sabit `Colors.white` yazılmış** —
yani koyu mod desteği yarım bırakılmış, tam bir tasarım sistemi ihlali değil ama
tutarsız uygulama. Düzeltme mekanik ama geniş kapsamlı (65+ konum) olduğu için ayrı,
odaklı bir çalışma turu gerektiriyor.

## 4. Mobilin Web'den İleride Olduğu Noktalar

- **İzin yönetimi ekranı**: kamera/konum/bildirim canlı durumu + ayarlara yönlendirme +
  otomatik yenileme; web'in basit push opt-in akışından daha kapsamlı.
- **Offline check-in/check-out kuyruğu** (`SyncService`, Hive tabanlı, bağlantı geri
  geldiğinde otomatik tekrar deneme) — web'de karşılığı yok, esnafın sahada bağlantı
  sorununda kesintisiz çalışmasını sağlıyor.
- **Check-in sonrası gerçek mühür numaralarının listelenmesi** rezervasyon detayında —
  web'de bu somut güven unsuru yok (bkz. Bölüm 2 #31 ile birlikte düşünülmeli: numara
  var ama fotoğraf yok).
- **Bildirim merkezi arayüzü** var (ama Bölüm 1 #5 nedeniyle şu an fiilen boş).

## 5. Yöntem

Önceki dokümandaki her "GAP" satırı, Explore agent'larıyla ilgili dosyalar
gerçekten okunarak yeniden doğrulandı (tahmin yok). Ayrıca web ve mobil kodun her
ikisi de bağımsız bir tasarım denetiminden geçirildi. Doğrulanan ama artık geçersiz
çıkan (parity olmuş) satırlar bu dokümandan tamamen çıkarıldı — önceki sürümde
olduğu gibi "[DÜZELTİLDİ]" etiketiyle biriktirilmedi, çünkü doküman zamanla
okunamaz hale geliyordu.
