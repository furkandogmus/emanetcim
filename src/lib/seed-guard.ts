/**
 * Seed'in üretim veritabanına çalışmasını engelleyen kapı.
 *
 * NEDEN VAR (2026-08-22 denetimi): `prisma/seed.ts`'in HİÇBİR ortam koruması yoktu.
 * `DATABASE_URL` nereyi gösteriyorsa oraya yazıyordu ve şunları yapıyordu:
 *
 *   1. `admin@test.com` hesabını **ADMIN rolüyle** ve bilinen varsayılan parolayla
 *      (`Demo123!`) **upsert** ediyordu. `update` bloğu `passwordHash` içerdiği için,
 *      prod'da parola değiştirilmiş olsa bile her seed çalıştırması onu **bilinen
 *      değere geri döndürüyordu**.
 *   2. Parolayı stdout'a basıyordu (deploy log'larına düşer).
 *   3. Ödeme defteri olmadan `PAID` bir rezervasyon yaratıyordu — prod'daki hayalet
 *      ödeme kayıtlarıyla aynı sınıf (P1-5).
 *   4. Canlı aramada görünen test dükkanları yaratıyordu (P1-4).
 *
 * Bu bir "dikkatli ol" sorunu değil: tek bir yanlış terminalde `npm run db:seed`
 * yazmak prod'a bilinen parolalı bir yönetici hesabı kurmaya yetiyordu.
 *
 * Kapı BİLEREK katı: kaçış yolu var ama kazara basılamayacak kadar açık
 * (`ALLOW_PRODUCTION_SEED=yes-i-really-mean-it`).
 */

export type SeedGuardVerdict =
  | { allowed: true; reason: string }
  | { allowed: false; reason: string };

/** Bu dize olmadan üretim ortamında seed çalışmaz. */
export const PRODUCTION_SEED_OVERRIDE = "yes-i-really-mean-it";

/**
 * Bağlantı dizesi üretim gibi mi görünüyor?
 *
 * `NODE_ENV`'e güvenmek yetmez: seed genellikle `tsx` ile elle çalıştırılır ve
 * `NODE_ENV` çoğu zaman tanımsızdır. Asıl tehlike, yerel bir kabuktan **uzak** bir
 * veritabanına bağlanmaktır.
 */
export function looksLikeRemoteDatabase(url: string | undefined): boolean {
  if (!url) return false;
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (!host) return false;

  const localHosts = new Set([
    "localhost",
    "127.0.0.1",
    "::1",
    "0.0.0.0",
    "host.docker.internal",
    // docker-compose servis adları
    "postgres",
    "db",
    "database",
  ]);
  if (localHosts.has(host)) return false;

  // Docker ağındaki kısa servis adları (nokta içermeyen) yerel sayılır.
  if (!host.includes(".")) return false;

  return true;
}

/**
 * Seed çalışabilir mi?
 *
 * @param env Genellikle `process.env`. Test edilebilirlik için parametre.
 */
export function checkSeedGuard(env: NodeJS.ProcessEnv = process.env): SeedGuardVerdict {
  const override = env.ALLOW_PRODUCTION_SEED?.trim();
  const isProdNodeEnv = env.NODE_ENV === "production";
  const isRemote = looksLikeRemoteDatabase(env.DATABASE_URL);

  if (!isProdNodeEnv && !isRemote) {
    return { allowed: true, reason: "yerel veritabanı" };
  }

  const trigger = isProdNodeEnv
    ? "NODE_ENV=production"
    : "DATABASE_URL uzak bir sunucuyu gösteriyor";

  if (override === PRODUCTION_SEED_OVERRIDE) {
    return {
      allowed: true,
      reason: `${trigger}, ama ALLOW_PRODUCTION_SEED açıkça verilmiş`,
    };
  }

  return {
    allowed: false,
    reason:
      `${trigger}. Seed demo hesapları BİLİNEN parolayla yeniden kurar ` +
      `(admin@test.com dahil) ve test verisi yazar — üretimde çalıştırılmamalı.\n` +
      `Gerçekten istiyorsanız: ALLOW_PRODUCTION_SEED=${PRODUCTION_SEED_OVERRIDE} npm run db:seed`,
  };
}
