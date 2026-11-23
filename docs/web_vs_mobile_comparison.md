# BagajPark Web ↔ Mobil Karşılaştırma

**Son durum (2026-11-23):** mobil uygulama Expo / React Native (`mobile-expo/`).
Misafir, esnaf ve yönetici akışlarının çekirdeği native; uçlar `/api/mobile/*` altında
ve web ile aynı servisleri çağırıyor. Bu belge yalnızca **bugün kalan farkları** tutar.
Ekran ekran iş listesi ve her maddenin doğrulama tarihi `mobile-expo/migration-progress.md`'dedir;
yeni bir ekran ya da fark orada işaretlenir, burası özetidir.

Eski Flutter uygulamasına ait karşılaştırmalar (2026-09-09 ve 2026-09-11) arşivde:
`docs/archive/2026-09-11-rakip-ve-parity/`.

## Mobilde native olanlar

| Alan | Ekranlar (`mobile-expo/src/app/`) |
|---|---|
| Misafir | ana sayfa, arama (şehir → ilçe adımı), harita, dükkan detayı, checkout → başarı, rezervasyonlarım, rezervasyon detayı + iptal + değiştir, değerlendirme, itiraz/hasar bildirimi, profil ve profil düzenleme, şifre sıfırlama (e-postadaki kodla), internetsiz açılan QR bileti |
| Esnaf | bugünkü liste ve tüm tarihlerde sunucu araması, QR okutma, teslim al / teslim et, valiz düzeltmesi, gelmedi / kapat, "Misafiri bekle (+30 dk)", mühür talebi ve arızalı bildirimi, dükkanım (vitrin fotoğrafı), çalışma takvimi, ayarlar, kazanç, davet kodu |
| Yönetici | pano, başvurular, mesajlar, rezervasyon yönetimi, duyuru gönder, kullanıcılar + denetim kaydı + inceleme hesabı anahtarı, dükkanlar (fotoğraf, çalışma saati), yorum moderasyonu, itirazlar, kuponlar, ödemeler, platform ayarları (mağaza yayın bayrakları dahil), özellik bayrakları |
| Giriş | e-posta + şifre, OTP, Google (Android), Apple (iOS) |
| Bildirim | Android FCM, iOS Expo push + APNs |

## Bugün yalnızca web'de olanlar

| Alan | Web yüzeyi | Mobilde |
|---|---|---|
| Google ile giriş (iOS) | — | iOS OAuth istemcisi bekliyor; düğme iOS'ta gizli |
| Mühür kanıt fotoğrafı | esnaf check-in'i (`SealService.uploadSealPhoto`) | mobil check-in ucu fotoğraf almıyor; bkz. `docs/DEFECT_BACKLOG.md` B3 / C4 |
| KVKK veri dışa aktarma ve hesap gizliliği | `/[locale]/account/privacy`, `/api/account/data-export` | yok. Misafir hesabını uygulamadan siler; esnaf ve yönetici için "silme talebi" web iletişim sayfasını açar |
| SSS, iletişim, kullanım şartları, gizlilik | statik sayfalar | profilden web sayfası olarak açılır (`ProfileView`) |
| Yazdırılabilir QR afişi | `/[locale]/partner/poster` | yok (yazdırma işi) |
| Yönetici: mühür envanteri, esnaf listesi | `/[locale]/admin/seals`, `/admin/partners` | panodaki "Web paneli" bağlantısıyla web'de açılır |
| Yönetici: analitik, blog, kampanyalar, sorunlar, işler, bildirimler, esnaf adayları, ön kayıt, rol onayları, durum | `/[locale]/admin/*` | yok |

Açık PR'lar birleşince bu tablo değişir: aracı (affiliate) programı (#207) ve esnaf ön
kaydını dükkana çevirme + onayda slot üretimi (#208). İkisi de henüz `main`'de değil.

## Bilinçli farklar

- Uygulama yalnızca açık tema kullanır (`app.json` → `userInterfaceStyle: "light"`).
- Ödeme dükkanda alınır; mağaza içi satın alma yok (fiziksel hizmet).
