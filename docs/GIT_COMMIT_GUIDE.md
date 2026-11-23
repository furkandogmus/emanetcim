# Git: dallar, commit mesajları, PR ve sürüm

Bu dosya dal modelini, commit kuralını, PR sürecini ve sürüm etiketini tek yerde
toplar (2026-11-23'te `BRANCHING.md` ve `VERSIONING.md` buraya katıldı).

## Değişiklik süreci (2026-09-23'ten beri)

Gerçek kullanıcılar geldiği için `main` **yalnızca PR ile** değişir. `main`'e doğrudan
push kapalı (GitHub ruleset `main-korumasi`); `main` = prod, çünkü her merge deploy eder.

1. **Dal aç, tek konu.** `main`'den `feat/…`, `fix/…`, `docs/…`, `ci/…`, `chore/…`. Bir
   dal bir iş: "fiyat düzeltmesi + yeni özellik + belge" üç ayrı PR'dır. `develop` dalı
   2026-08-22'den beri kullanılmıyor; PR'lar doğrudan `main`'e açılır.
2. **Dalın içinde küçük commit'ler.** Her commit tek bir mantıksal değişiklik, kendi
   başına derlenir ve testleri geçer. "Bir sürü değişiklik tek commit" yok.
3. **Commit başlığı:** Conventional Commits, küçük harf tip, ASCII, ≤ 100 karakter
   (`.github/workflows/pr-gate.yml` denetler). Gövdede **neden** — hangi veri / hangi hata.
4. **PR aç** (`gh pr create`). Şablonu doldur. Zorunlu kontroller (ruleset):
   `Dogrula (lint, tip, test, e2e)` ve `PR kurallari`. Uygulamaya dokunmayan PR'da
   doğrulama job'ları koşulla atlanır ve toplayıcı yeşil döner (`docs/CI_CD.md`).
5. **Birleştirme yalnızca "Rebase and merge".** Ruleset başka yöntemi kabul etmez ve
   doğrusal geçmiş ister: küçük commit'ler `main`'e olduğu gibi iner. Dal birleşince silinir.
6. **Merge = deploy.** Birleştirdikten sonra `CI` workflow'unun `Deploy` job'ını izle
   (`gh run watch`).
7. **Acil durum.** Admin, kontrolü kırmızı bir PR'ı bile birleştirebilir (ruleset
   bypass, yalnızca PR üzerinden). Doğrudan push yine yok. Bypass kullanıldıysa PR'a
   nedenini yaz. Ayrı bir `hotfix/` akışı yok: acil düzeltme de `main`'den açılan bir
   daldır.

Migrasyonlar: aynı PR'da hem şemayı daraltan hem kodu değiştiren bir değişiklik
yapılmaz. Önce geriye uyumlu genişlet (yeni kolon/tablo), kod ikisiyle de çalışsın;
eski yapıyı kaldırma ayrı ve sonraki PR'dır. Deploy sırasında eski imaj yeni şemayla
birkaç dakika çalışır.

Paylaşılan dalda (`main`) geçmiş yeniden yazılmaz; ruleset force-push'u zaten reddeder.
Kendi dalında `rebase` serbesttir, push için `--force-with-lease` kullan.

## Commit başlığı: Conventional Commits

Tek satır, küçük harfle tip; isteğe bağlı kapsam parantez içinde. `pr-gate.yml`'in kabul
ettiği tipler: `feat`, `fix`, `docs`, `test`, `chore`, `ci`, `refactor`, `perf`, `build`,
`revert`, `style`.

| Tip | Ne zaman |
|-----|----------|
| `feat` | Yeni kullanıcıya görünür özellik |
| `fix` | Hata düzeltmesi |
| `docs` | Sadece dokümantasyon |
| `test` | Test ekleme/değiştirme |
| `chore` | Araç, bağımlılık, config (davranış değişmeyebilir) |
| `ci` | CI workflow / pipeline |
| `build` | Derleme / paketleme (imaj, mobil sürüm) |
| `refactor` | Davranış aynı, kod yapısı değişti |
| `perf` | Performans |
| `style` | Görsel/biçim, davranış aynı |
| `revert` | Bir commit'i geri alma |

Örnekler:

```text
feat(admin): platform ayarlari icin varsayilan seed
fix(booking): iptal sonrasi tutar yuvarlama
ci: prisma migrate job ortam degiskenleri
docs: backlog ve operasyon linkleri
```

Gövdede neden (ve varsa breaking change):

```text
fix(auth): trustHost prod nginx arkasinda

nginx X-Forwarded-Host ile uyum icin trustHost acildi.
```

## Sürüm etiketi (GitHub Release)

`package.json` → `"version"` ve git etiketi `v*.*.*`. Etiket push'u
`.github/workflows/release.yml`'i tetikler; o da GitHub Releases'ta otomatik sürüm notu
(`generate_release_notes`) üretir.

```bash
npm run release:patch     # 0.1.0 -> 0.1.1, commit "chore(release): 0.1.1" + etiket v0.1.1
npm run release:minor     # 0.1.x -> 0.2.0
npm run release:major     # 0.x.x -> 1.0.0
```

**Bugünkü durum (2026-11-23):** web sürümü pratikte etiketlenmiyor — `package.json`
`0.1.0`, son etiket `v0.0.2` (2026-06-11). `npm version` bir commit
ürettiği için ruleset altında etiketleme de bir PR ister: dalda `npm run release:patch`,
PR'ı rebase merge et, sonra etiketi `main`'deki o commit'e `git push origin v<sürüm>` ile
gönder. Mobil uygulamanın sürümü ayrıdır (`mobile-expo/app.json`, `mobile-expo/CLAUDE.md`).
