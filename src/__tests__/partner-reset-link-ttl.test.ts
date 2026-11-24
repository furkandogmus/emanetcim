import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    verificationToken: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/lib/site-urls", () => ({ getSiteBaseUrl: () => "https://example.test" }));

import {
  PARTNER_RESET_TTL_MS,
  PASSWORD_RESET_TTL_MS,
  generatePasswordResetToken,
} from "../lib/password-reset-token";
import { createPartnerResetLink } from "../lib/partner-reset-link";

describe("sifre sifirlama baginin omru", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.verificationToken.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.verificationToken.create.mockImplementation(async ({ data }) => data);
  });

  it("admin'in esnafa ilettigi bag 72 saat gecerlidir", async () => {
    const before = Date.now();
    const link = await createPartnerResetLink("5551112233");
    const ttl = link.expiresAt.getTime() - before;
    expect(PARTNER_RESET_TTL_MS).toBe(72 * 60 * 60 * 1000);
    expect(ttl).toBeGreaterThanOrEqual(PARTNER_RESET_TTL_MS);
    expect(ttl).toBeLessThan(PARTNER_RESET_TTL_MS + 5_000);
  });

  it("e-postayla istenen sifirlama bagi 1 saat kalir", async () => {
    const before = Date.now();
    const row = await generatePasswordResetToken("a@b.co");
    const ttl = row.expires.getTime() - before;
    expect(ttl).toBeGreaterThanOrEqual(PASSWORD_RESET_TTL_MS);
    expect(ttl).toBeLessThan(PASSWORD_RESET_TTL_MS + 5_000);
  });
});
