import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mobil kodla giris: tek aktif kod, hash'li saklama, kod ve kimlik basina
 * deneme siniri, ADMIN reddi, Play inceleme kodu. `mobileLoginCode` tablosu
 * bellekte taklit edilir ki sayaclar gercekten birikir.
 */
type Row = {
  identity: string;
  codeHash: string;
  attempts: number;
  windowStartedAt: Date;
  windowFailures: number;
  expires: Date;
};

const { rows, mockUser, mockLogger } = vi.hoisted(() => ({
  rows: new Map<string, Row>(),
  mockUser: { findUnique: vi.fn(), findFirst: vi.fn() },
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

function matches(r: Row, where: Record<string, unknown>): boolean {
  if (where.identity !== undefined && typeof where.identity === "string" && r.identity !== where.identity) return false;
  if (where.codeHash !== undefined && r.codeHash !== where.codeHash) return false;
  const lt = (v: unknown) => (v as { lt: number | Date }).lt;
  if (where.attempts && !(r.attempts < (lt(where.attempts) as number))) return false;
  if (where.windowFailures && !(r.windowFailures < (lt(where.windowFailures) as number))) return false;
  if (where.windowStartedAt && !(r.windowStartedAt < (lt(where.windowStartedAt) as Date))) return false;
  if (where.expires && !(r.expires < (lt(where.expires) as Date))) return false;
  return true;
}

function apply(r: Row, data: Record<string, unknown>) {
  for (const [k, v] of Object.entries(data)) {
    const key = k as keyof Row;
    if (v && typeof v === "object" && "increment" in (v as object)) {
      (r[key] as number) += (v as { increment: number }).increment;
    } else {
      (r as Record<string, unknown>)[key] = v;
    }
  }
}

vi.mock("@/lib/db", () => ({
  default: {
    user: mockUser,
    mobileLoginCode: {
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async ({ where }: { where: { identity: string } }) => {
        const r = rows.get(where.identity);
        return r ? { ...r } : null;
      }),
      upsert: vi.fn(async ({ where, create, update }: { where: { identity: string }; create: Omit<Row, "attempts" | "windowFailures"> & Partial<Row>; update: Partial<Row> }) => {
        const r = rows.get(where.identity);
        if (r) apply(r, update);
        else rows.set(where.identity, { attempts: 0, windowFailures: 0, ...create });
      }),
      updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        let count = 0;
        for (const r of rows.values()) {
          if (matches(r, where)) {
            apply(r, data);
            count++;
          }
        }
        return { count };
      }),
      deleteMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        let count = 0;
        for (const [k, r] of rows) {
          if (matches(r, where)) {
            rows.delete(k);
            count++;
          }
        }
        return { count };
      }),
    },
  },
}));
vi.mock("@/lib/logger", () => ({ default: mockLogger }));

vi.stubEnv("AUTH_SECRET", "test-secret-for-login-codes");

import {
  issueMobileLoginCode,
  verifyMobileLoginCode,
  MOBILE_LOGIN_CODE_MAX_ATTEMPTS,
  MOBILE_LOGIN_CODE_WINDOW_MAX_FAILURES,
} from "@/services/auth/mobile-login-code";

const ID = "guest@example.com";
const GUEST = { id: "u1", role: "GUEST", reviewSandbox: false };

async function issue(identity = ID): Promise<string> {
  const r = await issueMobileLoginCode(identity, "email");
  if (r.kind !== "deliver") throw new Error(`expected deliver, got ${r.kind}`);
  return r.code;
}
function wrong(code: string): string {
  return code === "000000" ? "000001" : "000000";
}

beforeEach(() => {
  rows.clear();
  vi.clearAllMocks();
  mockUser.findUnique.mockResolvedValue(GUEST);
  vi.unstubAllEnvs();
  vi.stubEnv("AUTH_SECRET", "test-secret-for-login-codes");
});

