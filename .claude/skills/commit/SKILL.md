---
name: commit
description: Bu repo'nun commit disipliniyle (Conventional Commits, ASCII başlık, Türkçe "neden" gövdesi) staged değişiklikleri commit'le. Kullanıcı commit istediğinde kullan; push yapma.
---

# Commit

Kaynak: `docs/GIT_COMMIT_GUIDE.md`. Kullanıcı açıkça istemeden `git push` YAPMA.

1. `git status` ve `git diff --staged` oku. Staged bir şey yoksa kullanıcıya hangi dosyaları
   ekleyeceğini sor; `git add -A` ile körlemesine ekleme (ekran görüntüsü, log, `.env`,
   `build/` çıktısı, `key.properties` girmesin).
2. Mobil değişiklikse `/mobil-dogrula`, web değişikliğiyse
   `npm run typecheck && npm run lint && npm test` yeşil olmalı; değilse commit'leme, söyle.
3. Başlık: `tip(kapsam): açıklama` — **ASCII** (ş→s, ı→i, ğ→g, ç→c, ö→o, ü→u), küçük harf,
   72 karakter altı. Tipler: feat, fix, docs, test, chore, ci, refactor, perf.
   Mobil kapsam örnekleri: `fix(mobil)`, `feat(mobil-partner)`, `chore(mobil-deps)`, `test(mobil)`.
4. Gövde (Türkçe, serbestçe diakritik): **neden** — hangi hata/veri/gözlem buna yol açtı,
   ne değişti, neye dokunulmadı. Kanıt varsa (analyze/test sayısı, cihazda doğrulandı) yaz.
5. Çok şey değiştiyse tek commit'e sıkıştırma; mantıksal parçalara böl ve sor.
6. Commit sonrası `git log -1 --stat` göster.
