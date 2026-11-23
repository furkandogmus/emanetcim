## Why

Mobil admin mesaj ekranı mesajları okuyup silebiliyordu ama cevap veremiyordu; ekranın altında
"cevap web panelinden verilir" yazıyordu. Destek mesajına telefondan dönmek için admin bilgisayara
geçmek zorundaydı. Cevap gövdesi yalnızca web action'ındaydı (`replyToContactMessageAction`).

## What Changes

- Cevap gövdesi `src/services/ContactReplyService.ts`'e taşınır; web action ve mobil uç onu çağırır.
- Yeni uç `POST /api/mobile/admin/messages/[id]/reply` (yalnızca ADMIN).
- Expo admin mesaj ekranında açılan mesajın altında cevap kutusu; "web'den cevap" notu kalkar.

## Capabilities

### New Capabilities
- `mobile-admin-messages`: mobil admin destek mesajına e-postayla cevap verir.

## Impact

- `src/actions/contact.ts`, `src/services/ContactReplyService.ts`, yeni mobil uç.
- `mobile-expo/src/app/(admin)/admin/messages.tsx`, `AdminMessageReply.tsx`, tr/en çeviriler.
- `service-layer-writes` tavanı düşer (contactReply servis dışında yazılmıyor).
