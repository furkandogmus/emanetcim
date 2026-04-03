import { z } from "zod";

const serverSchema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  AUTH_SECRET: z.string().min(1).optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).optional(),
  IYZICO_API_KEY: z.string().optional(),
  IYZICO_SECRET_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  IYZICO_WEBHOOK_SECRET: z.string().optional(),
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
  if (!e.IYZICO_API_KEY?.trim()) {
    throw new Error("IYZICO_API_KEY is required in production");
  }
  if (!e.IYZICO_SECRET_KEY?.trim()) {
    throw new Error("IYZICO_SECRET_KEY is required in production");
  }
}
