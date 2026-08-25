import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Muhur talebi yasam dongusu — web action'i ve mobil ucun ORTAK govdesi.
 *
 * NEDEN BU DOSYA VAR (2026-08-25): "teslim aldim" iki ayri yerde yaziliydi ve
 * mobil kopya MUHURLERI DUKKANA HIC ATAMIYORDU — yalnizca talebi `DELIVERED`
 * yapiyordu. Esnaf teslim aldigini bildirdikten sonra elinde kullanilabilir muhur
 * olmuyor, check-in "muhur bu dukkana atanmamis" diye reddediyordu. Buradaki ilk
 * test tam olarak o hatayi kilitler.
 */

const { mockPrisma, mockTx, mockNotifications } = vi.hoisted(() => {
  const mockTx = {
    sealRequest: { update: vi.fn() },
    seal: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
  return {
    mockTx,
    mockPrisma: {
      sealRequest: { findUnique: vi.fn(), create: vi.fn() },
      shop: { findFirst: vi.fn() },
      seal: { updateMany: vi.fn() },
      $transaction: vi.fn(async (fn: (tx: typeof mockTx) => unknown) => fn(mockTx)),
    },
    mockNotifications: { sendEmail: vi.fn(), sendSms: vi.fn() },
  };
});

vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/services/NotificationService", () => ({ notificationService: mockNotifications }));

import {
  createSealRequest,
  confirmSealDelivery,
  shipSealRequest,
} from "@/services/seal/requests";

const PARTNER = { id: "owner-1", role: "PARTNER" as const };
const ADMIN = { id: "admin-1", role: "ADMIN" as const };

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockTx) => unknown) => fn(mockTx));
  mockTx.seal.updateMany.mockResolvedValue({ count: 0 });
  mockTx.seal.findMany.mockResolvedValue([]);
});

