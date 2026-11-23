import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

/**
 * Iki admin varken birbirini dusuren iki onay ayni anda calisirsa sistemde
 * admin kalmamali. Sahte veritabani Postgres SSI'nin bu durumdaki davranisini
 * taklit eder: Serializable islem, baslangicindan sonra baskasi commit ettiyse
 * P2034 ile reddedilir; READ COMMITTED ise iki yazimi da kabul eder.
 */

type User = { id: string; role: "ADMIN" | "PARTNER" | "GUEST" };
type Req = { id: string; targetUserId: string; previousRole: User["role"]; requestedRole: User["role"]; requestedByUserId: string };

const fake = vi.hoisted(() => {
  const state = { version: 0, users: new Map<string, User>(), requests: new Map<string, Req>() };
  type S = typeof state;
  const clone = (s: S): S => ({
    version: s.version,
    users: new Map([...s.users].map(([k, v]) => [k, { ...v }])),
    requests: new Map([...s.requests].map(([k, v]) => [k, { ...v }])),
  });
  const client = (s: S, touched?: { users: Set<string>; deleted: Set<string> }) => ({
    user: {
      findUnique: async ({ where }: { where: { id: string } }) => (s.users.get(where.id) ? { ...s.users.get(where.id)! } : null),
      count: async ({ where }: { where: { role: string } }) => [...s.users.values()].filter((u) => u.role === where.role).length,
      update: async ({ where, data }: { where: { id: string }; data: { role: User["role"] } }) => {
        s.users.get(where.id)!.role = data.role;
        touched?.users.add(where.id);
        return s.users.get(where.id);
      },
    },
    adminRoleChangeRequest: {
      findUnique: async ({ where }: { where: { id: string } }) => (s.requests.get(where.id) ? { ...s.requests.get(where.id)! } : null),
      delete: async ({ where }: { where: { id: string } }) => {
        s.requests.delete(where.id);
        touched?.deleted.add(where.id);
        return {};
      },
    },
  });
  return { state, clone, client };
});

vi.mock("@/lib/db", () => {
  const { state, clone, client } = fake;
  return {
    default: {
      ...client(state),
      $transaction: async (fn: (tx: unknown) => Promise<unknown>, opts?: { isolationLevel?: string }) => {
        const start = state.version;
        const work = clone(state);
        const touched = { users: new Set<string>(), deleted: new Set<string>() };
        const result = await fn(client(work, touched));
        // Iki islem de okuyup yazdiktan sonra commit etsin (es zamanlilik penceresi).
        await new Promise((r) => setTimeout(r, 5));
        const wrote = touched.users.size > 0 || touched.deleted.size > 0;
        if (wrote && opts?.isolationLevel === "Serializable" && state.version !== start) {
          throw new Prisma.PrismaClientKnownRequestError("write conflict", { code: "P2034", clientVersion: "x" });
        }
        for (const id of touched.users) state.users.set(id, { ...work.users.get(id)! });
        for (const id of touched.deleted) state.requests.delete(id);
        if (wrote) state.version++;
        return result;
      },
    },
  };
});

const actors = vi.hoisted(() => ({ queue: [] as string[] }));
vi.mock("@/lib/action-auth", () => ({ assertAdmin: vi.fn(async () => ({ id: actors.queue.shift(), role: "ADMIN" })) }));
vi.mock("@/lib/client-ip", () => ({ getClientIpOrNull: vi.fn(async () => null) }));
vi.mock("@/lib/revalidate-locales", () => ({ revalidatePathAllLocales: vi.fn() }));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: vi.fn() }));
vi.mock("next-intl/server", () => ({ getLocale: vi.fn(async () => "tr") }));
vi.mock("@/services/ShopService", () => ({ shopService: {} }));
vi.mock("@/services/ReviewService", () => ({ reviewService: {} }));
vi.mock("@/services/BookingService", () => ({ bookingService: {} }));
// Govde `AdminUserService.approveRoleChange`ta: gercek servis, sahte veritabaniyla kosar.
vi.mock("@/lib/mail", () => ({ sendVerificationEmail: vi.fn() }));
vi.mock("@/services/auth/password-reset", () => ({ requestPasswordReset: vi.fn() }));

import { approveAdminRoleChangeAction } from "@/actions/admin-management";

beforeEach(() => {
  fake.state.version = 0;
  fake.state.users = new Map([
    ["A", { id: "A", role: "ADMIN" }],
    ["B", { id: "B", role: "ADMIN" }],
  ]);
  fake.state.requests = new Map([
    ["r1", { id: "r1", targetUserId: "A", previousRole: "ADMIN", requestedRole: "PARTNER", requestedByUserId: "B" }],
    ["r2", { id: "r2", targetUserId: "B", previousRole: "ADMIN", requestedRole: "PARTNER", requestedByUserId: "A" }],
  ]);
});

describe("approveAdminRoleChangeAction es zamanli onay", () => {
  it("birbirini dusuren iki onay ayni anda gelince bir admin kalir", async () => {
    // r1'i A onaylar (isteyen B), r2'yi B onaylar (isteyen A): ikisi de kendi istegini onaylamiyor.
    actors.queue = ["A", "B"];
    const results = await Promise.all([approveAdminRoleChangeAction("r1"), approveAdminRoleChangeAction("r2")]);

    const admins = [...fake.state.users.values()].filter((u) => u.role === "ADMIN");
    expect(admins).toHaveLength(1);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results).toContainEqual({ ok: false, error: "cannot_demote_sole_admin" });
    // Gecersizlesen istek de temizlenir.
    expect(fake.state.requests.size).toBe(0);
  });

  it("istegi acan admin kendi istegini onaylayamaz", async () => {
    actors.queue = ["B"];
    await expect(approveAdminRoleChangeAction("r1")).resolves.toEqual({ ok: false, error: "cannot_self_approve" });
    expect(fake.state.users.get("A")?.role).toBe("ADMIN");
    expect(fake.state.requests.has("r1")).toBe(true);
  });

  it("tek onay normal uygulanir", async () => {
    actors.queue = ["A"];
    await expect(approveAdminRoleChangeAction("r1")).resolves.toEqual({ ok: true });
    expect(fake.state.users.get("A")?.role).toBe("PARTNER");
  });
});
