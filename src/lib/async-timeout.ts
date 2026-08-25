/**
 * Uzun süren dış API çağrılarını sınırlamak için.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label}_timeout_after_${ms}ms`));
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  }) as Promise<T>;
}

/**
 * Zaman aşımında isteği GERÇEKTEN iptal eden `fetch`.
 *
 * NEDEN AYRI BİR YARDIMCI: `withTimeout(fetch(...), ms)` yalnızca bir
 * `Promise.race`'tir — süre dolduğunda ÇAĞIRAN vazgeçer ama alttaki istek
 * çalışmaya devam eder. Soket açık kalır, gövde indirilmeye devam eder ve
 * yanıt geldiğinde kimsenin okumadığı bir sonuç üretilir. Sağlayıcı yavaşladığı
 * (ama düşmediği) bir olayda bu, her denemede bir soket biriktirir: bir
 * yavaşlama, bizim tarafımızda kaynak tükenmesine dönüşür.
 *
 * `AbortSignal.timeout` isteği ağ katmanında sonlandırır — soket kapanır.
 *
 * Hata biçimi `withTimeout` ile AYNI (`<label>_timeout_after_<ms>ms`), böylece
 * çağıranların `catch` blokları ve log'lar iki yol için ayrışmaz.
 *
 * `withTimeout` yerini KORUYOR: iptal edilebilir olmayan işler için (örn.
 * `src/lib/mail.ts` içindeki Resend SDK çağrıları) tek seçenek hâlâ yarıştır.
 */
export async function fetchWithTimeout(
  input: string | URL,
  init: RequestInit,
  ms: number,
  label: string,
): Promise<Response> {
  try {
    return await fetch(input, { ...init, signal: AbortSignal.timeout(ms) });
  } catch (error) {
    // AbortSignal.timeout -> DOMException("TimeoutError"). Çağıran taraf tek bir
    // hata metni görsün diye normalize ediliyor.
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new Error(`${label}_timeout_after_${ms}ms`);
    }
    throw error;
  }
}
