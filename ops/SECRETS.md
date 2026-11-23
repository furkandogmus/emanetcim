# Üretim sırları — SSM Parameter Store

`docker-compose.env` elle düzenlenmez. Tek doğruluk kaynağı **AWS SSM Parameter Store**
(`/bagajpark/env/app/*`, SecureString); sunucudaki dosya her deploy'da oradan üretilir.

## Son durum — 2026-11-23

| Parça | Durum |
|---|---|
| Parameter Store `/bagajpark/env/app/*` | canlı; 2026-10-25 hesap taşımasında 42 anahtar yeni hesaba kopyalandı (`infra/aws/README.md`) |
| CI deploy'da render adımı | `main`'de (2026-08-29'dan beri): `scripts/secrets-render.sh --prefix ${{ vars.SSM_APP_PARAMETER_PREFIX }} --out /opt/emanetci/docker-compose.env --manifest /opt/emanetci/secrets.manifest` |
| `ops/secrets.manifest` | 10 zorunlu anahtar; biri SSM'de yoksa render durur ve mevcut dosyaya dokunmaz |
| IAM `read-app-env-ssm-parameters` | instance rolünde, uygulanmış |
| IAM `seed-app-env-ssm-parameters` | `enable_secret_seeding = false` ile kapalı (yalnızca toplu seed için açılır) |
| Sunucudaki dosya | `/opt/emanetci/docker-compose.env`, `ec2-user` okuyabilir (640) — cron işleri `CRON_SECRET`'i buradan okur. `/opt/emanetci/.env` yok |

Neden: sırlar tek EC2'nin diskinde, tek kopya, yedeksiz duruyordu — instance giderse
`AUTH_SECRET`, `POSTGRES_PASSWORD`, `RESEND_API_KEY` vb. de giderdi.

**Render prefix altındaki bütün parametreleri yazar**, manifest yalnızca zorunlu olanları
denetler. Ama bir anahtarın konteynere ulaşması için `docker-compose.yml`'de `web` →
`environment` altında da adıyla geçmesi gerekir; dosyada olup orada olmayan anahtar
uygulamaya **sessizce ulaşmaz** (2026-09-23 ve 2026-10-15'te mobil giriş, push ve inceleme
hesabı anahtarları bu yüzden eksik kaldı). Derleme anında gömülen `NEXT_PUBLIC_*`
değerleri ise imaj build-arg'ı olarak CI'dan gelir, SSM'den değil.

## Bir sırrı eklemek / değiştirmek (normal akış)

```bash
export AWS_PROFILE=<prod-profiliniz> AWS_REGION=eu-central-1
aws sts get-caller-identity --query Account --output text   # canlı hesap: infra/aws/README.md

# 1. Parameter Store'a yaz (değer argv'ye ve shell geçmişine düşmesin diye dosyadan):
printf '%s' 'yeni-deger' > /tmp/v && chmod 600 /tmp/v
aws ssm put-parameter --name /bagajpark/env/app/<KEY> \
  --value "file:///tmp/v" --type SecureString --overwrite
rm -f /tmp/v

# 2. Yeni anahtarsa: docker-compose.yml → web.environment'a ekle (PR). Zorunluysa
#    ops/secrets.manifest'e de ekle.

# 3. Deploy'u tetikle (merge) ya da yalnızca render + yeniden başlatma:
bash scripts/secrets-remote.sh render
```

Örnek: web'de Apple ile giriş için `APPLE_KEY_ID` ve `APPLE_PRIVATE_KEY_B64` SSM'de durur;
istemci sırrı çalışma anında anahtardan üretilir (`docker-compose.yml`). Sunucuda dosyayı
elle düzenlemeyin — bir sonraki deploy üzerine yazar.

## `scripts/secrets-remote.sh` — SSH'sız, değer basmadan

Bütün işler sunucuda SSM Run Command ile olur; çıktı yalnızca anahtar adlarıdır (SSM komut
çıktısı CloudTrail/SSM geçmişinde saklanır, bu yüzden değer basmak seçenek değil).

| Komut | Ne yapar |
|---|---|
| `keys` | Sunucudaki `docker-compose.env`'in anahtar adlarını listeler |
| `diff` | Dosya ile Parameter Store aynı anahtarları mı taşıyor |
| `render` | Parameter Store'dan dosyayı yeniden üretir (manifest doğrulanır) |
| `seed-dry` / `seed` | Dosyadaki anahtarları Parameter Store'a yazar — yalnızca toplu taşıma için |

Komut göndermek `ssm:SendCommand` ister; hedef `Project=bagajpark-aws-test` etiketli
instance'lar (deploy rolündeki kapsamla aynı, `infra/aws/bootstrap/main.tf`). Yerel IAM
kullanıcınızda yoksa, hesap kimliğini kendi hesabınızla değiştirerek şu politikayı ekleyin:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "RunCommandOnProjectInstances",
      "Effect": "Allow",
      "Action": "ssm:SendCommand",
      "Resource": "arn:aws:ec2:eu-central-1:<account-id>:instance/*",
      "Condition": { "StringEquals": { "ssm:resourceTag/Project": "bagajpark-aws-test" } }
    },
    {
      "Sid": "RunCommandDocument",
      "Effect": "Allow",
      "Action": "ssm:SendCommand",
      "Resource": "arn:aws:ssm:eu-central-1::document/AWS-RunShellScript"
    },
    {
      "Sid": "ReadCommandStatus",
      "Effect": "Allow",
      "Action": ["ssm:GetCommandInvocation", "ssm:ListCommandInvocations", "ssm:ListCommands"],
      "Resource": "*"
    }
  ]
}
```

## Toplu seed (yalnızca dosyadan Parameter Store'a ilk taşıma)

2026-08-29'da bir kez yapıldı; hesap taşımasında parametreler doğrudan hesaptan hesaba
kopyalandı, seed gerekmedi. Gerekirse sıra:

1. `infra/aws/stack`: `terraform apply -var="enable_secret_seeding=true"` — plan yalnızca
   `aws_iam_role_policy.app_ssm_write_env[0]` **1 to add** göstermeli.
2. `bash scripts/secrets-remote.sh seed-dry`, sonra `seed`, sonra `diff`.
3. `terraform apply` (varsayılan `false`) — izin **1 to destroy**. Bu adım atlanırsa
   kutuyu ele geçiren biri kendi sırlarını kalıcı olarak değiştirebilir.
4. `bash scripts/secrets-remote.sh render`.

## Geri alma

**Deploy render'da patlarsa:** sunucudaki `docker-compose.env` değişmemiştir, çalışan
konteynerler etkilenmez. Eksik anahtarı yazın ve deploy'u yeniden tetikleyin.

**Bir sır bozulduysa:** Parameter Store sürüm tutar.

```bash
aws ssm get-parameter-history --name /bagajpark/env/app/<KEY> \
  --query 'Parameters[].[Version,LastModifiedDate]' --output table
```

Değeri basmadan sürümleri görürsünüz; geri almak için o sürümü okuyup yukarıdaki akışla
yeniden yazın.
