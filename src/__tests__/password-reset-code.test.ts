import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Mobil sifirlama KODU (2026-11-22). Kodun satiri bellekte taklit edilir:
 * deneme sayaci `updateMany` kosuluyla artiyor ve testin olctugu sey tam o
 * kosul (sinirin ustune cikilamamasi).
 */
type CodeRow = { email: string; codeHash: string; attempts: number; expires: Date };

const { db, mail } = vi.hoisted(() => {
  const codes = new Map<string, CodeRow>();
  const user = { id: "u1", email: "ada@example.com", role: "GUEST", isBanned: false, tokenVersion: 3 };
  const db = {
    codes,
    user,
    passwordResetCode: {
      findUnique: vi.fn(async ({ where }: { where: { email: string } }) => {
        const r = codes.get(where.email);
        return r ? { ...r } : null;
      }),
      upsert: vi.fn(async ({ where, create, update }: { where: { email: string }; create: CodeRow; update: Partial<CodeRow> }) => {
        const prev = codes.get(where.email);
        codes.set(where.email, prev ? { ...prev, ...update } : { ...create });
      }),
      updateMany: vi.fn(
        async ({ where, data }: { where: { email: string; codeHash: string; attempts: { lt: number } }; data: unknown }) => {
          void data;
          const r = codes.get(where.email);
          if (!r || r.codeHash !== where.codeHash || !(r.attempts < where.attempts.lt)) return { count: 0 };
          r.attempts += 1;
          return { count: 1 };
        },
      ),
      deleteMany: vi.fn(async ({ where }: { where: { email: string } }) => {
        const had = codes.delete(where.email);
        return { count: had ? 1 : 0 };
      }),
    },
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
    verificationToken: {
      findUnique: vi.fn(),
      findFirst: vi.fn(async () => null),
      create: vi.fn(async ({ data }: { data: { token: string } }) => data),
      delete: vi.fn(),
      deleteMany: vi.fn(async () => ({ count: 1 })),
    },
    mobilePushToken: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    booking: { findMany: vi.fn(async () => []), updateMany: vi.fn() },
  };
  return { db, mail: vi.fn(async () => undefined) };
});

const userApi = {
  findUnique: vi.fn(async ({ where }: { where: { email?: string; id?: string } }) => {
    if (where.email && where.email !== db.user.email) return null;
    return { ...db.user, emailVerified: new Date() };
  }),
  update: vi.fn(async () => {
    db.user.tokenVersion += 1;
    return { tokenVersion: db.user.tokenVersion };
  }),
  updateMany: vi.fn(async () => ({ count: 0 })),
};

vi.mock("@/lib/db", () => ({ default: { ...db, user: userApi } }));
vi.mock("@/lib/mail", () => ({ sendPasswordResetEmail: mail }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(async () => true) }));
vi.mock("@/lib/auth-password", () => ({
  hashPassword: vi.fn(async (p: string) => `hash:${p}`),
  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 128,
}));
vi.stubEnv("AUTH_SECRET", "test-secret-for-reset-codes");

const { requestPasswordReset, consumePasswordResetCode, consumePasswordResetToken } = await import(
  "@/services/auth/password-reset"
);
const { POST } = await import("@/app/api/mobile/auth/password-reset/confirm-code/route");
const { hashPasswordResetCode } = await import("@/lib/password-reset-code");

const EMAIL = "ada@example.com";
// Sahte test sifreleri (tarayicilar sabit dizeyi sir saniyor).
const NEW_PW = "n".repeat(12);
const OTHER_PW = "o".repeat(12);

async function issue(): Promise<string> {
  await requestPasswordReset("  Ada@Example.com ", "tr");
  const call = mail.mock.calls.at(-1) as unknown as [string, string, string, string];
  return call[3];
}

function wrongCode(code: string): string {
  return code === "000000" ? "111111" : "000000";
}

