# Tasks

## 1. Sunucu

- [x] 1.1 `ContactReplyService.replyToContactMessage`; web action onu çağırır (`ContactReply.test.ts` yeşil)
- [x] 1.2 `POST /api/mobile/admin/messages/[id]/reply` + `mobile-admin-message-reply.test.ts`
- [x] 1.3 `service-layer-writes` tavanı: `contactReply` çıktı, `contactMessage` 9 → 8

## 2. Expo

- [x] 2.1 `AdminMessageReply` bileşeni: etiketli çok satırlı alan, alıcı ipucu, hata bandı, gönder düğmesi
- [x] 2.2 tr/en çeviriler ve `admin.errors.*` kodları; `npm run verify`
- [x] 2.3 Emülatörde yerel API ile: mesajı aç, cevap yaz, gönder (yerelde Resend yok → çevrilmiş `email_send_failed` hatası, metin korunur)
