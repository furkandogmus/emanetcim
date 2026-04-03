# Emanetçi: Güvenlik ve Altyapı Protokolü (Security & Infrastructure)

Bu doküman, platformun teknik güvenliğini, veri gizliliğini ve Cloudflare tabanlı altyapı stratejisini detaylandırır. "Sıfır Güven" (Zero Trust) prensibiyle tasarlanmıştır.

---

## 🛡️ 1. Yazılım ve Veri Güvenliği

### 1.1. Kimlik Doğrulama ve Yetkilendirme (Auth & RBAC)
- **NextAuth.js / Auth.js:** Endüstri standardı olan kütüphaneler ile güvenli oturum yönetimi.
- **RBAC (Role Based Access Control):** Veritabanı seviyesinde `Misafir`, `Esnaf` ve `Admin` yetkileri kesin çizgilerle ayrılmıştır. Bir esnaf, başka bir esnafın verisine veya misafir listesine asla erişemez.
- **SSO Güvenliği:** Google ve Apple üzerinden yapılan girişlerde hassas şifreler sistemimizde tutulmaz, sadece yetki jetonları (tokens) kullanılır.

### 1.2. QR Kod ve İşlem Güvenliği
- **Signed JWT QR:** QR kodlar sadece düz metin değil, sunucu tarafında imzalanmış (signed) ve süreli (TTL) jetonlardır. Ekran görüntüsü alınsa bile kısa süre içinde geçerliliğini yitirir.
- **Mühür Fotoğrafı Kanıtı:** Her işlemde esnafın mühürlü fotoğraf yüklemesi zorunludur. Bu, uyuşmazlık durumunda "inkar edilemezlik" (non-repudiation) sağlar.

### 1.3. API Güvenliği
- **Rate Limiting:** Aynı IP üzerinden gelebilecek bot saldırılarını veya brute-force denemelerini engellemek için API isteklerine limit uygulanır.
- **Input Validation:** Zod veya Joi gibi kütüphanelerle tüm girdi verileri (input) temizlenir (sanitization), SQL Injection ve XSS saldırıları Prisma ve Next.js'in doğal korumasıyla engellenir.

---

## ☁️ 2. Altyapı ve Cloudflare Stratejisi

### 2.1. Neden Cloudflare Ücretsiz Plan?
İlk aşamada Cloudflare'in ücretsiz (Free) katmanı projemiz için fazlasıyla yeterlidir:
- **DDoS Koruması:** Standart katmanda bile dünyanın en güçlü DDoS korumasına sahip oluruz.
- **SSL/TLS Şifreleme:** Ücretsiz otomatik SSL sertifikası ile tüm trafik `https://` üzerinden şifreli akar.
- **Global CDN:** Müşteriler (turistler) farklı ülkelerden gelse bile statik içerikler onlara en yakın sunucudan hızlıca servis edilir.
- **WAF (Web Application Firewall):** Temel güvenlik kuralları ile bot trafiği filtrelenir.

### 2.2. Sunucu ve Veritabanı Barındırma
- **Self-Hosted / VPS:** Kendi kiralayacağınız sunucuda Docker veya PM2 ile uygulamayı koşturabilirsiniz.
- **Hassas Veri Saklama:** API anahtarları (`.env` dosyası) asla GitHub/Git platformlarına yüklenmez, sadece sunucu üzerinde saklanır.

---

## 🚨 3. Güvenlik Denetim Listesi (Checklist)
- [ ] Production moduna geçerken `NODE_ENV=production` set edilmeli.
- [ ] Cloudflare üzerinde "Always Use HTTPS" aktif edilmeli.
- [ ] iyzico API anahtarları sadece sunucu tarafında (Server-side) saklanmalı ve istemciye (Client) asla sızdırılmamalı.
- [ ] Veritabanı yedekleri günlük olarak şifreli şekilde alınmalı.

---
*Teknik Operasyonlar ve Güvenlik Birimi - Emanetçi.*
