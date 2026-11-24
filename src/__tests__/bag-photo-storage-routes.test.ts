import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { S3Storage } from "@/lib/storage/s3";

/** Ozel nesnenin herkese acik adresi yok; imzali adres 5 dk; mobil uclar goruntulemede yazmaz. */
describe("S3Storage: ozel onek", () => {
  const s3 = new S3Storage({
    bucket: "media-test",
    region: "eu-central-1",
    accessKeyId: "AKIDEXAMPLE",
    secretAccessKey: "secret-example",
    publicBaseUrl: "https://media-test.s3.example",
  });

  it("bag-photos/ icin publicUrl firlatir, shops/ icin uretir", () => {
    expect(() => s3.publicUrl("bag-photos/b1/x.jpg")).toThrow("private_object_has_no_public_url");
    expect(s3.publicUrl("shops/s1/x.jpg")).toBe("https://media-test.s3.example/shops/s1/x.jpg");
  });

  it("imzali GET adresi istenen sureyle sinirli ve onbellege kapali", async () => {
    const url = new URL(await s3.presignGet("bag-photos/b1/x.jpg", 300));
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
    expect(url.searchParams.get("X-Amz-Signature")).toBeTruthy();
    expect(url.searchParams.get("response-cache-control")).toBe("private, no-store");
    expect(url.pathname).toContain("bag-photos/b1/x.jpg");
  });

  it("putPrivate ozel onek disina yazmaz", async () => {
    await expect(s3.putPrivate({ key: "shops/s1/x.jpg", body: new Uint8Array([1]), contentType: "image/jpeg" })).rejects.toThrow(
      "private_put_requires_private_prefix",
    );
  });
});

const m = vi.hoisted(() => ({
  requireMobileUser: vi.fn(),
  list: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("@/lib/mobile-auth", async (orig) => ({
  ...(await orig<typeof import("@/lib/mobile-auth")>()),
  requireMobileUser: m.requireMobileUser,
}));
vi.mock("@/services/BagPhotoService", () => ({ bagPhotoService: { list: m.list, upload: m.upload, remove: m.remove } }));

import * as listRoute from "@/app/api/mobile/bookings/[id]/bag-photos/route";
import * as photoRoute from "@/app/api/mobile/bookings/[id]/bag-photos/[photoId]/route";

const ctx = { params: Promise.resolve({ id: "b1" }) };
const req = (method: string, body?: BodyInit) =>
  new NextRequest("http://localhost/api/mobile/bookings/b1/bag-photos", { method, body });

describe("mobil uclar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("goruntuleme oturumu GET yapar, POST/DELETE 403 ve servis cagrilmaz", async () => {
    m.requireMobileUser.mockResolvedValue({ user: { id: "g", role: "GUEST", email: null, impersonatedBy: "a" } });
    m.list.mockResolvedValue({ ok: true, photos: [], canUpload: false, canDelete: false, maxPhotos: 3, storageReady: true });
    expect((await listRoute.GET(req("GET"), ctx))!.status).toBe(200);
    expect((await listRoute.POST(req("POST", new FormData()), ctx))!.status).toBe(403);
    expect((await photoRoute.DELETE(req("DELETE"), { params: Promise.resolve({ id: "b1", photoId: "p1" }) }))!.status).toBe(403);
    expect(m.upload).not.toHaveBeenCalled();
    expect(m.remove).not.toHaveBeenCalled();
  });

  it("servis kodlari HTTP durumuna cevrilir; yanit onbellege alinmaz", async () => {
    m.requireMobileUser.mockResolvedValue({ user: { id: "x", role: "PARTNER", email: null } });
    m.list.mockResolvedValueOnce({ ok: false, reason: "forbidden" });
    expect((await listRoute.GET(req("GET"), ctx))!.status).toBe(403);
    m.list.mockResolvedValueOnce({ ok: true, photos: [], canUpload: true, canDelete: true, maxPhotos: 3, storageReady: true });
    const ok = await listRoute.GET(req("GET"), ctx);
    expect(ok!.headers.get("cache-control")).toBe("private, no-store");
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }), "bag.jpg");
    m.upload.mockResolvedValueOnce({ ok: false, reason: "locked" });
    expect((await listRoute.POST(req("POST", form), ctx))!.status).toBe(409);
    m.upload.mockResolvedValueOnce({ ok: false, reason: "rate_limited" });
    expect((await listRoute.POST(req("POST", form), ctx))!.status).toBe(429);
  });

  it("dosyasiz POST 400", async () => {
    m.requireMobileUser.mockResolvedValue({ user: { id: "x", role: "PARTNER", email: null } });
    expect((await listRoute.POST(req("POST", new FormData()), ctx))!.status).toBe(400);
  });
});
