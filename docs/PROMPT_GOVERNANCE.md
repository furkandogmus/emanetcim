# Prompt governance (AI-assisted development)

Bu repo’da Cursor/ChatGPT vb. ile üretilen değişikliklerin tekrarlanabilir ve güvenli olması için minimum standartlar.

## Definition of Done (her PR)

- [ ] `npm run test` geçer
- [ ] `npm run build` geçer
- [ ] `npm run lint` (varsa uyarılar gerekçelendirilir)
- [ ] Finans/ödeme dokunulduysa: server-side fiyat doğrulaması ve webhook imzası davranışı gözden geçirildi
- [ ] Migration varsa: `prisma migrate` ile uyumlu SQL ve geri alma notu
- [ ] Risk notu: rollback adımı veya feature flag stratejisi (kısa)

## Prompt şablonları

### Yeni özellik

```
Bağlam: Next.js 16 App Router, Prisma 7, Auth.js, iyzico marketplace.
Hedef: [tek cümle]
Kısıtlar: [auth, locale, mobil]
Dosyalar: [tahmini path]
Çıktı: TypeScript, mevcut pattern’lere uyum, test önerisi.
```

### Güvenlik sertleştirme

```
Bağlam: [endpoint / action]
Tehdit modeli: [ör. fiyat manipülasyonu, replay]
İstenen: [davranış]
Kanıt: [unit test veya manuel adım]
```

### Migration

```
Şema değişikliği: [alanlar]
Veri backfill: [var/yok]
Downtime: [kabul / sıfır]
Rollback: [SQL veya migrate down notu]
```

### Test üretimi

```
Kapsam: [service / e2e]
Mutlak senaryolar: [başarı, hata, edge]
Mock: [Prisma / fetch]
```

## AI ile üretilen kod için PR checklist

PR açıklamasında şunları doldurun:

1. **AI kullanıldı mı?** (Evet/Hayır; hangi araç)
2. **İnsan tarafından doğrulananlar:** [liste]
3. **Bilinen riskler / TODO:** [liste]

Şablon: [.github/pull_request_template.md](../.github/pull_request_template.md)
