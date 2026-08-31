import { z } from "zod";
import { isDistributedRateLimitRequired } from "@/lib/rate-limit";

const serverSchema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  AUTH_SECRET: z.string().min(1).optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).optional(),
  RESEND_API_KEY: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  /** `redis://host:6379` — rate limit için. Compose'da `redis://redis:6379`. */
  REDIS_URL: z.string().optional(),
  /** production'da varsayılan: Redis zorunlu. false ise in-memory fallback'e izin verir. */
  REQUIRE_DISTRIBUTED_RATE_LIMIT: z.string().optional(),
  BOOKING_CALENDAR_TIMEZONE: z.string().optional(),
  LEGAL_TERMS_VERSION: z.string().optional(),
  LEGAL_PRIVACY_VERSION: z.string().optional(),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  ENABLE_HSTS_HEADERS: z.string().optional(),
  DATABASE_SSL: z.string().optional(),
  PG_POOL_MAX: z.string().optional(),
  LOG_LEVEL: z.string().optional(),
  APP_VERSION: z.string().optional(),
  OBSERVABILITY_SERVICE_NAME: z.string().optional(),
  /**
   * Aktif ödeme sağlayıcısı. Tanımsızsa "manual" (dükkanda tahsilat).
   * Bilinmeyen bir değerde sistem sessizce manual'a düşmez, atar —
   * bkz. `src/lib/payments/index.ts`. Ayrıntı: docs/PAYMENTS.md
   */
  PAYMENT_PROVIDER: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    console.warn("[env] validation warnings:", parsed.error.flatten());
  }
  cached = parsed.success ? parsed.data : (process.env as unknown as ServerEnv);
  return cached;
}

export function requireProdSecrets(): void {
  if (process.env.NODE_ENV !== "production") return;
  const e = getServerEnv();
  if (!e.AUTH_SECRET?.trim()) {
    throw new Error("AUTH_SECRET is required in production");
  }
  if (e.AUTH_SECRET.trim().length < 32) {
    throw new Error(
      "AUTH_SECRET must be at least 32 characters in production",
    );
  }
  const authLower = e.AUTH_SECRET.toLowerCase();
  if (
    authLower.includes("docker-dev-change-me") ||
    authLower.includes("change-me-use-openssl")
  ) {
    throw new Error(
      "AUTH_SECRET must not use the default docker-compose placeholder in production",
    );
  }
  if (!e.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is required in production");
  }
  const hasGoogleOAuth =
    process.env.GOOGLE_CLIENT_ID?.trim() &&
    process.env.GOOGLE_CLIENT_SECRET?.trim();
  const hasAppleOAuth =
    process.env.APPLE_ID?.trim() && process.env.APPLE_SECRET?.trim();
  if (
    (hasGoogleOAuth || hasAppleOAuth) &&
    !process.env.AUTH_PUBLIC_HOST?.trim()
  ) {
    throw new Error(
      "AUTH_PUBLIC_HOST is required in production when OAuth providers are configured",
    );
  }
  const redisUrl = e.REDIS_URL?.trim();
  const requireDistributedRateLimit = isDistributedRateLimitRequired();
  if (requireDistributedRateLimit && !redisUrl) {
    throw new Error(
      "Distributed rate limit is required in production. Set REDIS_URL or explicitly set REQUIRE_DISTRIBUTED_RATE_LIMIT=false",
    );
  }
}