function confirm(body: unknown) {
  return POST(
    new NextRequest("http://localhost/api/mobile/auth/password-reset/confirm-code", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  db.codes.clear();
  vi.clearAllMocks();
});

describe("sifirlama kodu: istek", () => {
  it("ayni e-posta bagi VE 6 haneli kodu tasir; yalnizca hash saklanir", async () => {
    const code = await issue();
    expect(code).toMatch(/^\d{6}$/);
    expect(mail).toHaveBeenCalledWith(EMAIL, expect.any(String), "tr", code);
    const row = db.codes.get(EMAIL)!;
    expect(row.codeHash).not.toContain(code);
    expect(row.codeHash).toBe(hashPasswordResetCode(EMAIL, code));
    const ttl = row.expires.getTime() - Date.now();
    expect(ttl).toBeGreaterThan(29 * 60_000);
    expect(ttl).toBeLessThanOrEqual(30 * 60_000);
  });

  it("hesap yoksa kod uretilmez, e-posta gitmez", async () => {
    await requestPasswordReset("nobody@example.com", "tr");
    expect(mail).not.toHaveBeenCalled();
    expect(db.codes.size).toBe(0);
  });
});

describe("sifirlama kodu: onay", () => {
  it("dogru kod sifreyi yazar, oturumlari dusurur ve token cifti doner", async () => {
    const code = await issue();
    const before = db.user.tokenVersion;
    const res = await confirm({ email: EMAIL, code, newPassword: NEW_PW });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      success: true,
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      // `/auth/session` ile ayni DTO.
      user: expect.objectContaining({ id: "u1", email: EMAIL, emailVerified: true }),
    });
    expect(userApi.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { passwordHash: `hash:${NEW_PW}`, tokenVersion: { increment: 1 } } }),
    );
    expect(db.user.tokenVersion).toBe(before + 1);
    // Bag de olur: ayni istegin web bagi artik kullanilamaz.
    expect(db.verificationToken.deleteMany).toHaveBeenCalledWith({ where: { identifier: `password-reset:${EMAIL}` } });
    expect(db.mobilePushToken.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } });
    // Dogrulanmis e-posta sayilir: hesapsiz rezervasyon baglama calisir.
    expect(userApi.updateMany).toHaveBeenCalledWith({
      where: { id: "u1", emailVerified: null },
      data: { emailVerified: expect.any(Date) },
    });
    expect(db.booking.findMany).toHaveBeenCalled();
  });

  it("basaridan sonra ayni kod tekrar kullanilamaz", async () => {
    const code = await issue();
    expect((await confirm({ email: EMAIL, code, newPassword: NEW_PW })).status).toBe(200);
    const again = await confirm({ email: EMAIL, code, newPassword: OTHER_PW });
    expect(again.status).toBe(400);
    expect(await again.json()).toEqual({ error: "invalid_code" });
  });

  it("4 yanlis invalid_code, 5. yanlis too_many_attempts; sonra dogru kod da olu", async () => {
    const code = await issue();
    for (let i = 0; i < 4; i++) {
      const r = await confirm({ email: EMAIL, code: wrongCode(code), newPassword: NEW_PW });
      expect(r.status).toBe(400);
      expect(await r.json()).toEqual({ error: "invalid_code" });
    }
    const fifth = await confirm({ email: EMAIL, code: wrongCode(code), newPassword: NEW_PW });
    expect(fifth.status).toBe(429);
    expect(await fifth.json()).toEqual({ error: "too_many_attempts" });

    const correct = await confirm({ email: EMAIL, code, newPassword: NEW_PW });
    expect(correct.status).toBe(429);
    expect(await correct.json()).toEqual({ error: "too_many_attempts" });
    expect(userApi.update).not.toHaveBeenCalled();
  });

  it("yeni istek sayaci sifirlar ve eski kodu oldurur", async () => {
    const first = await issue();
    for (let i = 0; i < 5; i++) await consumePasswordResetCode(EMAIL, wrongCode(first), NEW_PW);
    const second = await issue();
    if (second !== first) {
      expect((await consumePasswordResetCode(EMAIL, first, NEW_PW)).ok).toBe(false);
    }
    expect((await consumePasswordResetCode(EMAIL, second, NEW_PW)).ok).toBe(true);
  });

  it("suresi gecmis kod expired_code doner ve silinir", async () => {
    const code = await issue();
    db.codes.get(EMAIL)!.expires = new Date(Date.now() - 1000);
    const r = await confirm({ email: EMAIL, code, newPassword: NEW_PW });
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: "expired_code" });
    expect(db.codes.has(EMAIL)).toBe(false);
  });

  it("bekleyen sifirlama yoksa not_found DEGIL invalid_code (hesap taramasi yok)", async () => {
    const r = await confirm({ email: "nobody@example.com", code: "123456", newPassword: NEW_PW });
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: "invalid_code" });
  });

  it("kisa sifre invalid_password doner ve denemeyi YAKMAZ", async () => {
    const code = await issue();
    const r = await confirm({ email: EMAIL, code, newPassword: "kisa" });
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: "invalid_password" });
    expect(db.codes.get(EMAIL)!.attempts).toBe(0);
  });

  it("bicimsiz kod invalid_code", async () => {
    await issue();
    const r = await confirm({ email: EMAIL, code: "12ab56", newPassword: NEW_PW });
    expect(await r.json()).toEqual({ error: "invalid_code" });
  });
});

describe("bag yolu hala calisiyor", () => {
  it("e-posta bagi sifreyi yazar ve ayni istegin kodunu da oldurur", async () => {
    await issue();
    db.verificationToken.findUnique.mockResolvedValueOnce({
      token: "tok",
      identifier: `password-reset:${EMAIL}`,
      expires: new Date(Date.now() + 60_000),
    });
    const result = await consumePasswordResetToken("tok", NEW_PW);
    expect(result).toEqual({ ok: true, userId: "u1" });
    expect(db.codes.has(EMAIL)).toBe(false);
    // Bagla sifirlama da e-posta kaniti: dogrulama + baglama calisir.
    expect(userApi.updateMany).toHaveBeenCalled();
  });

  it("telefon bagi e-postayi dogrulanmis SAYMAZ", async () => {
    db.verificationToken.findUnique.mockResolvedValueOnce({
      token: "tok",
      identifier: "password-reset:phone:5551112233",
      expires: new Date(Date.now() + 60_000),
    });
    userApi.findUnique.mockResolvedValueOnce({ ...db.user, emailVerified: new Date() });
    const result = await consumePasswordResetToken("tok", NEW_PW);
    expect(result.ok).toBe(true);
    expect(userApi.updateMany).not.toHaveBeenCalled();
    expect(db.booking.findMany).not.toHaveBeenCalled();
  });
});
