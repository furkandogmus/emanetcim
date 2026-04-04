# Commit mesajları ve geçmiş düzeni

## Bundan sonra: Conventional Commits

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
test(e2e): iyzico sandbox ödeme akışı
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
| `f3523ef` | `test(e2e): iyzico sandbox ve use-cases; eski e2e dosyalarını kaldır` |
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
