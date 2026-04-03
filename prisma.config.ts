import "dotenv/config";
import { defineConfig, env } from "prisma/config";

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
    url: env("DATABASE_URL"),
  },
});
