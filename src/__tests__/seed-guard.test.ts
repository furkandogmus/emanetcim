import { describe, it, expect } from "vitest";
import {
  checkSeedGuard,
  looksLikeRemoteDatabase,
  PRODUCTION_SEED_OVERRIDE,
} from "@/lib/seed-guard";

/**
 * Seed kapısı.
 *
 * Neden test edilir: `prisma/seed.ts` `admin@test.com` hesabını ADMIN rolüyle ve
 * bilinen bir parolayla UPSERT ediyor — `update` bloğu `passwordHash` içerdiği için
 * prod'da parola değiştirilmiş olsa bile seed onu bilinen değere geri döndürür.
 * Kapının yanlış tarafa açılması doğrudan bir güvenlik olayıdır (2026-08-22, P1-24).
 */

const local = "postgresql://u:p@localhost:5432/db";
const remote = "postgresql://u:p@db.example.com:5432/db";

describe("looksLikeRemoteDatabase", () => {
  it.each([
    "postgresql://u:p@localhost:5432/db",
    "postgresql://u:p@127.0.0.1:5432/db",
    "postgresql://u:p@postgres:5432/db",
    "postgresql://u:p@db:5432/db",
    "postgresql://u:p@host.docker.internal:5432/db",
  ])("%s yereldir", (url) => {
    expect(looksLikeRemoteDatabase(url)).toBe(false);
  });

  it.each([
    "postgresql://u:p@db.example.com:5432/db",
    "postgresql://u:p@1.2.3.4:5432/db",
    "postgres://u:p@aws-0-eu-central-1.pooler.supabase.com:6543/postgres",
  ])("%s uzaktır", (url) => {
    expect(looksLikeRemoteDatabase(url)).toBe(true);
  });

  it("tanımsız veya bozuk URL uzak SAYILMAZ — yanlış alarm vermez", () => {
    expect(looksLikeRemoteDatabase(undefined)).toBe(false);
    expect(looksLikeRemoteDatabase("")).toBe(false);
    expect(looksLikeRemoteDatabase("bu bir url degil")).toBe(false);
  });
});

describe("checkSeedGuard", () => {
  it("yerel geliştirmede serbest — günlük iş engellenmez", () => {
    const v = checkSeedGuard({ DATABASE_URL: local } as unknown as NodeJS.ProcessEnv);
    expect(v.allowed).toBe(true);
  });

  it("NODE_ENV=production ise ENGELLER", () => {
    const v = checkSeedGuard({
      NODE_ENV: "production",
      DATABASE_URL: local,
    } as unknown as NodeJS.ProcessEnv);
    expect(v.allowed).toBe(false);
    expect(v.reason).toContain("admin@test.com");
  });

  it("uzak DATABASE_URL'i NODE_ENV tanımsız olsa da ENGELLER", () => {
    // Asil tehlike bu: seed genellikle `tsx` ile elle calistirilir ve NODE_ENV
    // cogu zaman tanimsizdir. Yerel bir kabuktan uzak DB'ye baglanmak.
    const v = checkSeedGuard({ DATABASE_URL: remote } as unknown as NodeJS.ProcessEnv);
    expect(v.allowed).toBe(false);
    expect(v.reason).toContain("uzak");
  });

  it("açık kaçış dizesi verilmişse izin verir", () => {
    const v = checkSeedGuard({
      DATABASE_URL: remote,
      ALLOW_PRODUCTION_SEED: PRODUCTION_SEED_OVERRIDE,
    } as unknown as NodeJS.ProcessEnv);
    expect(v.allowed).toBe(true);
  });

  it("yanlış veya yarım kaçış dizesi işe YARAMAZ", () => {
    for (const bad of ["1", "true", "yes", "yes-i-really-mean-i"]) {
      const v = checkSeedGuard({
        DATABASE_URL: remote,
        ALLOW_PRODUCTION_SEED: bad,
      } as unknown as NodeJS.ProcessEnv);
      expect(v.allowed, `"${bad}" kabul edilmemeli`).toBe(false);
    }
  });

  it("engelleme mesajı NE YAPILACAĞINI söyler", () => {
    const v = checkSeedGuard({ DATABASE_URL: remote } as unknown as NodeJS.ProcessEnv);
    expect(v.allowed).toBe(false);
    expect(v.reason).toContain("ALLOW_PRODUCTION_SEED=");
  });
});
