# ops/ — sunucu erişimi ve credential deposu

Bu dizin, canlı Hetzner sunucusuna erişim ve denetim için kullanılan yerel bilgileri
tutar. `server.env` **git'e girmez** (`.gitignore`); `server.env.example` şablon
olarak git'te kalır.

## Kurulum

```bash
cp ops/server.env.example ops/server.env   # zaten oluşturulduysa atla
# ops/server.env içindeki SSH_HOST / SSH_PORT / SSH_USER / APP_DIR değerlerini doldur
```

## SSH key ile bağlantı

Şifre yerine ayrılmış bir ed25519 key kullanılıyor (`ops/server.env` → `SSH_KEY_PATH`).
Public key'i sunucudaki `authorized_keys`'e eklemek için (sunucuya halihazırda sahip
olduğun erişimle, örn. mevcut key veya şifre ile) tek seferlik:

```bash
ssh-copy-id -i "$SSH_KEY_PATH.pub" -p <SSH_PORT> <SSH_USER>@<SSH_HOST>
# veya manuel: public key içeriğini ~/.ssh/authorized_keys'e ekle
```

Sonra:

```bash
source ops/server.env
ssh -i "$SSH_KEY_PATH" -p "$SSH_PORT" "$SSH_USER@$SSH_HOST"
```

## Kurallar

- **Read-only önce.** Sunucuda önce `docker compose ps`, `docker compose logs`,
  `df -h`, `nginx -t` gibi salt-okunur komutlar; mutasyon yapan hiçbir komut
  onaysız çalıştırılmaz.
- **Secret değerleri asla ekrana yazdırılmaz.** `docker-compose.env` içindeki
  `AUTH_SECRET`, `POSTGRES_PASSWORD` vb. için sadece *var mı / boş mu* kontrol
  edilir (`grep -c` / uzunluk), değer kendisi asla `cat`/`echo` edilmez.
- `ops/server.env` bu makineden çıkmaz; bir başka makinede çalışacaksan yeniden
  doldurman gerekir.
