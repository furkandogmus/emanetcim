import { describe, it, expect, vi, beforeEach } from "vitest";

/** Web "olarak goruntule": liste hedefin gozuyle okunur ama salt okunur; yazma action'lari kapali. */
const m = vi.hoisted(() => ({ session: vi.fn(), requireUser: vi.fn(), list: vi.fn(), upload: vi.fn(), inScope: [] as boolean[] }));
vi.mock("@/lib/action-auth", () => ({ actionSession: m.session, requireUser: m.requireUser }));
vi.mock("@/lib/client-ip", () => ({ getClientIpOrNull: async () => null }));
vi.mock("@/services/BagPhotoService", () => ({ bagPhotoService: { list: m.list, upload: m.upload, remove: vi.fn() } }));
vi.mock("@/lib/impersonation-read-scope", async (orig) => {
  const real = await orig<typeof import("@/lib/impersonation-read-scope")>();
  return {
    ...real,
    asImpersonationRead: <T,>(fn: () => Promise<T>) =>
      real.asImpersonationRead(async () => {
        m.inScope.push(real.inImpersonationReadScope());
        return fn();
      }),
  };
});

import { listBagPhotosAction, uploadBagPhotoAction } from "@/actions/bag-photos";

const BOOKING = "11111111-1111-4111-8111-111111111111";

describe("bag-photos web action'lari", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.inScope = [];
    m.list.mockResolvedValue({ ok: true, photos: [], canUpload: false, canDelete: false, maxPhotos: 3, storageReady: true });
  });

  it("liste okuma kapsaminda calisir ve goruntulemede aktoru salt okunur isaretler", async () => {
    m.session.mockResolvedValue({ user: { id: "guest", role: "GUEST" }, impersonation: { adminId: "admin", expiresAt: "x" } });
    const r = await listBagPhotosAction(BOOKING);
    expect(r.success).toBe(true);
    expect(m.inScope).toEqual([true]);
    expect(m.list).toHaveBeenCalledWith({ id: "guest", role: "GUEST", impersonatedBy: "admin" }, BOOKING);
  });

  it("oturumsuz liste auth; normal oturumda impersonatedBy yok", async () => {
    m.session.mockResolvedValueOnce(null);
    expect(await listBagPhotosAction(BOOKING)).toEqual({ success: false, code: "auth" });
    m.session.mockResolvedValueOnce({ user: { id: "guest", role: "GUEST" } });
    await listBagPhotosAction(BOOKING);
    expect(m.list).toHaveBeenCalledWith({ id: "guest", role: "GUEST" }, BOOKING);
  });

  it("yukleme okuma kapsamina alinmadi: goruntulemede requireUser reddeder, servis cagrilmaz", async () => {
    m.requireUser.mockResolvedValue({ ok: false, error: "Errors.unauthorized" });
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array([1])]));
    expect(await uploadBagPhotoAction(BOOKING, form)).toEqual({ success: false, code: "auth" });
    expect(m.upload).not.toHaveBeenCalled();
  });
});
