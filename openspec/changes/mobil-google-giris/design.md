## Context

Sunucu ucu hazır (`{ idToken }` → `accessToken`, `refreshToken`, `user`). Web istemci
kimliği ile Firebase Android OAuth istemcisi aynı projede (`1034885764385`); Android'de
yerel imzalı uygulama `webClientId` ile token istediğinde token'ın `aud` alanı web
kimliği olur ve sunucu `GOOGLE_CLIENT_ID` ile eşleştirir.

## Decisions

- **`@react-native-google-signin/google-signin` (ücretsiz "original" API)** — Expo'nun
  önerdiği yerel kütüphane; config plugin `google-services.json`'dan yapılandırılır.
  Alternatif `expo-auth-session` tarayıcı yönlendirmesiyle çalışır, yerel hesap seçici
  ve Android imza doğrulaması yok; reddedildi.
- **Web istemci kimliği `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`** — gizli değil (sitenin giriş
  yönlendirmesinde açık); `eas.json` profillerinde. Kodda sabit yazılmaz; tanımsızsa
  düğme gizlenir, böylece yapılandırmasız build kırık düğme göstermez.
- **Sunucu sertleştirmesi aynı değişiklikte** — boş `allowed` listesiyle `audience`
  kontrolünün kapanması, yeni istemcinin trafik getireceği uçta kapatılır.

## Risks / Trade-offs

- [SHA-1 eşleşmezse `DEVELOPER_ERROR`] → Play imzalama, yükleme ve debug SHA-1'leri
  Firebase'e eklendi; hata kodu kullanıcıya genel mesaj, loga ayrıntı.
- [Native modül] → emülatör için yeni development build; Play için yeni sürüm (15).