describe("issueMobileLoginCode", () => {
  it("kimlik basina tek aktif kod: yeni istek eskisini gecersiz kilar", async () => {
    const first = await issue();
    const second = await issue();
    expect(rows.size).toBe(1);
    if (first !== second) {
      expect(await verifyMobileLoginCode(ID, "email", first)).toEqual({ ok: false, code: "INVALID_CODE" });
    }
    expect(await verifyMobileLoginCode(ID, "email", second)).toEqual({ ok: true, user: GUEST });
  });

  it("kod duz saklanmaz", async () => {
    const code = await issue();
    const row = rows.get(ID)!;
    expect(row.codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.codeHash).not.toContain(code);
  });

  it("yeni istek kod sayacini sifirlar ama 24 saatlik pencere sayacini korur", async () => {
    const code = await issue();
    await verifyMobileLoginCode(ID, "email", wrong(code));
    await verifyMobileLoginCode(ID, "email", wrong(code));
    await issue();
    expect(rows.get(ID)).toMatchObject({ attempts: 0, windowFailures: 2 });
  });

  it("ADMIN hesabina kod uretilmez; ayni yanit bicimi, eslesmeyen satir", async () => {
    mockUser.findUnique.mockResolvedValue({ id: "a1", role: "ADMIN", reviewSandbox: false });
    expect(await issueMobileLoginCode(ID, "email")).toEqual({ kind: "suppressed" });
    expect(rows.get(ID)?.codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(mockLogger.warn).toHaveBeenCalledWith({ userId: "a1" }, "mobile_otp_admin_refused");
  });

  it("Play inceleme sabit kodu yalnizca reviewSandbox ve ADMIN olmayan hesaba", async () => {
    vi.stubEnv("PLAY_REVIEW_EMAIL", ID);
    vi.stubEnv("PLAY_REVIEW_OTP", "246810");

    mockUser.findUnique.mockResolvedValue({ ...GUEST, reviewSandbox: true });
    expect(await issueMobileLoginCode(ID, "email")).toEqual({ kind: "review" });
    expect(mockLogger.info).toHaveBeenCalledWith({ userId: "u1" }, "mobile_otp_play_review_code_issued");

    mockUser.findUnique.mockResolvedValue(GUEST);
    expect((await issueMobileLoginCode(ID, "email")).kind).toBe("deliver");
    expect(mockLogger.warn).toHaveBeenCalledWith({ userId: "u1" }, "mobile_otp_play_review_not_sandbox");

    mockUser.findUnique.mockResolvedValue({ id: "a1", role: "ADMIN", reviewSandbox: true });
    expect(await issueMobileLoginCode(ID, "email")).toEqual({ kind: "suppressed" });
  });
});

describe("verifyMobileLoginCode", () => {
  it("dogru kod bir kez tuketilir", async () => {
    const code = await issue();
    expect(await verifyMobileLoginCode(ID, "email", code)).toEqual({ ok: true, user: GUEST });
    expect(await verifyMobileLoginCode(ID, "email", code)).toEqual({ ok: false, code: "INVALID_CODE" });
  });

  it("kod basina 5 yanlis: besinci TOO_MANY_ATTEMPTS ve dogru kod da artik gecmez", async () => {
    const code = await issue();
    for (let i = 1; i < MOBILE_LOGIN_CODE_MAX_ATTEMPTS; i++) {
      expect(await verifyMobileLoginCode(ID, "email", wrong(code))).toEqual({ ok: false, code: "INVALID_CODE" });
    }
    expect(await verifyMobileLoginCode(ID, "email", wrong(code))).toEqual({ ok: false, code: "TOO_MANY_ATTEMPTS" });
    expect(await verifyMobileLoginCode(ID, "email", code)).toEqual({ ok: false, code: "TOO_MANY_ATTEMPTS" });
  });

  it("kimlik basina pencere: yeni kod istemek 10 yanlistan sonra deneme kazandirmaz", async () => {
    let code = await issue();
    let failures = 0;
    while (failures < MOBILE_LOGIN_CODE_WINDOW_MAX_FAILURES) {
      if (rows.get(ID)!.attempts >= MOBILE_LOGIN_CODE_MAX_ATTEMPTS - 1) code = await issue();
      await verifyMobileLoginCode(ID, "email", wrong(code));
      failures++;
    }
    code = await issue();
    expect(await verifyMobileLoginCode(ID, "email", code)).toEqual({ ok: false, code: "TOO_MANY_ATTEMPTS" });
  });

  it("es zamanli tahminler kod siniri asamaz", async () => {
    const code = await issue();
    const results = await Promise.all(
      Array.from({ length: 20 }, () => verifyMobileLoginCode(ID, "email", wrong(code))),
    );
    expect(rows.get(ID)!.attempts).toBeLessThanOrEqual(MOBILE_LOGIN_CODE_MAX_ATTEMPTS);
    expect(results.every((r) => !r.ok)).toBe(true);
  });

  it("suresi dolan ve hic olmayan kod ayni INVALID_CODE (kahin yok)", async () => {
    expect(await verifyMobileLoginCode("nobody@example.com", "email", "123456")).toEqual({
      ok: false,
      code: "INVALID_CODE",
    });
    const code = await issue();
    rows.get(ID)!.expires = new Date(Date.now() - 1000);
    expect(await verifyMobileLoginCode(ID, "email", code)).toEqual({ ok: false, code: "INVALID_CODE" });
  });

  it("bicimsiz kod deneme yakmaz", async () => {
    await issue();
    expect(await verifyMobileLoginCode(ID, "email", "12ab56")).toEqual({ ok: false, code: "INVALID_CODE" });
    expect(rows.get(ID)!.attempts).toBe(0);
  });

  it("kod admin olmadan once istendiyse de ADMIN kodla giremez; kod tuketilir", async () => {
    const code = await issue();
    mockUser.findUnique.mockResolvedValue({ id: "a1", role: "ADMIN", reviewSandbox: false });
    expect(await verifyMobileLoginCode(ID, "email", code)).toEqual({ ok: false, code: "ADMIN_OTP_DISABLED" });
    expect(rows.has(ID)).toBe(false);
  });

  it("Play inceleme kodu ayni sayaclara tabi ve her giris loglanir", async () => {
    vi.stubEnv("PLAY_REVIEW_EMAIL", ID);
    vi.stubEnv("PLAY_REVIEW_OTP", "246810");
    mockUser.findUnique.mockResolvedValue({ ...GUEST, reviewSandbox: true });
    await issueMobileLoginCode(ID, "email");
    for (let i = 0; i < MOBILE_LOGIN_CODE_MAX_ATTEMPTS; i++) await verifyMobileLoginCode(ID, "email", "111111");
    expect(await verifyMobileLoginCode(ID, "email", "246810")).toEqual({ ok: false, code: "TOO_MANY_ATTEMPTS" });

    rows.clear();
    await issueMobileLoginCode(ID, "email");
    expect((await verifyMobileLoginCode(ID, "email", "246810")).ok).toBe(true);
    expect(mockLogger.info).toHaveBeenCalledWith({ userId: "u1" }, "mobile_otp_play_review_login");
  });

  it("hesap yoksa ok + user null (cagiran misafir hesabi acar)", async () => {
    mockUser.findUnique.mockResolvedValue(null);
    const code = await issue();
    expect(await verifyMobileLoginCode(ID, "email", code)).toEqual({ ok: true, user: null });
  });
});
