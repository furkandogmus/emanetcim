# CI/CD — tek pipeline, ölçülmüş maliyet

> Durum: 2026-08-26. Tek giriş noktası `.github/workflows/ci.yml`.

## Neden yeniden kurgulandı

Actions kotası bitti ve bu, hata gibi görünmedi. Kota dolunca job'lar **0 adımda,
~3 saniyede** düşüyor ve **hiç log bırakmıyor** (log arşivi 22 baytlık boş bir zip).
Ekranda "başarısız" yazar ama başarısız olan bir şey yoktur — iş hiç başlamamıştır.
Bu tabloyu bir kez görüp tanımak, yarım saat kod aramaktan ucuzdur.

Ölçüm (Ağustos, private repo — free plan kotası **2000 dk/ay**):

| Workflow | Duvar saati | Koşu | Not |
|---|---|---|---|
| CI | 918 dk | 160 | gerçekten koşanlar ~12 dk |
| Build & Deploy | 611 dk | 132 | her `main` push'unda |
| Mobile CI | 28 dk | 10 | **iOS'un faturası 182 dk** (aşağıya bakın) |
| **Toplam** | **~1547 dk** | | gerçek fatura daha yüksek: job başına yukarı yuvarlanır |

Üç yapısal israf vardı:

1. **Next uygulaması push başına ÜÇ KEZ derleniyordu** — `build` job'ında,
   `e2e` job'ında bir daha (ayrı job, `.next`i paylaşamıyor), bir de Docker
   imajının içinde.
2. **Deploy, CI'yı beklemiyordu.** İkisi ayrı workflow'du ve ikisi de `main`
   push'unda tetikleniyordu. Yani testleri kırmızı bir commit üretime çıkabilirdi;
   bunu engelleyen hiçbir şey yoktu. Bu bir maliyet sorunu değil, güvenlik sorunuydu.
3. **Üstüste gelen push'lar iptal edilmiyordu.** Tek bir günde 58 koşu tetiklendi;
   her biri, kendisinden sonraki commit onu geçersiz kılmış olsa bile sonuna kadar
   koştu.

## Şu anki kurgu

```
push/PR → main                     ci.yml
   │
   ├─ verify   (ubuntu, ~11 dk)    lint → typecheck → migrate → db:verify
   │                               → birim testleri → build → seed → E2E
   │                               iptal edilebilir
   ├─ image    (ubuntu, ~4 dk)     needs: verify — GHCR'a Docker imajı
   │                               yalnızca main push; iptal edilebilir
   └─ deploy   (ubuntu, ~2 dk)     needs: image — S3 + SSM Run Command
                                   ASLA iptal edilmez, tek sırada
```

`mobile-ci.yml` ayrı kalır (`mobile/**` path filtreli), `release.yml` yalnızca
sürüm etiketinde çalışır.

### Kurallar

- **Tek `npm ci`, tek `npm run build`.** `verify` her şeyi tek job'da yapar; ayrı
  job'lar ayrı makinelerdir, `node_modules` ve `.next` paylaşılamaz. Ucuz
  kontroller (lint, typecheck) önce koşar — bir yazım hatası 10 dakikalık E2E'yi
  hiç başlatmadan yakalanır.
- **Docker imajı BİLEREK kendi build'ini yapar.** `verify`'daki build, E2E için
  `NEXT_PUBLIC_ENABLE_AUTH_DEMO=true` ile derlendi ve bu bayrak derleme anında
  gömülüyor. O çıktıyı üretime göndermek **demo giriş düğmelerini canlıya
  taşırdı**. Katman önbelleği (`type=gha`) tekrarın maliyetini düşük tutar.
