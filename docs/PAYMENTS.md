# Ödeme Mimarisi

## Son durum — 2026-08-22

**Aktif sağlayıcı: `manual` (dükkanda tahsilat).** Online kart tahsilatı yok; misafir
ödemeyi bagajını bıraktığı dükkanda nakit veya esnafın kendi POS'uyla yapar.

Bu bir eksiklik değil, lansman için **bilinçli bir karar**: şahıs şirketi kurulup PSP
sözleşmesi tamamlanana kadar sistemin para almış gibi davranması yasak. Maliyet tarafı
da bunu destekliyor — PSP komisyonu (~%2,5 + işlem ücreti) ve entegrasyon/uyum işi
lansmanda sıfır.

| Bileşen | Durum | Nerede |
|---|---|---|
| `PaymentProvider` port'u | ✅ uygulandı | `src/lib/payments/types.ts` |
| `ManualPaymentProvider` | ✅ uygulandı | `src/lib/payments/manual.ts` |
| Sağlayıcı çözümleyici | ✅ uygulandı | `src/lib/payments/index.ts` |
| `PaymentService` (defterin tek yazıcısı) | ✅ uygulandı | `src/services/PaymentService.ts` |
| Şema: `PENDING` varsayılanı + denetim alanları | ✅ uygulandı | `prisma/schema.prisma` |
| Sunucu tarafı metinlerin yeteneğe bağlanması | ✅ uygulandı | `src/lib/payment-copy.ts`, FAQ sayfası |
| İstemci bileşenlerinde aynı bağlama | ❌ yapılmadı | `BookingModifyModal` vb. hâlâ koşulsuz kartlı metin |
| Iyzico / PayTR adaptörü | ❌ yapılmadı | şirket kurulumunu bekliyor |
| Marketplace split (esnaf payının sağlayıcıda ayrılması) | ❌ yapılmadı | `capabilities.supportsSplit` false |

### Değişmeyen şeyler

- Prod'daki eski `PaymentLog` satırlarına dokunulmadı. `provider='legacy_unverified'`
  olarak damgalandılar; karşılığı olmayan 3.480 TRY'lik defter ayrı bir soruşturmanın
  konusu (`docs/DEFECT_BACKLOG.md` → P1-5).
- `PLATFORM_COMMISSION_RATE` ile hesaplanan esnaf payı mantığı aynı
  (`src/lib/platform-split.ts`). Şu an tahsilat esnafın elinde olduğu için platform
  komisyonu **esnaftan tahsil edilecek bir alacaktır**, sağlayıcıda kesilmez.

---

## Nasıl çalışıyor

```
Rezervasyon                PaymentService              PaymentProvider
    |                            |                          |
    |--- openIntent ------------>|                          |
    |                            |--- createIntent -------->|
    |                       PaymentLog(PENDING)             |
    |                            |                          |
    |--- markCaptured ---------->|                          |
    |                            |--- capture ------------->|
    |              [TEK TRANSACTION]                        |
    |         PaymentLog(SUCCESS) + Booking(PAID)           |
    |                            |                          |
    |--- refund ---------------->|                          |
    |                            |--- refund -------------->|
    |            PaymentLog(PARTIALLY_REFUNDED | REFUNDED)   |
```

### Üç kural

1. **`PaymentLog`'un tek yazıcısı `PaymentService`'tir.** Ham `prisma.paymentLog.update`
   yazmayın — durum geçişleri orada doğrulanıyor ve her geçiş `BookingEvent`'e denetim
   izi bırakıyor.
2. **Durum geçişleri tablodan gelir** (`ALLOWED_TRANSITIONS`). `REFUNDED` bir ödeme
   tekrar `SUCCESS` yapılamaz; `SUCCESS` bir ödeme `CANCELLED` ile silinemez, iade
   gerekir.
3. **Sağlayıcıya giden tutarlar kuruştur** (tamsayı). Float yuvarlama hatası tam olarak
   para kaybettiren yerdir.

### Durum anlamları

