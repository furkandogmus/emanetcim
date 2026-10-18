## Context

Expo uygulaması `/api/mobile/*` istemcisidir; iş kuralları `src/services/`'te, web
action'ları ve mobil uçlar aynı servisi çağırır. Web ile karşılaştırma
`expo-web-to-native` skill'iyle yapıldı; iş listesi `mobile-expo/migration-progress.md`.

## Goals / Non-Goals

**Goals:** Play'e çıkan sürümün davranışını sözleşmeye bağlamak; web ile aynı veri, aynı
davranış, aynı hata kodları.

**Non-Goals:** Admin ekranları (`mobil-expo-admin`), QR okutma, push bildirimi, Google/Apple
girişi, rezervasyon değiştirme, değerlendirme yazma, itiraz.

## Decisions

- **DOM kabuğu yok.** Skill'in 3. adımı web sayfalarını `'use dom'` ile sarmayı önerir; web
  sayfaları Prisma okuyan async Server Component olduğu için çalışmaz. Ekranlar native.
- **Sabit +03:00, Intl `timeZone` değil.** Türkiye 2016'dan beri yaz saati uygulamıyor ve
  rezervasyon alan bütün noktalar Türkiye'de. Hermes'in Intl saat dilimi desteğine
  güvenmek yerine an kaydırılıp `timeZone: "UTC"` ile biçimlenir (`lib/time.ts`).
  Başka saat diliminde dükkan rezervasyona açılırsa `Shop.timezone` DTO'ya eklenip
  yardımcılar dükkan saatini alacak şekilde genişletilir.
- **Mühür isteğe bağlı, kural sunucuda.** İstemci yalnızca "hepsi ya da hiçbiri"
  tutarlılığını zorlar; `requireSealsOnCheckIn` istemciye gelmez, `SEAL_REQUIRED` çevrilir.
- **Rezervasyon kodu = kimliğin ilk 8 hanesi.** Web ile aynı; ayrı alan yok.

## Risks / Trade-offs

- **Test dükkanı kamuya açıktı.** `Kadıköy Valiz Emanet` test hesabına aitti ama
  `isTest=false` ve "Doğrulanmış"tı; gerçek misafirler rezervasyon yaptı. 2026-10-18'de
  `isTest=true` yapıldı, rozet kaldırıldı. `isTest` dükkan rezerve edilemediği için
  uçtan uca prod testi artık mevcut rezervasyonlarla sınırlı → test kullanıcılarının
  test dükkanlarını görebilmesi ayrı bir karar.
- **Test hesabı şifreleri public repodaydı** (`mobile/maestro`), `maestro-admin` ADMIN.
  Şifreler değişti, akışlar ortam değişkeni okuyor (PR #56).
