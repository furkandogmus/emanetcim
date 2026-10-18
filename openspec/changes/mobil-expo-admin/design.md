## Context

Mobil admin uçları (`src/app/api/mobile/admin/**`) Flutter için yazılmış; web admin
action'ları (`src/actions/admin-management.ts`) sonradan denetim kaydı ve hata ayrımı kazandı,
mobil uçlar kazanmadı. Kural: aynı iş kuralı iki taşıyıcıda ayrı yazılmaz.

## Goals / Non-Goals

**Goals:** Mobilde başvuru onay/red ve mesaj yönetimi; web ile aynı denetim izi.

**Non-Goals:** Kullanıcı yönetimi, rezervasyon yönetimi, kupon, ayarlar, mesaja cevap
(Resend) — web'de kalır. Flutter'ın admin ekranlarından fazlası yok.

## Decisions

- **Denetim kaydı servise mi, uca mı?** Web'de action'da (`writeAuditLog`). En küçük doğru
  adım: onay/red gövdesini (servis çağrısı + denetim kaydı) tek bir fonksiyona alıp web
  action'ı ve mobil uç ikisinden çağırmak; aktör ve IP taşıyıcıdan gelir.
- **Hata kodları:** `not_found` 404, `missing_coordinates` 409, `has_active_bookings` 409,
  `invalid_action` 400. İstemci `admin.errors.*` ile çevirir.
- **Expo yönlendirme:** `_layout.tsx`'teki `Stack.Protected` kapısına `role === "ADMIN"` →
  `(admin)` grubu; şu an ADMIN `(guest)`a düşüyor.
- **Reddet onayı:** `Alert` yıkıcı stil; metin "Dükkan ve bilgileri silinir, geri alınamaz".

## Risks / Trade-offs

- Prod'da denemek gerçek esnaf başvurusunu onaylayabilir/silebilir. Doğrulama yalnızca test
  hesabına ait, önceden oluşturulmuş bir başvuruyla yapılır; başka satıra dokunulmaz.
