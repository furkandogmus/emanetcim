# BagajPark v2.0 roadmap (özet)

Bu belge ürün vizyonunu sprintlere bölen çalışma çizelgesidir; uygulama durumu için `docs/IMPLEMENTATION_MATRIX.md` kaynak kabul edilir.

## Sprint 0 — tamamlanan temel

- Ödeme: iyzico birincil akış, onay sonrası ödeme, webhook / idempotency sertleştirmesi.
- Güvenlik: rate limit, audit log, demo / OAuth güvenliği.
- Bildirimler, mühür / bagaj revizyonu, marka ve PWA dokunuşları.

## Sprint 1 — güven ve operasyon

1. **DB feature flags** (`FeatureFlag` modeli, admin ekranı, `payments_enabled` + env `PAYMENTS_ENABLED=false` kill switch).
2. **BookingEvent** (append-only olay günlüğü; şeffaflık ve destek).
3. **Trust badges** (doğrulanmış dükkan, yanıt süresi — hesaplanabilir metrikler).

## Sprint 2 — bildirim ve zamanlama

4. **ScheduledNotification** kuyruğu (hatırlatma, SLA uyarıları).
5. Push / e-posta şablonları ve tercih merkezi (mevcut NotificationService üzerine).
6. Partner “sessiz saat” ve mesaj eşiği.

## Sprint 3 — partner deneyimi

7. Partner dashboard 2.0 (gelir, doluluk, kampanya özeti).
8. Toplu fiyat / kapasite düzenleme (guardrails ile).
9. Partner içi yardım / SSS.

## Sprint 4 — erişilebilirlik ve kalite

10. WCAG 2.1 AA odaklı denetim ve düzeltmeler.
11. Klavye ve ekran okuyucu akışları (rezervasyon, ödeme, partner paneli).
12. Performans bütçesi (LCP, TTI hedefleri).

## Sprint 5 — sadakat ve büyüme

13. Misafir sadakat puanı veya indirim kredisi (policy ile).
14. Referans / arkadaşını getir (KVKK uyumlu).
15. Kampanya motoru genişlemesi (segmentasyon).

## Sprint 6 — para birimi ve uluslararasılaşma

16. Çok para birimi gösterimi ve kur kaynağı.
17. Bölgesel vergi / fiyat kuralları (isteğe bağlı).
18. Yerelleştirme borçlarının kapatılması.

## Çapraz konular

19. Gözlemlenebilirlik: yapılandırılmış loglar, metrikler, alarm eşikleri.
20. Yedekleme ve felaket kurtarma runbook’u.
21. Yasal / sözleşme sürümleme ve kullanıcı onayı izi (mevcut legal acceptance ile hizalı).

---

**Not:** Yeni özellikler mümkün olduğunca `FeatureFlag` ile kademeli açılmalıdır; ödeme için `payments_enabled` ve ortam değişkeni kill switch birlikte kullanılır.
