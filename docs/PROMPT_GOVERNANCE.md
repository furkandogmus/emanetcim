# Prompt governance (AI-assisted development)

Bu repo’da yapay zekâ araçlarıyla (Claude Code, Cursor vb.) üretilen değişikliklerin tekrarlanabilir ve güvenli olması için minimum standartlar.

## Definition of Done (her PR)

- [ ] `npm run typecheck && npm run lint && npm test` geçer (üçü birden; CI aynı kapıları ve e2e'yi koşar, `docs/CI_CD.md`)
- [ ] Mobil dokunulduysa `cd mobile-expo && npm run verify`
- [ ] Mandal (ratchet) testlerinin tavanı yükselmedi (`CLAUDE.md` § Mandal testleri)
- [ ] Ödeme dokunulduysa: yazım yalnız `PaymentService` üzerinden, sunucu tarafı fiyat doğrulaması (`docs/PAYMENTS.md`)
- [ ] Migration varsa: `npm run db:verify` (migrasyon ↔ şema) ve geri alma notu
- [ ] Risk notu: rollback adımı veya feature flag stratejisi (kısa)
- [ ] Davranış değiştiyse ilgili belge aynı PR'da güncellendi

Commit ve PR süreci: `docs/GIT_COMMIT_GUIDE.md`. Ajan kuralları: kök `CLAUDE.md`, `mobile-expo/CLAUDE.md`.

## Prompt şablonları

### Yeni özellik

```
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
