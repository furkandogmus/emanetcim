import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockRecord, mockNotifyAdmins } = vi.hoisted(() => ({
  mockRecord: vi.fn().mockResolvedValue(undefined),
  mockNotifyAdmins: vi.fn().mockResolvedValue(undefined),
  mockPrisma: {
    booking: { findUnique: vi.fn() },
    dispute: { findUnique: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/services/BookingEventService", () => ({
  bookingEventService: { record: mockRecord },
}));
vi.mock("@/services/NotificationService", () => ({
  notificationService: { notifyAdminsForDispute: mockNotifyAdmins },
}));

import { disputeService } from "@/services/DisputeService";

const INPUT = {
  bookingId: "b1",
  guestId: "g1",
  reason: "THEFT" as const,
  description: "Valizim eksik geldi.",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.booking.findUnique.mockResolvedValue({
    id: "b1", guestId: "g1", status: "CHECKED_OUT",
  });
  mockPrisma.dispute.findUnique.mockResolvedValue(null);
  mockPrisma.dispute.create.mockResolvedValue({ id: "d1" });
});

/**
 * Uyuşmazlık açma. Gövde iki taşıyıcının ORTAK yeri; mobil uç daha önce
 * yalnızca kaydı oluşturuyor, iz ve bildirimi atlıyordu.
 */
describe("uyuşmazlık açma", () => {
  it("kaydı oluşturur, İZ düşer ve ADMİNLERE HABER VERİR", async () => {
    /*
      Asil kusur buydu: mobil ucta bir HIRSIZLIK sikayeti aciliyor, kimseye
      haber gitmiyor ve rezervasyonun zaman cizelgesinde iz kalmiyordu. Sikayet
      biri /admin/disputes sayfasini acana kadar sessizce bekliyordu.
    */
    const res = await disputeService.create(INPUT);
    expect(res).toEqual({ ok: true, id: "d1" });
    expect(mockNotifyAdmins).toHaveBeenCalledWith({ bookingId: "b1", reason: "THEFT" });
    expect(mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: "b1", event: "DISPUTED", actorRole: "GUEST" }),
    );
  });

  it("BAŞKASININ rezervasyonuna şikâyet açtırmaz", async () => {
    mockPrisma.booking.findUnique.mockResolvedValue({
      id: "b1", guestId: "baskasi", status: "CHECKED_OUT",
    });
    const res = await disputeService.create(INPUT);
    expect(res).toEqual({ ok: false, reason: "not_owner" });
    expect(mockPrisma.dispute.create).not.toHaveBeenCalled();
  });

  it("olmayan rezervasyonu AYRI bir sebeple reddeder", async () => {
    // `not_found` 404, `not_owner` 403 uretiyor -- ayrimi cagiran yapar.
    mockPrisma.booking.findUnique.mockResolvedValue(null);
    expect(await disputeService.create(INPUT)).toEqual({ ok: false, reason: "not_found" });
  });

  it("valiz TESLİM ALINMADAN şikâyet açtırmaz", async () => {
    for (const status of ["PENDING", "PAID", "APPROVED", "CANCELLED", "WAITING_APPROVAL"]) {
      vi.clearAllMocks();
      mockPrisma.booking.findUnique.mockResolvedValue({ id: "b1", guestId: "g1", status });
      const res = await disputeService.create(INPUT);
      expect(res, status).toEqual({ ok: false, reason: "booking_not_ready" });
    }
  });

  it("aynı rezervasyona İKİNCİ şikâyeti reddeder", async () => {
    mockPrisma.dispute.findUnique.mockResolvedValue({ id: "d0" });
    expect(await disputeService.create(INPUT)).toEqual({ ok: false, reason: "duplicate" });
    expect(mockPrisma.dispute.create).not.toHaveBeenCalled();
  });

  it("yarışta ikinci istek de duplicate döner, patlamaz", async () => {
    // `Dispute.bookingId` @unique: es zamanli iki istekte biri buraya duser.
    mockPrisma.dispute.create.mockRejectedValue(Object.assign(new Error("x"), { code: "P2002" }));
    expect(await disputeService.create(INPUT)).toEqual({ ok: false, reason: "duplicate" });
  });

  it("bildirim hatası ŞİKÂYETİ düşürmez", async () => {
    /*
      Sikayetin KAYDEDILMESI, bildiriminin gonderilmesine bagli olmamali:
      saglayici dususe gecerse misafirin sikayeti kaybolmamali.
    */
    mockNotifyAdmins.mockRejectedValue(new Error("resend down"));
    const res = await disputeService.create(INPUT);
    expect(res).toEqual({ ok: true, id: "d1" });
  });
});