| Durum | Anlamı |
|---|---|
| `PENDING` | Niyet açıldı, para alınmadı. **Varsayılan.** |
| `AUTHORIZED` | Kart provizyonu alındı, tahsil edilmedi (3DS auth-capture). |
| `SUCCESS` | Para tahsil edildi. |
| `FAILED` | Sağlayıcı reddetti. Rezervasyon **ödenmemiş** sayılır. |
| `PARTIALLY_REFUNDED` | Bir kısmı iade edildi; `refundedAmount` ne kadarını söyler. |
| `REFUNDED` | Tamamı iade edildi. |
| `CANCELLED` | Tahsilat yapılmadan niyet kapatıldı. |

---

## Yeni sağlayıcı ekleme

Çağıran hiçbir kod değişmez. Üç adım:

1. `src/lib/payments/<saglayici>.ts` içinde `PaymentProvider` uygula.
2. `src/lib/payments/index.ts` içindeki `REGISTRY`'ye ekle.
3. `PAYMENT_PROVIDER=<saglayici>` ortam değişkenini ver.

`capabilities.capturesOnline` true olduğu anda kamuya açık metinler kartlı sürüme
**kendiliğinden** döner (`src/lib/payment-copy.ts`) — çeviri dosyalarında elle iş yok.

Bilinmeyen bir `PAYMENT_PROVIDER` değerinde sistem sessizce `manual`'a **düşmez**, atar.
Sebep: yanlış varsayılan, bu projeyi bu hale getiren hata sınıfının ta kendisi.

### Adaptör yazarken dikkat

- **Webhook zorunlu.** `capture` çağrısının dönmesi paranın geldiği anlamına gelmez;
  gerçek doğrulama sağlayıcının webhook'udur. Webhook ucu imzayı doğrulamadan
  `markCaptured` çağırmamalı.
- **`idempotencyKey`'i sağlayıcıya ilet.** Defterde `@unique`, ama ağ tarafında da
  çift çekimi engelleyen şey odur.
- **Split'i destekliyorsa `supportsSplit: true` yap** ve komisyonu sağlayıcıda ayır;
  esnaftan alacak takibi ortadan kalkar.

---

## Geçmiş ve gerekçe

### 2026-08-22 — mimari değişiklik (P0-0)

Denetimde bulunan kök neden: **hiçbir ödeme sağlayıcısı entegre değilken sistem para
almış gibi davranıyordu.**

- `PaymentLog.status` şemada `@default(SUCCESS)` idi. Yani atılan her satır, hiçbir kart
  çekilmeden "başarılı ödeme" anlamına geliyordu. Prod'da 12 satır, toplam 3.480 TRY,
  karşılığında tahsil edilmiş **hiç para yok**.
- `BookingService.markAsPaid` rezervasyonu doğrudan `PAID` yazıyor, **hiç defter satırı
  üretmiyordu**. Prod'da 7 tane "ödenmiş ama ödeme kaydı olmayan" rezervasyon (P1-9).
- İptal akışı ham `prisma.paymentLog.updateMany` ile `REFUNDED` yazıyordu: kısmi iadeyi
  modelleyemiyor, `refundedAmount` tutmuyor, denetim izi bırakmıyordu.
- Kamuya açık sayfalar ve JSON-LD "kartla online ödeme alınır, nakit kabul edilmez" ve
  "tamamı kartınıza iade edilir" diyordu.

Bunların hepsi tek bir hatanın belirtisiydi: **para durumunun sahibi yoktu.** Üç ayrı
yer, üç ayrı kuralla yazıyordu ve varsayılan iyimserdi.

Yapılan değişiklik, hatayı düzeltmek yerine **tekrar edilmesini imkânsız kılmayı**
hedefledi:

- Varsayılan `PENDING` — iyimser değil, ihtiyatlı.
- Tek yazıcı + geçiş tablosu — "SUCCESS iken tekrar SUCCESS" gibi sessiz hatalar test
  edilebilir bir kuralla engelleniyor.
- Tahsilat ve rezervasyon durumu tek transaction — "ödemesiz PAID" üretilemez.
- Metin, kodun yeteneğinden türüyor — yalan söylemek için ayrı efor gerekir.

**Denenmedi / bilerek yapılmadı:** prod'daki 12 sahte `SUCCESS` satırı migrasyonla
düzeltilmedi. Migrasyonun sessizce veri düzeltmesi yapması denetim izini bozardı ve
bu satırların kaynağı hâlâ bilinmiyor (P1-5: prod'a rezervasyon yazabilen bir yol açık
olabilir). Önce kaynak bulunmalı.
