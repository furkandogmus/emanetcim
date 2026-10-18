# Tasks

## 1. Sunucu

- [ ] 1.1 `auth/google`: `allowed` boşsa `503 google_not_configured`, token doğrulanmaz; doğrulama: yeni test (boş liste 503, `jwtVerify` çağrılmaz)

## 2. Expo

- [ ] 2.1 `npx expo install @react-native-google-signin/google-signin`, `app.json` plugin, `eas.json` profillerine `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`; doğrulama: `npx expo-doctor` uyumlu
- [ ] 2.2 `auth.tsx`: `signInWithGoogle` (hesap seçici → `auth/google` → aynı oturum yolu; vazgeçme sessiz); doğrulama: typecheck
- [ ] 2.3 `login.tsx`: "Google ile devam et" düğmesi (Android, kimlik tanımlıysa), hata kodları tr/en; doğrulama: `npm run verify`
- [ ] 2.4 Development build + emülatörde (Google hesabı olan) gerçek giriş, yerel API; doğrulama: ana ekrana geçiş
