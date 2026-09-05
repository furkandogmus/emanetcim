---
name: mobil-paket
description: Flutter pubspec bağımlılığını güvenle yükselt veya değiştir — tek paket, changelog okuma, breaking change taraması, kapı, ayrı commit. Paket modernizasyonu ve ölü paket (hive, jailbreak fork) değişiminde kullan.
---

# Paket yükseltme (tek paket, tek tur)

Kural: bir turda BİR paket. Yükseltmeyi başka bir işin içine gömme. `pubspec.lock`
diff'i sadece o paketi ve onun geçişli bağımlılıklarını göstermeli.

1. Durum: `flutter pub outdated` → hedef paketin "Latest" ve "Resolvable" sütunları.
   Resolvable < Latest ise önce neyin tuttuğunu bul (`flutter pub deps | grep <paket>`),
   Flutter SDK pinliyorsa (örn. `intl` ↔ `flutter_localizations`) dokunma, raporla.
2. Changelog oku: Context7 MCP'den ya da pub.dev `/changelog` sayfasından **major**
   geçişteki breaking change'leri listele. Tahminle geçiş yapma.
3. `pubspec.yaml`'da sürümü değiştir (projede sabit sürüm kullanılıyor, `^` ekleme),
   `flutter pub get`, gerekiyorsa `dart run build_runner build --delete-conflicting-outputs`.
4. Kullanım yerlerini tara: `grep -rn "package:<paket>" lib test` → her import'u breaking
   listesine karşı gözden geçir.
5. Kapı: `/mobil-dogrula`. Native eklenti değiştiyse (`android/`, `ios/` dokunan paket)
   gerçek cihazda kur ve o özelliği dene (`/mobil-cihaz`); iOS'a özgü değişiklikte
   CI'da iOS job'ını elle tetiklemeyi kullanıcıya hatırlat.
6. Commit: `chore(mobil-deps): <paket> X -> Y` + gövdede breaking change ve nasıl uyarlandığı
   (`/commit`).

## Ölü / riskli paketler (karar kullanıcıya sorulur, önce plan yaz)

- `hive` / `hive_flutter` (2022'den beri yayın yok) → `hive_ce` geçiş planı: hangi kutular,
  veri taşıma gerekiyor mu, adaptörler.
- `flutter_jailbreak_detection` rastgele GitHub fork'una bağlı → bakımlı alternatif
  (`safe_device`, `freerasp`) karşılaştırması.
Plan yazılır, uygulamadan önce kullanıcı onayı alınır.
