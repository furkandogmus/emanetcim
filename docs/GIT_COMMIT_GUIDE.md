# Commit mesajları ve geçmiş düzeni

## Değişiklik süreci (2026-09-23'ten beri)

Gerçek kullanıcılar geldiği için `main` artık **yalnızca PR ile** değişir. `main`'e
doğrudan push kapalı (GitHub ruleset); `main` = prod, çünkü her merge deploy eder.

1. **Dal aç, tek konu.** `feat/…`, `fix/…`, `docs/…`, `ci/…`, `chore/…`. Bir dal bir iş:
   "fiyat düzeltmesi + yeni özellik + belge" üç ayrı PR'dır.
2. **Dalın içinde küçük commit'ler.** Her commit tek bir mantıksal değişiklik, kendi
   başına derlenir ve testleri geçer. "Bir sürü değişiklik tek commit" yok.
3. **Commit başlığı:** Conventional Commits, küçük harf tip, ASCII, ≤ 100 karakter
   (`pr-gate.yml` denetler). Gövdede **neden** — hangi veri / hangi hata.
4. **PR aç** (`gh pr create`). Şablonu doldur. Zorunlu kontroller:
   `Dogrula (lint, tip, test, e2e)`, `Build Android`, `PR kurallari`. Değişmeyen
   katmanın kontrolü koşulla atlanır ve geçmiş sayılır.
5. **Birleştirme yalnızca "Rebase and merge".** Squash kapalı: küçük commit'ler main'e
   olduğu gibi iner, geçmiş doğrusal kalır. Dal birleşince silinir.
6. **Merge = deploy.** Birleştirdikten sonra `CI` workflow'unun `Deploy` adımını izle
   (`gh run watch`). Prod'u etkileyen bir değişiklik birleştikten sonra sürüm etiketi al:
   `npm run release:patch && git push --follow-tags origin main` — bu da bir PR değil,
   etiket push'udur (`docs/VERSIONING.md`).
7. **Acil durum.** Admin, kontrolü kırmızı bir PR'ı bile birleştirebilir (ruleset
   bypass, yalnızca PR üzerinden). Doğrudan push yine yok. Bypass kullanıldıysa PR'a
   nedenini yaz.

Migrasyonlar: aynı PR'da hem şemayı daraltan hem kodu değiştiren bir değişiklik
yapılmaz. Önce geriye uyumlu genişlet (yeni kolon/tablo), kod ikisiyle de çalışsın;
eski yapıyı kaldırma ayrı ve sonraki PR'dır. Deploy sırasında eski imaj yeni şemayla
birkaç dakika çalışır.

## Commit başlığı: Conventional Commits

Tek satır, küçük harfle tip; isteğe bağlı kapsam parantez içinde:

| Tip | Ne zaman |
|-----|----------|
| `feat` | Yeni kullanıcıya görünür özellik |
| `fix` | Hata düzeltmesi |
| `docs` | Sadece dokümantasyon |
| `test` | Test ekleme/değiştirme |
| `chore` | Araç, bağımlılık, config (davranış değişmeyebilir) |
| `ci` | CI workflow / pipeline |
| `refactor` | Davranış aynı, kod yapısı değişti |
| `perf` | Performans |

Örnekler:

```text
feat(admin): platform ayarları için varsayılan seed
fix(booking): iptal sonrası tutar yuvarlama
ci: prisma migrate job ortam değişkenleri
docs: backlog ve operasyon linkleri
```

İstersen gövde ekleyebilirsin (neden / breaking change):

```text
fix(auth): trustHost prod nginx arkasında

nginx X-Forwarded-Host ile uyum için trustHost açıldı.
```

---

## Paylaşılan dala push edilmiş commit’leri yeniden yazmak

`develop` gibi **ortak dallarda** `rebase` + `force-push` **tüm ekibi etkiler**. Yapmadan önce:

- Kimse bu dala dayanmıyor mu / force-push onaylandı mı kontrol edin.
- Tercihen **yeni bir dal** açıp orada temizleyin; sonra PR ile birleştirin.

### Seçenek A — Geçmişe dokunmadan

- Bundan sonra yukarıdaki formatı kullanın.
- Sürüm notları için tag / `CHANGELOG` ile dışarıdan özetleyin.

### Seçenek B — Yerelde mesajları düzeltmek (risk: force-push gerekir)

1. Yedek dal: `git branch backup/develop-before-reword`
2. Etkileşimli rebase (örnek: belirli bir üst committen sonra):

   ```bash
   git fetch origin
   git checkout develop
   git rebase -i origin/develop~14   # veya ilk “kötü” commit’in **bir önceki** hash’i
   ```

3. Editörde `pick` → `reword` (veya ilgili satırlarda mesaj değiştirme) kullanın.
4. Uzak depoyu güncellemek için:

   ```bash
   git push --force-with-lease origin develop
   ```

`--force-with-lease`, başkasının yeni push’unu ezmeden güvenliği artırır.

---

## Bu repodaki belirsiz commit’ler için önerilen mesajlar (referans)

Aşağıdaki hash’ler **yalnızca rebase sırasında kopyala-yapıştır referansıdır**; `git log` ile güncel sırayı doğrulayın.

| Hash (kısa) | Önerilen mesaj |
|-------------|----------------|
| `0383890` | `fix(booking): prisma migration, actions ve bag pricing testleri` |
| `c9f42e0` | `fix(auth): login ve NextAuth ayarları; partner e2e uyumu` |
| `ffe0151` | `feat(finance): money decimal migration; booking ve admin tutarları` |
| `0f3a94d` | `feat(settings): platform_settings modeli, migration ve CI genişletmesi` |
| `dbb3f19` | `fix(ci): prisma.config uyumluluğu` |
| `ad1139a` | `docs: finans, gözlemlenebilirlik, platform ayarları; PR şablonu ve CI` |
| `f8b910e` | `chore: ci, postcss, sw; sayfa lint düzeltmeleri` |
| `efe0021` | `fix(lint): guest sayfaları ve error/not-found düzeni` |

Squash kullanmak isterseniz: ardışık “lint fix” iki commit’i tek `fix(lint): ...` altında birleştirilebilir; aynı şekilde birden fazla `fix bugs` tematik olarak gruplanabilir.

---

## Özet

- **İleri dönük:** Kısa, açıklayıcı, `tip(kapsam): öz` formatı.
- **Geçmiş:** Paylaşılan dalda rewrite riskli; mümkünse yeni işlerde düzeltin veya güvenli force ile koordineli reword.
- **Bu dosya:** Önerilen mesaj tablosu rebase sırasında hızlı referans içindir.