- **Deploy doğrulamaya `needs` ile bağlı.** Zincir kırılırsa deploy hiç başlamaz.
- **Deploy'un sunucuya gönderdiği şeyler S3 üzerinden gider**, kutudaki git
  kopyasından değil: `docker-compose.yml`, `public/`, `scripts/`,
  `ops/secrets.manifest` ve (2026-08-30'dan beri) **`nginx/conf.d/`**. Bu listeye
  girmeyen bir dosya sunucuya HİÇ ulaşmaz. `nginx/conf.d` eksikti ve
  `docker-compose.yml` onu sunucudan bind-mount ettiği için repodaki nginx
  konfigi ile canlıdaki ayrı yaşıyordu — `scripts/` ile birebir aynı hatanın
  ikiziydi (o delik sekiz cron işini birden düşürmüştü).
- **nginx konfigi artık canlıya gidiyor, yani bozuk konfig siteyi kapatabilir.**
  İki kapı var: `verify` işinde `scripts/verify-nginx-conf.sh --engine docker`
  (üretimin **kendi imajıyla** gerçek `nginx -t`; bozuk konfig S3'e hiç ulaşmaz —
  imaj `docker-compose.yml`'den okunur, çünkü apt'in verdiği nginx 1.24 `http2 on;`
  tanımıyor ve doğru konfigi reddediyordu) ve sunucuda `up -d`'den sonra
  `docker compose exec -T nginx nginx -t` — geçmezse deploy **kırmızı** düşer,
  sessizce "başarılı" demez. Yerelde de aynı script koşar: `bash scripts/verify-nginx-conf.sh`.
- **İptal job seviyesinde.** Workflow seviyesinde olsaydı yeni bir push süren bir
  deploy'u yarıda keserdi: S3 yüklemesi bitmiş, SSM komutu beklenirken kesilen bir
  koşu sunucuyu yarı güncellenmiş bırakır. `deploy` ayrıca `deploy-production`
  grubunda sırayla çalışır — iki deploy aynı anda `docker compose up` çağırmaz.
- **`paths-ignore`:** `docs/**`, `mobile/**`, `ops/**`, `**/*.md`. Bunlar
  uygulamanın davranışını değiştirmez. Path filtresi yüzünden atlanan bir
  değişikliği elle doğrulamak için `workflow_dispatch` var.
- **`timeout-minutes` her job'da.** Asılı kalan bir job, kotayı sessizce yer.

### macOS 10× faturalanır

`mobile-ci.yml` içindeki iOS build'i 10 koşuda **18,2 dakika gerçek süre**
harcadı ama faturaya **182 dakika** yazıldı — kotanın ~%9'u. Ürettiği şey imzasız
bir debug `.app` idi.

Bu yüzden iOS build'i **otomatik koşmuyor**; Actions sekmesinden elle tetiklenir
(`workflow_dispatch`, `ios` girdisi). Dart tarafındaki hatalar zaten her push'ta
yakalanır — `flutter analyze` ve `flutter test` Android job'ında, Linux ücretiyle.
iOS'a özgü risk (Podfile, Xcode ayarları, native eklenti) yalnızca
`mobile/ios/**` değiştiğinde doğar ve o değişiklik nadirdir.

## Kota bittiğinde ne yapılır

Kod tarafında yapılacak bir şey yoktur; belirti kodla ilgili değildir.

1. **Settings → Billing → Plans and usage → Actions** — kalan dakikaya bakın.
2. Kota dolduysa: ayın 1'ini bekleyin, harcama limitini yükseltin ya da repoyu
   public yapın (public repolarda Actions ücretsiz).
3. Teyit: bir koşunun job'ında **0 adım** ve **~3 saniye** süre varsa sebep budur.
   Gerçek bir test hatasında adımlar görünür ve log iner.

```bash
# Bir koşunun gerçekten çalışıp çalışmadığını söyler:
gh api repos/<owner>/<repo>/actions/runs/<id>/jobs \
  --jq '.jobs[] | "\(.name) | adim: \(.steps | length) | \(.started_at) -> \(.completed_at)"'
```

## Daha ileri gidilebilir

E2E şu an `verify` içindeki Next build'ine karşı koşuyor; imaj ayrıca derleniyor.
Tek build'e inmenin yolu, E2E'yi **Docker imajına karşı** compose ile koşturmak.
Kazanç push başına ~4 dakika, bedeli ise demo-auth bayrağının imaj tarafında nasıl
ayrıştırılacağı — bugünkü ayrım tam da o bayrak yüzünden var. Kota rahatlayınca
değerlendirilebilir; şu anki kurgu bu riski almadan israfın büyük kısmını kapatıyor.
