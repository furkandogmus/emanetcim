# Üretim sırları — SSM Parameter Store

`docker-compose.env` artık elle düzenlenmez. Tek doğruluk kaynağı **AWS SSM
Parameter Store**; sunucudaki dosya her deploy'da oradan üretilir.

## Güncel durum — 2026-08-29

| Parça | Durum |
|---|---|
| `scripts/secrets-put.sh` (dosya → Parameter Store) | yazıldı, **henüz koşulmadı** |
| `scripts/secrets-render.sh` (Parameter Store → dosya) | yazıldı, sahte veriyle denendi, **prod'da koşulmadı** |
| `scripts/secrets-remote.sh` (laptop → SSM Run Command) | yazıldı, **henüz koşulmadı** |
| `ops/secrets.manifest` (11 zorunlu anahtar) | yazıldı, **gerçek anahtarlara karşı doğrulanmadı** (Adım 2) |
| IAM: `read-app-env-ssm-parameters` | Terraform'da, **apply edilmedi** |
| IAM: `seed-app-env-ssm-parameters` | Terraform'da, `enable_secret_seeding = false` ile **kapalı** |
| CI deploy'da render adımı | `ci.yml`'de, **`main`'e girmedi** |
| Parameter Store'daki anahtarlar | **hiçbiri yok — seed yapılmadı** |

**Sıralama zorunlu.** CI deploy artık `secrets-render.sh` çağırıyor. Parameter
Store boşken ya da `vars.SSM_APP_PARAMETER_PREFIX` tanımsızken bu adım deploy'u
**kasten** durdurur. Yani Adım 1–6 bitmeden bu dal `main`'e **birleştirilmemeli**.

Neden bu iş yapıldı: sırlar tek EC2'nun diskinde, tek kopya, yedeksiz duruyordu
— deploy dosyaya dokunmuyor, `backup.sh` onu yedeklemiyor. Instance giderse
`AUTH_SECRET`, `POSTGRES_PASSWORD`, `RESEND_API_KEY`, `NETGSM_PASSWORD` giderdi.

## Ön koşullar

```bash
cd <repo kökü>
export AWS_PROFILE=<aws profiliniz>      # yeni hesap: bagajpark-yeni
export AWS_REGION=eu-central-1
export DEPLOY_BUCKET=$(gh variable get AWS_DEPLOY_BUCKET --repo furkandogmus/emanetcim)
aws sts get-caller-identity --query Account --output text
```

Beklenen: `772853132412`. Başka bir numara çıkarsa **durun** — yanlış hesaptasınız.

> Hiçbir adım SSH/SCP kullanmaz ve hiçbir adım ekrana sır **değeri** basmaz.
> Bütün iş sunucuda SSM Run Command ile olur; çıktı yalnızca anahtar adlarıdır.
> Sebebi: SSM komut çıktısı CloudTrail/SSM geçmişinde saklanır.

---

## Adım 1 — Scriptleri sunucuya koy (salt kopyalama)

```bash
aws s3 cp scripts/secrets-put.sh    "s3://$DEPLOY_BUCKET/deploy-config/secrets-put.sh"
aws s3 cp scripts/secrets-render.sh "s3://$DEPLOY_BUCKET/deploy-config/secrets-render.sh"
aws s3 cp ops/secrets.manifest      "s3://$DEPLOY_BUCKET/deploy-config/secrets.manifest"
```

Sonra sunucuya çektirin:

```bash
aws ssm send-command \
  --document-name "AWS-RunShellScript" \
  --targets "Key=tag:Project,Values=bagajpark-aws-test" \
  --comment "secrets scriptlerini yerlestir" \
  --parameters 'commands=[
    "set -e",
    "mkdir -p /opt/emanetci/scripts",
    "aws s3 cp s3://$DEPLOY_BUCKET/deploy-config/secrets-put.sh /opt/emanetci/scripts/secrets-put.sh",
    "aws s3 cp s3://$DEPLOY_BUCKET/deploy-config/secrets-render.sh /opt/emanetci/scripts/secrets-render.sh",
    "aws s3 cp s3://$DEPLOY_BUCKET/deploy-config/secrets.manifest /opt/emanetci/secrets.manifest",
    "chmod +x /opt/emanetci/scripts/secrets-put.sh /opt/emanetci/scripts/secrets-render.sh",
    "ls -l /opt/emanetci/scripts/secrets-*.sh"
  ]' --query "Command.CommandId" --output text
```

Beklenen: iki dosya `-rwxr-xr-x` olarak listelenir.

## Adım 2 — Gerçek anahtarları listele ve manifest'i doğrula

Bu adım **değer basmaz**, yalnızca anahtar adlarını.

```bash
bash scripts/secrets-remote.sh keys
```

