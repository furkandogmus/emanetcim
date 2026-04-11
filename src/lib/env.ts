import { z } from "zod";

const serverSchema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  AUTH_SECRET: z.string().min(1).optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).optional(),
  /** `false` iken ödeme/iade/webhook işlenmez; üretimde IYZICO zorunluluğu da kalkar. */
  PAYMENTS_ENABLED: z.string().optional(),
  IYZICO_API_KEY: z.string().optional(),
  IYZICO_SECRET_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  IYZICO_WEBHOOK_SECRET: z.string().optional(),
  PAYMENT_GATEWAY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SIGNING_SECRET: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  /** Stripe.js (Payment Element); yalnızca istemci — `NEXT_PUBLIC_` öneki zorunlu. */
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  /** production: true iken Upstash Redis zorunlu (çoklu instance rate limit). */
  REQUIRE_DISTRIBUTED_RATE_LIMIT: z.string().optional(),
  BOOKING_CALENDAR_TIMEZONE: z.string().optional(),
  LEGAL_TERMS_VERSION: z.string().optional(),
  LEGAL_PRIVACY_VERSION: z.string().optional(),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  ENABLE_HSTS_HEADERS: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.string().optional(),
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

function isPlaceholderIyzico(key: string | undefined): boolean {
  if (!key?.trim()) return false;
  const k = key.trim().toLowerCase();
  return (
    k.includes("placeholder") ||
    k.includes("your_api_key") ||
    k.includes("your_secret") ||
    k === "ci-placeholder-not-for-production"
  );
}

export function requireProdSecrets(): void {
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.IYZICO_WEBHOOK_ALLOW_UNSIGNED === "true") {
    throw new Error(
      "IYZICO_WEBHOOK_ALLOW_UNSIGNED must not be set to true in production"
    );
  }
  const e = getServerEnv();
  if (!e.AUTH_SECRET?.trim()) {
    throw new Error("AUTH_SECRET is required in production");
  }
  if (e.AUTH_SECRET.trim().length < 32) {
    throw new Error(
      "AUTH_SECRET must be at least 32 characters in production",
    );
  }
  if (!e.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is required in production");
  }
  const paymentsDisabled = process.env.PAYMENTS_ENABLED?.trim() === "false";
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
  if (!paymentsDisabled) {
    const gateway = process.env.PAYMENT_GATEWAY?.trim().toLowerCase() || "iyzico";
    if (gateway === "stripe") {
      if (!e.STRIPE_SECRET_KEY?.trim()) {
        throw new Error(
          "STRIPE_SECRET_KEY is required in production when payments are enabled and PAYMENT_GATEWAY=stripe"
        );
      }
      const wh =
        e.STRIPE_WEBHOOK_SIGNING_SECRET?.trim() || e.STRIPE_WEBHOOK_SECRET?.trim();
      if (!wh) {
        throw new Error(
          "STRIPE_WEBHOOK_SIGNING_SECRET (or STRIPE_WEBHOOK_SECRET) is required in production when PAYMENT_GATEWAY=stripe"
        );
      }
    } else {
      if (!e.IYZICO_API_KEY?.trim()) {
        throw new Error("IYZICO_API_KEY is required in production when payments are enabled");
      }
      if (!e.IYZICO_SECRET_KEY?.trim()) {
        throw new Error("IYZICO_SECRET_KEY is required in production when payments are enabled");
      }
      // GitHub Actions vb. CI ortamında kasıtlı placeholder anahtarlar kullanılabilir.
      if (
        process.env.CI !== "true" &&
        (isPlaceholderIyzico(e.IYZICO_API_KEY) ||
          isPlaceholderIyzico(e.IYZICO_SECRET_KEY))
      ) {
        throw new Error(
          "IYZICO_API_KEY / IYZICO_SECRET_KEY must not use placeholder values in production",
        );
      }
    }
  }
  const upstashUrl = e.UPSTASH_REDIS_REST_URL?.trim();
  const upstashToken = e.UPSTASH_REDIS_REST_TOKEN?.trim();
  if ((upstashUrl && !upstashToken) || (!upstashUrl && upstashToken)) {
    throw new Error(
      "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must both be set or both omitted",
    );
  }
  if (
    process.env.REQUIRE_DISTRIBUTED_RATE_LIMIT?.trim() === "true" &&
    (!upstashUrl || !upstashToken)
  ) {
    throw new Error(
      "REQUIRE_DISTRIBUTED_RATE_LIMIT=true requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in production",
    );
  }
}
