import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Mobil sifirlama KODU (2026-11-22). Kodun satiri bellekte taklit edilir:
 * deneme sayaci `updateMany` kosuluyla artiyor ve testin olctugu sey tam o
 * kosul (sinirin ustune cikilamamasi).
 */
type CodeRow = {
  email: string;
  codeHash: string;
  attempts: number;
  windowStartedAt: Date;
  windowFailures: number;
  expires: Date;
};
type Where = Record<string, unknown>;

const { db, mail } = vi.hoisted(() => {
  const codes = new Map<string, CodeRow>();
  const user = { id: "u1", email: "ada@example.com", role: "GUEST", isBanned: false, tokenVersion: 3 };

  /** Servisin kullandigi kosul bicimleri: esitlik, `lt`, `in`. */
  const matches = (r: CodeRow, where: Where) =>
    Object.entries(where).every(([k, v]) => {
      const cur = r[k as keyof CodeRow] as unknown;
      if (v && typeof v === "object" && !(v instanceof Date)) {
        const op = v as { lt?: number | Date; in?: unknown[] };
        if (op.in) return op.in.includes(cur);
        if (op.lt !== undefined) return (cur as number | Date) < op.lt;
      }
      return cur === v;
    });
  const apply = (r: CodeRow, data: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(data)) {
      const inc = (v as { increment?: number })?.increment;
      (r as Record<string, unknown>)[k] = inc !== undefined ? (r[k as keyof CodeRow] as number) + inc : v;
    }
  };
  const db = {
    codes,
    user,
    passwordResetCode: {
      findUnique: vi.fn(async ({ where }: { where: { email: string } }) => {
        const r = codes.get(where.email);
        return r ? { ...r } : null;
      }),
      findMany: vi.fn(async ({ where, take }: { where: Where; take: number }) =>
        [...codes.values()].filter((r) => matches(r, where)).slice(0, take).map((r) => ({ email: r.email })),
      ),
      upsert: vi.fn(
        async ({ where, create, update }: { where: { email: string }; create: CodeRow; update: Partial<CodeRow> }) => {
          const prev = codes.get(where.email);
          codes.set(
            where.email,
            prev ? { ...prev, ...update } : { ...create, attempts: create.attempts ?? 0, windowFailures: create.windowFailures ?? 0 },
          );
        },
      ),
      updateMany: vi.fn(async ({ where, data }: { where: Where; data: Record<string, unknown> }) => {
        let count = 0;
        for (const r of codes.values()) {
          if (matches(r, where)) {
            apply(r, data);
            count++;
          }
        }
        return { count };
      }),
      deleteMany: vi.fn(async ({ where }: { where: Where }) => {
        let count = 0;
        for (const r of [...codes.values()]) {
          if (matches(r, where)) {
            codes.delete(r.email);
            count++;
          }
        }
        return { count };
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
const { rateLimit } = vi.hoisted(() => ({
  rateLimit: vi.fn(async (key: string, ..._rest: unknown[]): Promise<boolean> => key.length >= 0),
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit }));
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

/** E-posta atesle-unut gidiyor: mikro gorevler bosalana kadar bekle. */
const flush = () => new Promise((r) => setTimeout(r, 0));

async function issue(email = "  Ada@Example.com "): Promise<string> {
  await requestPasswordReset(email, "tr");
  await flush();
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
  db.user.isBanned = false;
  rateLimit.mockResolvedValue(true);
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

  it("hesap yoksa e-posta gitmez ama AYNI bicimde sahte satir yazilir", async () => {
    await requestPasswordReset("nobody@example.com", "tr");
    await flush();
    expect(mail).not.toHaveBeenCalled();
    const decoy = db.codes.get("nobody@example.com")!;
    expect(decoy.codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(decoy.attempts).toBe(0);
    expect(decoy.expires.getTime() - Date.now()).toBeGreaterThan(29 * 60_000);
  });

  it("eski satirlar istek yolunda sinirli sayida temizlenir; pencere sayaci yasayan satir kalir", async () => {
    const old = new Date(Date.now() - 25 * 3600_000);
    const recent = new Date(Date.now() - 3600_000);
    db.codes.set("old@x.co", { email: "old@x.co", codeHash: "a", attempts: 0, windowStartedAt: old, windowFailures: 9, expires: old });
    db.codes.set("recent@x.co", { email: "recent@x.co", codeHash: "b", attempts: 5, windowStartedAt: recent, windowFailures: 9, expires: recent });
    await requestPasswordReset("nobody@example.com", "tr");
    expect(db.codes.has("old@x.co")).toBe(false);
    expect(db.codes.has("recent@x.co")).toBe(true);
    expect(db.passwordResetCode.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
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

  it("yeni istek KOD sayacini sifirlar ve eski kodu oldurur", async () => {
    const first = await issue();
    for (let i = 0; i < 5; i++) await consumePasswordResetCode(EMAIL, wrongCode(first), NEW_PW);
    const second = await issue();
    if (second !== first) {
      expect((await consumePasswordResetCode(EMAIL, first, NEW_PW)).ok).toBe(false);
    }
    expect((await consumePasswordResetCode(EMAIL, second, NEW_PW)).ok).toBe(true);
  });

  it("24 saatte toplam 10 yanlis: yeni kod istemek daha fazla tahmin VERMEZ", async () => {
    let wrongs = 0;
    let code = "";
    for (let round = 0; round < 4; round++) {
      code = await issue();
      for (let i = 0; i < 5; i++) {
        const r = await consumePasswordResetCode(EMAIL, wrongCode(code), NEW_PW);
        if (r.ok === false && r.code === "TOO_MANY_ATTEMPTS" && i === 0) break;
        wrongs++;
      }
    }
    expect(wrongs).toBe(10);
    // Yeni ve DOGRU kod da pencere bitene kadar kabul edilmez.
    code = await issue();
    expect(await consumePasswordResetCode(EMAIL, code, NEW_PW)).toEqual({ ok: false, code: "TOO_MANY_ATTEMPTS" });
    expect(userApi.update).not.toHaveBeenCalled();

    // Pencere gecince yeniden baslar.
    db.codes.get(EMAIL)!.windowStartedAt = new Date(Date.now() - 25 * 3600_000);
    expect((await consumePasswordResetCode(EMAIL, code, NEW_PW)).ok).toBe(true);
  });

  it("suresi gecmis kod expired_code doner ve silinir", async () => {
    const code = await issue();
    db.codes.get(EMAIL)!.expires = new Date(Date.now() - 1000);
    const r = await confirm({ email: EMAIL, code, newPassword: NEW_PW });
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: "expired_code" });
    // Satir silinmez: 24 saatlik pencere sayaci onunla yasar.
    expect(db.codes.has(EMAIL)).toBe(true);
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

describe("QA: hesap taramasi, yaris ve siralama", () => {
  const UNKNOWN = "nobody@example.com";

  async function outcomes(email: string, code: string) {
    const out: string[] = [];
    for (let i = 0; i < 6; i++) {
      const r = await confirm({ email, code, newPassword: NEW_PW });
      out.push(`${r.status}:${(await r.json()).error}`);
    }
    return out;
  }

  it("gercek ve sahte e-posta ayni yanit dizisini alir (5 yanlis -> 429)", async () => {
    const realCode = await issue();
    await requestPasswordReset(UNKNOWN, "tr");
    const real = await outcomes(EMAIL, wrongCode(realCode));
    const decoy = await outcomes(UNKNOWN, "123456");
    expect(real).toEqual(decoy);
    expect(real).toEqual([
      "400:invalid_code",
      "400:invalid_code",
      "400:invalid_code",
      "400:invalid_code",
      "429:too_many_attempts",
      "429:too_many_attempts",
    ]);
  });

  it("sure dolunca ikisi de expired_code alir", async () => {
    await issue();
    await requestPasswordReset(UNKNOWN, "tr");
    for (const e of [EMAIL, UNKNOWN]) db.codes.get(e)!.expires = new Date(Date.now() - 1000);
    for (const e of [EMAIL, UNKNOWN]) {
      const r = await confirm({ email: e, code: "123456", newPassword: NEW_PW });
      expect([r.status, await r.json()]).toEqual([400, { error: "expired_code" }]);
    }
  });

  it("istek suresi hesabin varligina bagli degil: e-posta gonderimi beklenmez", async () => {
    let release!: () => void;
    mail.mockImplementationOnce(() => new Promise<undefined>((r) => (release = () => r(undefined))));
    // Gonderim takili kalsa bile istek doner.
    await requestPasswordReset(EMAIL, "tr");
    await flush();
    expect(mail).toHaveBeenCalledTimes(1);
    release();
  });

  it("yasakli hesap: yanlis kodla invalid_code (403 SIZMAZ), dogru kodla account_banned", async () => {
    const code = await issue();
    db.user.isBanned = true;
    const wrong = await confirm({ email: EMAIL, code: wrongCode(code), newPassword: NEW_PW });
    expect([wrong.status, await wrong.json()]).toEqual([400, { error: "invalid_code" }]);
    const right = await confirm({ email: EMAIL, code, newPassword: NEW_PW });
    expect([right.status, await right.json()]).toEqual([403, { error: "account_banned" }]);
    expect(userApi.update).not.toHaveBeenCalled();
  });

  it("es zamanli tahminler kod sinirini asamaz (attempts kosulu)", async () => {
    const code = await issue();
    const results = await Promise.all(
      Array.from({ length: 8 }, () => consumePasswordResetCode(EMAIL, wrongCode(code), NEW_PW)),
    );
    const row = db.codes.get(EMAIL)!;
    expect(row.attempts).toBe(5);
    expect(row.windowFailures).toBe(5);
    expect(results.filter((r) => !r.ok && r.code === "TOO_MANY_ATTEMPTS").length).toBeGreaterThanOrEqual(3);
  });

  it("ayni dogru kodla iki es zamanli onay: yalnizca biri basarir", async () => {
    const code = await issue();
    const [a, b] = await Promise.all([
      consumePasswordResetCode(EMAIL, code, NEW_PW),
      consumePasswordResetCode(EMAIL, code, OTHER_PW),
    ]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect([a, b].find((r) => !r.ok)).toEqual({ ok: false, code: "INVALID_CODE" });
    expect(userApi.update).toHaveBeenCalledTimes(1);
  });

  it("onay ucunda e-posta basina hiz siniri var (bilinmeyen e-postada da)", async () => {
    rateLimit.mockImplementation(async (key: string) => !key.startsWith("password_reset_code:email:"));
    for (const e of [EMAIL, UNKNOWN]) {
      const r = await confirm({ email: e, code: "123456", newPassword: NEW_PW });
      expect([r.status, await r.json()]).toEqual([429, { error: "too_many_attempts" }]);
    }
    expect(rateLimit).toHaveBeenCalledWith(`password_reset_code:email:${EMAIL}`, 10, 60 * 60_000);
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