Çıktıdaki listeyi `ops/secrets.manifest` ile karşılaştırın. Manifest'te olup
sunucuda **olmayan** bir anahtar varsa, Adım 5'te deploy kilitlenir — o satırı
manifest'ten çıkarın ya da değeri sunucuda tanımlayın. Bu, prod'a bakmadan
kestirilemeyeceği için ayrı bir adım.

## Adım 3 — Seed iznini geçici aç

```bash
cd infra/aws/stack
terraform workspace select hesap2
terraform plan  -var="enable_secret_seeding=true"
terraform apply -var="enable_secret_seeding=true"
```

Beklenen plan: `aws_iam_role_policy.app_ssm_write_env[0]` **1 to add**, başka
hiçbir değişiklik yok. Plan'da başka bir kaynak görünüyorsa durun.

## Adım 4 — Sırları Parameter Store'a yaz

Önce kuru koşu — hiçbir şey yazmaz, ne yazılacağını listeler:

```bash
bash scripts/secrets-remote.sh seed-dry
```

Beklenen: her anahtar için `INFO [kuru] /bagajpark/env/app/<KEY>` ve sonda
`KURU KOSU -- hicbir sey yazilmadi`. Boş bırakılmış anahtarlar
`atlandi (bos deger)` ile geçilir; bu normaldir (SecureString boş değer kabul
etmez, compose varsayılanı zaten boş).

**İlk mutasyon bu adımda:**

```bash
bash scripts/secrets-remote.sh seed
```

Beklenen: her anahtar için `INFO yazildi /bagajpark/env/app/<KEY>`, sonda
`tamam: N anahtar yazildi`.

Doğrulama (yalnızca adlar):

```bash
bash scripts/secrets-remote.sh diff
```

Beklenen: `yalnizca DOSYADA:` altında yalnızca boş değerli anahtarlar,
`yalnizca PARAMETER STORE da:` altı boş.

## Adım 5 — Seed iznini kapat

```bash
cd infra/aws/stack
terraform apply       # enable_secret_seeding varsayilani false
```

Beklenen: `aws_iam_role_policy.app_ssm_write_env[0]` **1 to destroy**. Bu adım
atlanırsa kutuyu ele geçiren biri kendi sırlarını kalıcı olarak değiştirebilir.

## Adım 6 — Render'ı prod'da dene

```bash
bash scripts/secrets-remote.sh render
```

Beklenen: `manifest dogrulandi` ve
`/opt/emanetci/docker-compose.env yazildi: N anahtar`.

Bu adım env dosyasını **yeniden üretir**. Çalışan konteynerlere dokunmaz;
etkisi bir sonraki `docker compose up`'ta görünür. Hata verirse dosya
**değiştirilmez** (script bunu garanti eder), yani prod bozulmaz.

## Adım 7 — GitHub Actions değişkenini tanımla

```bash
gh variable set SSM_APP_PARAMETER_PREFIX --body "/bagajpark/env/app" \
  --repo furkandogmus/emanetcim
gh variable list --repo furkandogmus/emanetcim
```

Bu değişken tanımsızsa deploy'daki render adımı `--prefix` boş kalır ve
`assert_not_empty` ile durur.

## Adım 8 — Dalı birleştir

Ancak 1–7 yeşilse. İlk deploy'da SSM çıktısında
`manifest dogrulandi` + `docker-compose.env yazildi` satırlarını görün.

---

## Geri alma

**Deploy render'da patlarsa:** sunucudaki `docker-compose.env` değişmemiştir,
çalışan konteynerler etkilenmez. Eksik anahtarı yazın ve deploy'u yeniden
tetikleyin.

**Render yanlış dosya ürettiyse** (manifest çok dar/geniş): `ci.yml`'deki
render satırını çıkarıp `main`'e push edin; deploy eski davranışına döner
(dosyaya dokunmaz). Sonra sakin sakin düzeltin.

**Bir sır bozulduysa:** Parameter Store sürüm tutar.

```bash
aws ssm get-parameter-history --name /bagajpark/env/app/<KEY> \
  --query 'Parameters[].[Version,LastModifiedDate]' --output table
```

Değeri basmadan sürümleri görürsünüz; geri almak için o sürümü okuyup
yeniden yazın (seed iznini geçici açarak, Adım 3/5).

## Bir sırrı değiştirmek (bundan sonraki normal akış)

```bash
# 1. Parameter Store'da guncelle (deger argv'ye dusmesin diye dosyadan):
printf '%s' 'yeni-deger' > /tmp/v && chmod 600 /tmp/v
aws ssm put-parameter --name /bagajpark/env/app/<KEY> \
  --value "file:///tmp/v" --type SecureString --overwrite
rm -f /tmp/v

# 2. Deploy'u tetikle (main'e push) ya da yalnizca render + restart:
bash scripts/secrets-remote.sh render
```

Sunucuda dosyayı elle düzenlemeyin — bir sonraki deploy üzerine yazar.
