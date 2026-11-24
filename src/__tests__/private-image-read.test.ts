import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Muhur (`seals/`) ve ekip sorunu (`team-issues/`) fotograflari ozel: kayitli herkese acik
 * adres yalniz yonetici yollarinda 5 dk'lik imzali adrese cevrilir; yabanci adres cizilmez.
 */
const storage = vi.hoisted(() => ({ presignGet: vi.fn(), configured: true }));
const db = vi.hoisted(() => ({
  dispute: { findMany: vi.fn(), findUnique: vi.fn() },
  teamIssue: { findMany: vi.fn() },
}));
vi.mock("@/lib/storage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/storage/image-validation")>("@/lib/storage/image-validation");
  return { ...actual, getStorage: () => storage, isStorageConfigured: () => storage.configured };
});
vi.mock("@/lib/storage/index", () => ({ getStorage: () => storage, isStorageConfigured: () => storage.configured }));
vi.mock("@/lib/db", () => ({ default: db }));
vi.mock("@/services/NotificationService", () => ({ notificationService: {} }));
vi.mock("@/services/BookingEventService", () => ({ bookingEventService: {} }));
vi.mock("@/lib/mobile-auth", () => ({ getMobileSession: vi.fn() }));
const webAuth = vi.hoisted(() => vi.fn());
vi.mock("@/auth", () => ({ auth: webAuth }));

import { PRIVATE_READ_TTL_SECONDS, presignStoredImage, storedObjectKey } from "@/lib/storage/private-read";
import { disputeService } from "@/services/DisputeService";
import { teamIssueService } from "@/services/TeamIssueService";
import { getMobileSession } from "@/lib/mobile-auth";
import * as issuesRoute from "@/app/api/admin/issues/route";

const BASE = "https://media.example.test";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("S3_PUBLIC_BASE_URL", `${BASE}/`);
  storage.configured = true;
  storage.presignGet.mockImplementation(async (key: string) => `${BASE}/${key}?X-Amz-Signature=sig`);
});
afterEach(() => vi.unstubAllEnvs());

describe("storedObjectKey", () => {
  it("kayitli tam adresi ya da anahtari kabul eder, yalniz istenen onekte", () => {
    expect(storedObjectKey(`${BASE}/seals/b1/x.jpg`, "seals/")).toBe("seals/b1/x.jpg");
    expect(storedObjectKey("seals/b1/x.jpg", "seals/")).toBe("seals/b1/x.jpg");
    expect(storedObjectKey(`${BASE}/shops/s1/x.jpg`, "seals/")).toBeNull();
    expect(storedObjectKey(`${BASE}/team-issues/1/x.png`, "seals/")).toBeNull();
    expect(storedObjectKey("https://evil.example/seals/b1/x.jpg", "seals/")).toBeNull();
    expect(storedObjectKey("seals/../shops/x.jpg", "seals/")).toBeNull();
    expect(storedObjectKey(null, "seals/")).toBeNull();
  });
});

describe("presignStoredImage", () => {
  it("bu onekteki nesneyi 5 dk icin imzalar", async () => {
    expect(PRIVATE_READ_TTL_SECONDS).toBe(300);
    const url = await presignStoredImage(`${BASE}/team-issues/7/a.png`, "team-issues/");
    expect(storage.presignGet).toHaveBeenCalledWith("team-issues/7/a.png", 300);
    expect(url).toContain("X-Amz-Signature");
  });

  it("data: gorseli oldugu gibi, yabanci adres ve depolama yokken null", async () => {
    expect(await presignStoredImage("data:image/png;base64,AAAA", "team-issues/")).toBe("data:image/png;base64,AAAA");
    expect(await presignStoredImage("https://evil.example/seals/x.jpg", "seals/")).toBeNull();
    storage.configured = false;
    expect(await presignStoredImage(`${BASE}/seals/b1/x.jpg`, "seals/")).toBeNull();
    expect(storage.presignGet).not.toHaveBeenCalled();
  });

  it("imza duserse gorsel gizlenir, sayfa dusmez", async () => {
    storage.presignGet.mockRejectedValueOnce(new Error("no creds"));
    expect(await presignStoredImage(`${BASE}/seals/b1/x.jpg`, "seals/")).toBeNull();
  });
});

describe("yonetici yollari imzali adres doner", () => {
  const dispute = (photoUrl: string | null) => ({
    id: "d1",
    booking: { id: "b1", seals: [{ id: "s1", sealNumber: 5, bagIndex: 0, bagSize: "M", photoUrl }] },
  });

  it("itiraz listesi ve detayi muhur fotografini imzalar; ham adres disari cikmaz", async () => {
    db.dispute.findMany.mockResolvedValue([dispute(`${BASE}/seals/b1/x.jpg`)]);
    db.dispute.findUnique.mockResolvedValue(dispute(`${BASE}/seals/b1/x.jpg`));
    const [listed] = await disputeService.listForAdmin();
    const one = await disputeService.getForAdmin("d1");
    for (const row of [listed, one!]) {
      expect(row.booking.seals[0].photoUrl).toBe(`${BASE}/seals/b1/x.jpg?X-Amz-Signature=sig`);
    }
    db.dispute.findUnique.mockResolvedValueOnce(null);
    expect(await disputeService.getForAdmin("yok")).toBeNull();
  });

  it("ekip sorunu listesi fotograflari imzalar", async () => {
    db.teamIssue.findMany.mockResolvedValue([
      {
        id: 1, title: "t", description: null, status: "open", createdBy: "Berat", createdAt: new Date(),
        photos: [{ id: "p", imageUrl: `${BASE}/team-issues/1/a.png`, uploadedBy: "Berat", createdAt: new Date() }],
        events: [],
      },
    ]);
    const [issue] = await teamIssueService.listIssues();
    expect(issue.photos[0].image_path).toBe(`${BASE}/team-issues/1/a.png?X-Amz-Signature=sig`);
  });

  it("ekip sorunu ucu yonetici degilse 401 ve hicbir sey imzalanmaz", async () => {
    vi.mocked(getMobileSession).mockResolvedValue(null);
    webAuth.mockResolvedValue({ user: { id: "u", role: "PARTNER" } });
    const res = await issuesRoute.GET();
    expect(res.status).toBe(401);
    expect(db.teamIssue.findMany).not.toHaveBeenCalled();
    expect(storage.presignGet).not.toHaveBeenCalled();
  });
});
