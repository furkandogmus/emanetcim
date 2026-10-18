# Tasks

## 1. Lint

- [ ] 1.1 `npx expo install eslint eslint-config-expo` + `eslint.config.js`; doğrulama: `npx expo lint` dosyaları tarar, "ignored" uyarısı yok
- [ ] 1.2 Lint'in bulduğu hataları düzelt (davranış değişmeden); doğrulama: `npx expo lint` 0 hata, `npm run typecheck` yeşil

## 2. Test altyapısı

- [ ] 2.1 `npx expo install jest-expo jest @types/jest`, `package.json` `test` betiği ve jest preset; doğrulama: `npm test` çalışır
- [ ] 2.2 `api.ts` testleri: eşzamanlı iki 401 → tek refresh, refresh reddi → token silinir + handler bir kez + `session_expired`, ağ hatası → `network`; doğrulama: `npm test` yeşil
- [ ] 2.3 `errorMessage` testleri (bilinen kod, bilinmeyen kod, ağ, ham Error); doğrulama: `npm test`
- [ ] 2.4 `pricing.estimate` testleri (sıfır valiz, valiz/gün monotonluğu); doğrulama: `npm test`

## 3. Kapı

- [ ] 3.1 `verify` = typecheck + lint + test + check:locales; `mobile-expo-ci.yml` iş adını güncelle; doğrulama: `npm run verify` yeşil, kasıtlı kırık testle kırmızı
- [ ] 3.2 `mobile-expo/CLAUDE.md` komutlar bölümüne `npm run verify` ve `npm test`; doğrulama: dosyada görünür
