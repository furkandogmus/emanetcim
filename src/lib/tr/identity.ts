/**
 * Türkiye'ye özgü kimlik/hesap doğrulamaları.
 *
 * NEDEN AYRI BİR MODÜL: alt üye iş yeri (sub-merchant) onboarding'i hangi PSP ile
 * yapılırsa yapılsın ilk isteyeceği alanlar bunlar — TCKN veya VKN, IBAN, vergi
 * dairesi. Doğrulamayı sağlayıcı adaptörüne gömmek, sağlayıcı değişince aynı
 * mantığın ikinci kez (ve farklı) yazılmasına yol açar. Burada saf fonksiyon
 * olarak durur; adaptörler de, form da bunu çağırır.
 *
 * Buradaki kontroller BİÇİM ve CHECKSUM kontrolüdür. "Bu TCKN gerçekten var mı"
 * sorusunu yanıtlamaz — onu yalnızca NVİ/PSP doğrulayabilir. Bu ayrımı çağıran
 * bilmek zorunda: geçerli checksum, doğrulanmış kimlik demek değildir.
 */

/** Sadece rakamları bırakır; kullanıcı boşluk/tire yazarsa form patlamasın. */
function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * T.C. Kimlik Numarası doğrulaması (NVİ algoritması).
 *
 * Kurallar: 11 hane, ilk hane 0 olamaz, 10. hane ilk 9 hanenin ağırlıklı
 * toplamından, 11. hane ilk 10 hanenin toplamının mod 10'undan türer.
 */
export function isValidTckn(value: string): boolean {
  const d = digitsOnly(value);
  if (d.length !== 11) return false;
  if (d[0] === "0") return false;
  // POLİTİKA — resmî algoritmanın parçası DEĞİL: "11111111110" gibi ilk on hanesi
  // aynı olan numaralar NVİ checksum'undan GEÇER (elle doğrulandı: 10. hane 1,
  // 11. hane 0 çıkıyor). Bunlar pratikte test/sahte veridir; alt üye iş yeri
  // onboarding'inde kabul edilirlerse PSP'ye gönderilir ve orada reddedilir —
  // hatayı kendi formumuzda yakalamak esnafı bir tur gidip gelmekten kurtarır.
  // Bunu resmî kural sanmayın: yalnızca bu ürünün kabul politikasıdır.
  if (/^(\d)\1{9}/.test(d)) return false;

  const n = d.split("").map(Number);
  const oddSum = n[0] + n[2] + n[4] + n[6] + n[8];
  const evenSum = n[1] + n[3] + n[5] + n[7];

  const tenth = (oddSum * 7 - evenSum) % 10;
  if (((tenth + 10) % 10) !== n[9]) return false;

  const firstTenSum = n.slice(0, 10).reduce((a, b) => a + b, 0);
  return firstTenSum % 10 === n[10];
}

/**
 * Vergi Kimlik Numarası doğrulaması (Maliye algoritması).
 *
 * 10 hane. Her hane için (hane + konum ağırlığı) mod 10 alınır, 2^(konum)
 * ile çarpılır; son hane bu toplamın tümleyenidir.
 */
export function isValidVkn(value: string): boolean {
  const d = digitsOnly(value);
  if (d.length !== 10) return false;
  if (/^(\d)\1{9}$/.test(d)) return false;

  const n = d.split("").map(Number);
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const tmp = (n[i] + (10 - (i + 1))) % 10;
    if (tmp === 0) {
      sum += 9;
    } else {
      sum += (tmp * Math.pow(2, 10 - (i + 1))) % 9 === 0
        ? 9
        : (tmp * Math.pow(2, 10 - (i + 1))) % 9;
    }
  }
  const check = sum % 10 === 0 ? 0 : 10 - (sum % 10);
  return check === n[9];
}

/**
 * Türkiye IBAN doğrulaması.
 *
 * TR IBAN'ı 26 karakterdir (TR + 2 kontrol + 5 banka + 1 rezerv + 16 hesap).
 * ISO 13616 mod-97 kontrolü uygulanır: ilk 4 karakter sona alınır, harfler
 * A=10..Z=35 ile sayıya çevrilir, sonuç mod 97 = 1 olmalıdır.
 *
 * Mod-97 parça parça hesaplanıyor. 26 karakterlik IBAN tek bir sayıya
 * çevrildiğinde Number'ın güvenli tamsayı sınırını (2^53) fazlasıyla aşar ve
 * sonuç sessizce yanlış çıkar. Kalanı her hanede güncelleyince ara değer hiçbir
 * zaman 979'u geçmez; ne BigInt gerekir (proje ES2017 hedefliyor) ne de taşma
 * riski kalır.
 */
export function isValidTrIban(value: string): boolean {
  const raw = value.replace(/\s+/g, "").toUpperCase();
  if (!/^TR\d{24}$/.test(raw)) return false;

  const rearranged = raw.slice(4) + raw.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const chunk = ch >= "A" && ch <= "Z"
      ? String(ch.charCodeAt(0) - 55)
      : ch;
    for (const digit of chunk) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }
  return remainder === 1;
}

/** IBAN'ı ekranda gruplu gösterir: TR12 3456 ... Sadece görünüm içindir. */
export function formatTrIban(value: string): string {
  const raw = value.replace(/\s+/g, "").toUpperCase();
  return raw.replace(/(.{4})/g, "$1 ").trim();
}

/** Depolama biçimi: boşluksuz, büyük harf. Karşılaştırma hep bunun üzerinden. */
export function normalizeTrIban(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}
