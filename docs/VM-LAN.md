# Ubuntu VM + Docker + yerel alan adı (LAN)

Tek bir Ubuntu makinesinde (ör. **VirtualBox / VMware / LAN’daki sunucu**) projeyi **Docker Compose** ile ayağa kaldırıp, kendi bilgisayarından `http://emanetci.local` ile erişmek için özet akış.

---

## 1. Güvenlik

- **Root şifresini** sohbet veya repoda paylaşma; güçlü şifre + mümkünse **SSH public key** ile giriş.
- Üretimde **`.env` / sırlar** sadece sunucuda; repo’da yok.

---

## 2. VM’de (Ubuntu)

- **Docker + Compose v2** kurulumu: [Docker Engine (Ubuntu)](https://docs.docker.com/engine/install/ubuntu/).
- Repo’yu klonla (`git clone …`), proje köküne geç.

### 2.1 Ortam değişkenleri (LAN alan adı)

`emanetci.local` kullanacaksan `web` servisinde taban URL’ler bu host’a göre olmalı:

```bash
cp docker-compose.env.example docker-compose.env
# düzenle: AUTH_SECRET (openssl rand -base64 32), AUTH_URL, NEXT_PUBLIC_APP_URL
```

Örnek (`docker-compose.env`):

```env
AUTH_SECRET=<uzun-rastgele-değer>
AUTH_URL=http://emanetci.local
NEXT_PUBLIC_APP_URL=http://emanetci.local
AUTH_TRUST_HOST=true
```


### 2.2 Çalıştır

```bash
docker compose --env-file docker-compose.env up -d --build
```

- Nginx **80** portunda dinler; VM içinden: `curl -s http://localhost/api/health/live` ile kontrol.

### 2.3 Güvenlik duvarı (VM’de)

Örnek (UFW):

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw enable
```

### 2.4 SSH ile hızlı güncelleme

Repo kökünde `scripts/vm-update.sh`: **`develop` branch’ini çeker** ve `docker compose --env-file docker-compose.env up -d --build` çalıştırır.

```bash
cd /opt/emanetci   # veya klonladığın dizin
chmod +x scripts/vm-update.sh   # ilk sefer
./scripts/vm-update.sh
```

Başka dizin: `./scripts/vm-update.sh /path/to/emanetci`

Sadece yeniden derle / ayağa kaldır (pull yok): `SKIP_GIT=1 ./scripts/vm-update.sh`

Başka branch: `BRANCH=main ./scripts/vm-update.sh`

İsteğe bağlı kısayol (sunucuda bir kez): `ln -sf /opt/emanetci/scripts/vm-update.sh /usr/local/bin/emanetci-update` — sonra SSH’te sadece `emanetci-update`.

### 2.5 Yedek ve geri yükleme (PostgreSQL)

Kullanıcı verisi Postgres’te; düzenli yedek ve felaket senaryosu için: **[BACKUP.md](./BACKUP.md)** (`scripts/backup.sh`, `scripts/restore.sh`).

---

## 3. Kendi bilgisayarında (LAN): yerel alan adı

**VM’nin LAN IP’si** örneğin `192.168.139.241` ise:

**macOS / Linux** — `/etc/hosts` (sudo ile):

```text
192.168.139.241  emanetci.local
```

**Windows** — `C:\Windows\System32\drivers\etc\hosts` (Yönetici Not Defteri):

```text
192.168.139.241  emanetci.local
```

Sonra tarayıcıdan: **http://emanetci.local**

> IP VM’de `ip a` veya DHCP ile değişebilir; değişirse `hosts` satırını güncelle.

---

## 4. Nginx

`nginx/conf.d/default.conf` içinde `server_name` **`emanetci.local`**, **`localhost`** ve **`_`** (fallback) ile uyumludur; hem IP hem isimle erişim mümkün.

---

## 5. İleride gerçek sunucuya taşıma

- Aynı **Docker Compose** + aynı `docker-compose.env` mantığı.
- DNS’te A kaydı: `emanetci` → sunucu IP; `AUTH_URL` / `NEXT_PUBLIC_APP_URL` → `https://alanadiniz.com`.
- HTTPS için sunucuda **Caddy** veya **nginx + Let’s Encrypt** (bu dokümanı genişletebilirsiniz).

---

## 6. ngrok (dışarıdan tünel)

Auth.js, **`AUTH_URL` tanımlıysa** tüm istek URL’sini bu adrese çevirir; bu yüzden ngrok adresiyle girseniz bile OAuth **`emanetci.local`** gibi sabit bir `AUTH_URL`’e dönebilir.

**Yapılacaklar:**

1. VM’deki `docker-compose.env` içinde **`AUTH_URL` ve `NEXT_PUBLIC_APP_URL` satırlarını kaldırın** veya boş bırakın (compose varsayılanı boştur). LAN’da yalnızca `emanetci.local` kullanacaksanız bu iki satırı tekrar doldurun.
2. `AUTH_TRUST_HOST=true` kalsın (varsayılan).
3. Google Cloud OAuth’ta **Yetkilendirilmiş yönlendirme URI’leri** içine `https://<ngrok-host>/api/auth/callback/google` ekleyin.
4. Nginx, `X-Forwarded-Proto` / `X-Forwarded-Host` zincirini Next.js’e iletir; gerekirse `docker compose restart nginx web`.

---

## 7. Sorun giderme

| Sorun | Kontrol |
|-------|---------|
| `emanetci.local` açılmıyor | VM’de `docker compose ps`, `hosts` satırı, ping, port 80 |
| Auth redirect / cookie | Tek host ise `AUTH_URL` / `NEXT_PUBLIC_APP_URL` tarayıcı adresiyle aynı; **ngrok için bu iki değişkeni boş bırakın** |
| `connection refused` | VM firewall, Docker’ın 80’i publish etmesi (`nginx` → `ports: "80:80"`) |
