import { describe, it, expect, vi } from "vitest";

/** Kodla giris dogrulanmamis e-postayi isaretler; dolu alana dokunmaz. */
const { mockPrisma } = vi.hoisted(() => ({ mockPrisma: { user: { updateMany: vi.fn() } } }));
vi.mock("@/lib/db", () => ({ default: mockPrisma }));

import { markEmailVerifiedByCode } from "@/services/auth/verify-email";

describe("markEmailVerifiedByCode", () => {
  it("yalnızca boş emailVerified alanını doldurur", async () => {
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });
    await markEmailVerifiedByCode("u1");
    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: "u1", emailVerified: null },
      data: { emailVerified: expect.any(Date) },
    });
  });
});
