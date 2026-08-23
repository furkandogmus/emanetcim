import { cookies } from "next/headers";

const SESSION_COOKIE = "bp_analytics_sid";

/**
 * Sunucu tarafında izlenen olaylar için oturum kimliği çözer.
 *
 * Web'de istemci `src/lib/analytics-client.ts` aynı kimliği hem localStorage'a
 * hem bu çereze yazıyor — böylece sunucu tarafı olaylar (arama, dükkan
 * görüntüleme) istemci tarafı `page_view` ile AYNI oturuma bağlanabiliyor.
 * Çerez yoksa (mobil uygulama — tarayıcı değil, ya da JS hiç çalışmadan gelen
 * ilk istek) oturum açmış kullanıcıya, o da yoksa tek seferlik rastgele bir
 * kimliğe düşülür — olay sayımı her durumda doğru kalır, yalnızca ayrı
 * olayların AYNI oturuma ait olduğu bağı bu kenar durumlarda kurulamaz.
 */
export async function resolveServerSessionId(
  userId?: string | null,
): Promise<string> {
  try {
    const store = await cookies();
    const fromCookie = store.get(SESSION_COOKIE)?.value;
    if (fromCookie) return fromCookie;
  } catch {
    // cookies() bazı bağlamlarda (örn. statik render) atabilir.
  }
  if (userId) return `user:${userId}`;
  return `anon:${crypto.randomUUID()}`;
}
