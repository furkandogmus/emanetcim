import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * BagajPark / Emanetçi - k6 Stres ve Yük Testi
 * 
 * ÇALIŞTIRMA TALİMATI:
 * 1. Bilgisayarınıza k6 kurun (Mac için: `brew install k6`)
 * 2. Testi başlatın: `k6 run load-test.js`
 * 3. Ortam değişkenleriyle hedefi değiştirebilirsiniz:
 *    `k6 run -e TARGET_URL=http://localhost:3000 load-test.js`
 * 
 * CLOUDFLARE'İ ATLATMAK İÇİN:
 * Eğer canlı sunucunun doğrudan IP adresine vurmak istiyorsanız:
 * `k6 run -e TARGET_URL=http://<SUNUCU_IP_ADRESI> -e TARGET_HOST=emanetcim.com load-test.js`
 */

const BASE_URL = __ENV.TARGET_URL || 'http://localhost:3000';
const HOST_HEADER = __ENV.TARGET_HOST || null;

export const options = {
  // Stres testi senaryosu: Kademeli olarak kullanıcı sayısını artırır
  stages: [
    { duration: '30s', target: 50 },  // 30 saniye içinde 50 aktif kullanıcıya çık
    { duration: '1m', target: 200 },  // 1 dakika boyunca 200 kullanıcıda kal (Normal Yoğunluk)
    { duration: '1m', target: 500 },  // 1 dakika içinde 500 kullanıcıya sıçra (Stres testi/Pik anı)
    { duration: '30s', target: 500 }, // 30 saniye 500'de kal
    { duration: '30s', target: 0 },   // Hızlıca soğut ve sıfırla
  ],
  thresholds: {
    // Performans hedefleri (SLA):
    // Yanıtların %95'i 2 saniyenin altında dönmeli
    http_req_duration: ['p(95)<2000'],
    // İstek başarısızlık oranı %1'in altında olmalı
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const params = HOST_HEADER ? {
    headers: {
      'Host': HOST_HEADER,
      'User-Agent': 'K6-LoadTest/1.0',
    }
  } : {
    headers: {
      'User-Agent': 'K6-LoadTest/1.0',
    }
  };

  // 1. Ana Sayfayı (Landing) Ziyaret Et
  const resHome = http.get(`${BASE_URL}/tr`, params);
  check(resHome, {
    'ana sayfa status 200': (r) => r.status === 200,
    'ana sayfa yanit hizi < 2s': (r) => r.timings.duration < 2000,
  });

  sleep(1); // Kullanıcı sayfayı okuyor (1 saniye bekle)

  // 2. Arama ve Harita Sayfasını Ziyaret Et (Veritabanından dükkanları çeker)
  const resSearch = http.get(`${BASE_URL}/tr/search`, params);
  check(resSearch, {
    'arama sayfasi status 200': (r) => r.status === 200,
  });

  sleep(2); // Şehirde arama yapıyor

  // 3. API Health Check'e Vur (Saf Sunucu Tepkisi)
  const resHealth = http.get(`${BASE_URL}/api/health/live`, params);
  check(resHealth, {
    'healthcheck status 200': (r) => r.status === 200,
  });

  sleep(1);
}
