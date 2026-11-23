## Özet

<!-- Ne değişti? Neden? -->

## Tür

- [ ] Bugfix
- [ ] Özellik
- [ ] Refactor
- [ ] Dokümantasyon
- [ ] Güvenlik / finans

## AI-assisted changes

- [ ] Bu PR’da AI (Cursor, ChatGPT, vb.) ile kod üretildi veya önemli ölçüde düzenlendi
- [ ] AI kullanılmadı

**İnsan doğrulaması (AI kullanıldıysa zorunlu):**

- [ ] `npm run typecheck && npm run lint && npm test` (mobil değiştiyse `cd mobile-expo && npm run verify`) yerelde veya CI’da geçti
- [ ] Finans/ödeme/webhook: server doğrulaması ve imza davranışı kontrol edildi
- [ ] Migration: SQL ve geri alma notu gözden geçirildi

## Risk ve rollback

**Risk:** <!-- düşük/orta/yüksek + kısa gerekçe -->

**Rollback:** <!-- örn. önceki migrate, env geri alma, revert commit -->

## Checklist

- [ ] Yeni env anahtarı varsa: `docker-compose.env.example`, `docker-compose.yml` → `web.environment` ve SSM (`ops/SECRETS.md`); zorunluysa `ops/secrets.manifest`
- [ ] Yeni zamanlanmış iş varsa: `src/lib/jobs/registry.ts` + `ops/crontab.prod` (`scripts/README.md`)
- [ ] Dokümantasyon güncellendi (davranış değiştiyse)
