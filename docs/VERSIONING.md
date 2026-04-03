# Sürüm yönetimi (hızlı)

Tek kaynak: **`package.json`** içindeki `"version"` (şu an `0.1.0`). Loglarda `APP_VERSION` yoksa `npm_package_version` kullanılır.

## Patch sürüm (bugfix / küçük değişiklik)

`main` (veya sürüm çıkacağınız dal) üzerinde:

```bash
npm run release:patch
git push --follow-tags origin main
```

Bu komut:

1. `package.json` sürümünü artırır (ör. `0.1.0` → `0.1.1`)
2. Commit atar: `chore(release): 0.1.1`
3. Git tag oluşturur: `v0.1.1`

Push sonrası GitHub Actions **Release** workflow’u çalışır ve **GitHub Releases** sayfasında otomatik sürüm notu üretir.

## Minor / major

```bash
npm run release:minor   # 0.1.x → 0.2.0
npm run release:major   # 0.x.x → 1.0.0
git push --follow-tags origin main
```

## İlk kez veya manuel tag

```bash
npm version 0.2.0 -m "chore(release): %s"
git push --follow-tags origin main
```

## Notlar

- Detaylı el ile changelog tutmak zorunda değilsiniz; GitHub **Generate release notes** ile PR/commit özetini ekler.
- Daha resmi notlar isterseniz release sayfasında düzenleyebilirsiniz.
