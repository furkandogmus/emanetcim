# Git dalları ve yerel geliştirme

## Yerel geliştirme hızı

**Dal (branch) seçimi `npm run dev` hızını değiştirmez.** Next.js geliştirme sunucusu hangi branch’te olduğunuza bakmaz; `npm install` / `npm run dev` her dalda aynı şekilde çalışır.

- Hızlı deneme: `git checkout -b feature/kisa-isim` → kodu yaz → `npm run dev`.
- Docker üretim denemesi: `docker compose up` — yine daldan bağımsız (sadece o anki dosyalar derlenir).

Yavaşlatan şeyler genelde: çok ağır eklenti, `node_modules` bozulması, `.env` eksikliği — dal değil.

## Önerilen akış

| Dal | Rol |
|-----|-----|
| **`main`** | Üretime uygun, stabil; doğrudan buraya merge yalnızca hazır sürümlerde (veya `develop` → `main`). |
| **`develop`** | Günlük entegrasyon; feature PR’ları buraya açılır. |
| **`feature/...`** | Tek iş / ticket: `feature/checkout-iyilestirme`, `feature/admin-rapor` vb. |

Kabaca:

1. `git checkout develop && git pull`
2. `git checkout -b feature/yeni-sey`
3. Geliştir → commit → `git push -u origin feature/yeni-sey`
4. GitHub’da PR: **`feature/yeni-sey` → `develop`**
5. Yayın zamanı: **`develop` → `main`** (tag / release ile uyumlu)

`main`’i doğrudan korumak için GitHub’da branch protection (Settings → Branches) ile PR zorunluluğu açabilirsiniz.

## Sürüm (kısa)

`npm run release:patch` ve tag push — ayrıntı **`docs/VERSIONING.md`**.

## Acil düzeltme (hotfix)

Kritik üretim hatası: `main`’den `hotfix/acil-düzeltme` açıp düzeltme → PR → `main` + `develop`’e geri merge (dalınızı kaybetmemek için).
