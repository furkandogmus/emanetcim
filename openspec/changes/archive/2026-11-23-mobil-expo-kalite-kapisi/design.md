## Context

Expo SDK 57; `expo lint` yapılandırma dosyası yokken hiçbir dosyayı taramıyor. Test
çalıştırıcı yok. CI (`mobile-expo-ci.yml`) zorunlu kontrol değil, yol filtreli ve
`npm run verify` çağırıyor.

## Goals / Non-Goals

**Goals:** lint ve birim test kapıda; oturum/hata/fiyat mantığı testli.

**Non-Goals:** bileşen/ekran testleri (uçtan uca akış emülatörde argent/Maestro ile
doğrulanır); `verify`'ı main'de zorunlu kontrol yapmak.

## Decisions

- **`eslint-config-expo` (flat config)** — Expo'nun resmi önerisi, `npx expo lint`
  ile uyumlu. Alternatif: kökteki Next ESLint yapılandırmasını genişletmek; RN
  globallerini ve Metro çözümlemesini bilmediği için reddedildi.
- **`jest-expo` preset** — Expo modüllerinin (SecureStore, localization) mock'ları
  hazır. Alternatif Vitest (kökte kullanılıyor) RN/Expo dönüşümünü desteklemiyor.
- **Testler saf modül sınırında**: `api.ts` için `fetch` ve `expo-secure-store`
  mock'lanır; ağ yok. Ekran testi yazılmaz.
- **`verify` tek komut kalır**: CI dosyası komut değiştirmeden genişler; yerelde de
  aynı kapı.

## Risks / Trade-offs

- [Lint ilk açılışta çok hata verir] → gerçek hatalar ayrı commit'lerle düzeltilir;
  kural kapatmak yerine düzeltme tercih edilir, kapatılan kural gerekçesiyle yazılır.
- [`api.ts` modül düzeyinde durum tutuyor] → her testte `jest.isolateModules` ile
  taze modül yüklenir.
