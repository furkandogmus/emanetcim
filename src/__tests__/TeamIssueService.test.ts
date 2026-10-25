import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const tx = {
    teamIssue: {
      create: vi.fn(),
      update: vi.fn(),
    },
    teamIssueImage: {
      create: vi.fn(),
    },
    teamIssueEvent: {
      create: vi.fn(),
    },
  };
  return {
    mockPrisma: {
      teamIssue: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: tx.teamIssue.create,
        update: tx.teamIssue.update,
        delete: vi.fn(),
      },
      teamIssueImage: {
        create: tx.teamIssueImage.create,
      },
      teamIssueEvent: {
        create: tx.teamIssueEvent.create,
      },
      $transaction: vi.fn(async (arg: unknown) => {
        if (typeof arg === "function") {
          return (arg as (client: typeof tx) => unknown)(tx);
        }
        if (Array.isArray(arg)) {
          return Promise.all(arg);
        }
        return undefined;
      }),
    },
  };
});

vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/lib/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/storage")>();
  return {
    ...actual,
    isStorageConfigured: () => false,
  };
});

import {
  teamIssueService,
  TeamIssueValidationError,
} from "@/services/TeamIssueService";

/** 1x1 geçerli PNG baytları */
const TINY_PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
  0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TeamIssueService", () => {
  it("yeni sorun oluşturur ve created etkinliğini kaydeder", async () => {
    mockPrisma.teamIssue.create.mockResolvedValue({
      id: 7,
      title: "Ödeme adımında sayfa donuyor",
      createdBy: "Berat",
      status: "open",
    });

    const result = await teamIssueService.createIssue(
      "  Ödeme adımında sayfa donuyor  ",
      "Berat",
    );

    expect(result).toEqual({ id: 7 });
    expect(mockPrisma.teamIssue.create).toHaveBeenCalledWith({
      data: {
        title: "Ödeme adımında sayfa donuyor",
        createdBy: "Berat",
        status: "open",
      },
    });
    expect(mockPrisma.teamIssueEvent.create).toHaveBeenCalledWith({
      data: {
        issueId: 7,
        userName: "Berat",
        action: "created",
      },
    });
  });

  it("Berat veya Furkan dışındaki kullanıcıyı reddeder", async () => {
    await expect(
      teamIssueService.createIssue("Test sorun", "Misafir"),
    ).rejects.toBeInstanceOf(TeamIssueValidationError);
  });

  it("sorun durumunu çözüldü olarak günceller ve etkinlik yazar", async () => {
    mockPrisma.teamIssue.findUnique.mockResolvedValue({
      id: 3,
      photos: [],
    });

    const res = await teamIssueService.updateStatus(3, "Furkan", "resolve");
    expect(res).toEqual({ ok: true, status: "resolved" });
    expect(mockPrisma.teamIssue.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { status: "resolved" },
    });
    expect(mockPrisma.teamIssueEvent.create).toHaveBeenCalledWith({
      data: {
        issueId: 3,
        userName: "Furkan",
        action: "resolved",
      },
    });
  });

  it("fotoğraf ve açıklamayı doğrular ve kaydeder", async () => {
    mockPrisma.teamIssue.findUnique.mockResolvedValue({
      id: 5,
      photos: [],
    });

    const res = await teamIssueService.saveDetails({
      issueId: 5,
      user: "Berat",
      description: "Mobilde harita pini kayıyor.",
      photos: [TINY_PNG],
    });

    expect(res).toEqual({ ok: true, photos_added: 1 });
    expect(mockPrisma.teamIssueImage.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.teamIssue.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { description: "Mobilde harita pini kayıyor." },
    });
  });
});