describe("confirmSealDelivery", () => {
  const shipped = {
    id: "r1",
    shopId: "shop-1",
    status: "SHIPPED",
    quantity: 20,
    serialFrom: null,
    serialTo: null,
    shop: { ownerId: "owner-1" },
  };

  it("durumu DELIVERED yapar VE mühürleri dükkana atar — mobil uç atamıyordu", async () => {
    mockPrisma.sealRequest.findUnique.mockResolvedValue(shipped);
    mockTx.seal.findMany.mockResolvedValue([{ serialNumber: 1 }, { serialNumber: 2 }]);
    mockTx.seal.updateMany.mockResolvedValue({ count: 2 });

    const result = await confirmSealDelivery("r1", PARTNER);

    expect(result).toEqual({ ok: true, assignedCount: 2 });
    // Durum ve atama AYNI transaction'da: ayrilirlarsa "teslim alindi ama muhur yok".
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockTx.sealRequest.update.mock.calls[0][0].data.status).toBe("DELIVERED");
    const assign = mockTx.seal.updateMany.mock.calls[0][0];
    expect(assign.data).toMatchObject({ shopId: "shop-1", status: "ASSIGNED" });
  });

  it("admin seri aralığı bildirdiyse tam o aralığı atar", async () => {
    mockPrisma.sealRequest.findUnique.mockResolvedValue({
      ...shipped,
      serialFrom: 100,
      serialTo: 119,
    });
    mockTx.seal.updateMany.mockResolvedValue({ count: 20 });

    const result = await confirmSealDelivery("r1", PARTNER);

    expect(result).toEqual({ ok: true, assignedCount: 20 });
    expect(mockTx.seal.updateMany.mock.calls[0][0].where.serialNumber).toEqual({
      gte: 100,
      lte: 119,
    });
    // Yalnizca STOK'takiler: yeniden calistirmak baska dukkanin muhrunu calmaz.
    expect(mockTx.seal.updateMany.mock.calls[0][0].where.status).toBe("STOCK");
  });

  it("başka bir esnafın talebine dokunamaz", async () => {
    mockPrisma.sealRequest.findUnique.mockResolvedValue({
      ...shipped,
      shop: { ownerId: "baska-owner" },
    });
    expect(await confirmSealDelivery("r1", PARTNER)).toEqual({ ok: false, code: "FORBIDDEN" });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("DELIVERED bir talep TEKRAR onaylanabilir — eksik atamayı kurtarma yolu", async () => {
    mockPrisma.sealRequest.findUnique.mockResolvedValue({ ...shipped, status: "DELIVERED" });
    mockTx.seal.findMany.mockResolvedValue([{ serialNumber: 5 }]);
    mockTx.seal.updateMany.mockResolvedValue({ count: 1 });

    expect(await confirmSealDelivery("r1", PARTNER)).toEqual({ ok: true, assignedCount: 1 });
  });

  it("PENDING talep teslim alınamaz", async () => {
    mockPrisma.sealRequest.findUnique.mockResolvedValue({ ...shipped, status: "PENDING" });
    expect(await confirmSealDelivery("r1", PARTNER)).toEqual({
      ok: false,
      code: "REQUEST_NOT_SHIPPED",
    });
  });

  it("stokta mühür yoksa başarılı döner ama sayı 0'dır", async () => {
    // Hata degil (talep gercekten teslim alindi) ama esnaf muhursuz kalir;
    // servis bunu `warn` ile loglar, cagiran sayidan anlar.
    mockPrisma.sealRequest.findUnique.mockResolvedValue(shipped);
    mockTx.seal.findMany.mockResolvedValue([]);

    expect(await confirmSealDelivery("r1", PARTNER)).toEqual({ ok: true, assignedCount: 0 });
  });
});

describe("createSealRequest", () => {
  beforeEach(() => {
    mockPrisma.shop.findFirst.mockResolvedValue({ id: "shop-1" });
    mockPrisma.sealRequest.create.mockResolvedValue({ id: "r-new" });
  });

  it("talebi kimin açtığını yazar — mobil uç boş bırakıyordu", async () => {
    const result = await createSealRequest("shop-1", 25, PARTNER);

    expect(result).toEqual({ ok: true, requestId: "r-new" });
    expect(mockPrisma.sealRequest.create.mock.calls[0][0].data).toMatchObject({
      shopId: "shop-1",
      quantity: 25,
      status: "PENDING",
      requestedBy: "owner-1",
      autoGenerated: false,
    });
  });

  it("esnaf yalnızca KENDİ dükkanı için açabilir", async () => {
    await createSealRequest("shop-1", 10, PARTNER);
    expect(mockPrisma.shop.findFirst.mock.calls[0][0].where.ownerId).toBe("owner-1");

    vi.clearAllMocks();
    mockPrisma.shop.findFirst.mockResolvedValue({ id: "shop-1" });
    mockPrisma.sealRequest.create.mockResolvedValue({ id: "r-new" });
    await createSealRequest("shop-1", 10, ADMIN);
    // Admin icin sahiplik kosulu YOK.
    expect(mockPrisma.shop.findFirst.mock.calls[0][0].where.ownerId).toBeUndefined();
  });

  it("geçersiz adedi reddeder — mobil uç hiç doğrulamıyordu", async () => {
    for (const q of [0, -5, 10_001, 2.5, Number.NaN]) {
      expect(await createSealRequest("shop-1", q, PARTNER), String(q)).toEqual({
        ok: false,
        code: "INVALID_QUANTITY",
      });
    }
    expect(mockPrisma.sealRequest.create).not.toHaveBeenCalled();
  });

  it("otomatik talep aynı yoldan geçer, işareti korunur", async () => {
    await createSealRequest("shop-1", 30, { id: "system", role: "ADMIN" }, { autoGenerated: true });
    expect(mockPrisma.sealRequest.create.mock.calls[0][0].data).toMatchObject({
      autoGenerated: true,
      requestedBy: "system",
    });
  });
});

describe("shipSealRequest", () => {
  it("takip numarası olmadan kargolamaz", async () => {
    expect(await shipSealRequest({ requestId: "r1", trackingNumber: "  " })).toEqual({
      ok: false,
      code: "TRACKING_REQUIRED",
    });
  });

  it("ters seri aralığını reddeder", async () => {
    expect(
      await shipSealRequest({
        requestId: "r1",
        trackingNumber: "TR1",
        serialFrom: 200,
        serialTo: 100,
      }),
    ).toEqual({ ok: false, code: "INVALID_SERIAL_RANGE" });
  });

  it("yalnızca PENDING talep kargolanır", async () => {
    mockPrisma.sealRequest.findUnique.mockResolvedValue({
      status: "SHIPPED",
      quantity: 10,
      shop: { name: "D", owner: { email: null, phone: null } },
    });
    expect(await shipSealRequest({ requestId: "r1", trackingNumber: "TR1" })).toEqual({
      ok: false,
      code: "REQUEST_NOT_PENDING",
    });
  });
});
