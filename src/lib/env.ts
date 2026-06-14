import { z } from "zod";

const serverSchema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  AUTH_SECRET: z.string().min(1).optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).optional(),
  RESEND_API_KEY: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  /** production'da varsayılan: Upstash Redis zorunlu. false ise fallback'e izin verir. */
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
  const upstashUrl = e.UPSTASH_REDIS_REST_URL?.trim();
  const upstashToken = e.UPSTASH_REDIS_REST_TOKEN?.trim();
  if ((upstashUrl && !upstashToken) || (!upstashUrl && upstashToken)) {
    throw new Error(
      "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must both be set or both omitted",
    );
  }
  const requireDistributedRateLimit =
    process.env.REQUIRE_DISTRIBUTED_RATE_LIMIT?.trim() !== "false";
  if (requireDistributedRateLimit && (!upstashUrl || !upstashToken)) {
    throw new Error(
      "Distributed rate limit is required in production. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN or explicitly set REQUIRE_DISTRIBUTED_RATE_LIMIT=false",
    );
  }
}
