import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * CI / `npm ci` sırasında `postinstall` → `prisma generate` çalışır; gerçek DB yokken
 * `env("DATABASE_URL")` PrismaConfigEnvError verir. Generate yalnızca client üretir,
 * bağlantı açmaz; bu yüzden yer tutucu URL kabul edilebilir.
 */
const PLACEHOLDER_DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:5432/prisma_generate_placeholder?schema=public";

function datasourceUrl(): string {
  const u = process.env.DATABASE_URL?.trim();
  return u && u.length > 0 ? u : PLACEHOLDER_DATABASE_URL;
}

/**
 * Prisma 7 Yapılandırması
 * Rus-free (driver adapter) mimarisi ile uyumlu yeni konfigürasyon yapısı.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    // Prisma 7+ artık url'i buradan okuyor (schema.prisma yerine)
    url: datasourceUrl(),
  },
});
