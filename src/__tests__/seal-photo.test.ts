import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseCheckInSeals } from "@/lib/seal-payload";

const { mockPut } = vi.hoisted(() => ({ mockPut: vi.fn() }));
vi.mock("@/lib/db", () => ({ default: {} }));
vi.mock("@/lib/storage", async (orig) => {
  const actual = await orig<typeof import("@/lib/storage")>();
  return {
    ...actual,
    getStorage: () => ({
      put: mockPut,
      remove: vi.fn(),
      publicUrl: (k: string) => `https://cdn.test/${k}`,
      capabilities: { id: "test", servesPublicUrls: true },
    }),
  };
});

import { sealService } from "@/services/SealService";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...Array(20).fill(0)]);

beforeEach(() => {
  vi.clearAllMocks();
  mockPut.mockImplementation(async ({ key }: { key: string }) => ({
    key, url: `https://cdn.test/${key}`,
  }));
});

/**
 * Mühür kanıt fotoğrafı. Uyuşmazlıkta esnafın elindeki kanıt bu; mühür valizin
 * AÇILMADIĞINI gösterir ama HANGİ DURUMDA geldiğini göstermez.
 */
describe("kanıt fotoğrafı adresi İSTEMCİDEN GELEMEZ", () => {
  it("check-in şeması fotoğraf adresini kabul etmez", () => {
    /*
      Asil guvenlik karari bu. Adres istemciden gelseydi esnaf oraya istedigi
      gorselin adresini yazabilir ve uyusmazlikta "kanit" diye gosterilen sey
      onun sectigi bir dosya olurdu. Sema onu tasimiyor; adresi SUNUCU uretiyor.
    */
    const parsed = parseCheckInSeals({
      sealAssignments: [{ sealNumber: 1, bagIndex: 0, bagSize: "S" }],
      faultySealNumbers: [],
      sealPhotoUrl: "https://saldirgan.example/temiz-valiz.jpg",
    });
    expect(parsed.ok).toBe(true);
    expect(parsed.ok && parsed.value).not.toHaveProperty("sealPhotoUrl");
  });
});

describe("kanıt fotoğrafı yükleme", () => {
  it("doğrulanmış türle yükler ve adresi döndürür", async () => {
    const res = await sealService.uploadSealPhoto({ bookingId: "b1", bytes: JPEG });
    expect(res).toEqual({ ok: true, url: expect.stringContaining("https://cdn.test/seals/b1/") });
    // Tur SUNUCUDA belirleniyor.
    expect(mockPut).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: "image/jpeg" }),
    );
  });

  it("GÖRSEL OLMAYAN dosyayı depolamaya HİÇ yazmaz", async () => {
    const html = new Uint8Array([...Buffer.from("<html><script>x</script>")]);
    const res = await sealService.uploadSealPhoto({ bookingId: "b1", bytes: html });
    expect(res).toEqual({ ok: false, reason: "unsupported_type" });
    expect(mockPut).not.toHaveBeenCalled();
  });

  it("her yükleme AYRI anahtar üretir — üzerine yazmaz", async () => {
    /*
      Anahtar cakissaydi ikinci check-in birincinin kanitini SILERDI. Uyusmazlik
      kaniti uzerine yazilabilir olmamali.
    */
    const a = await sealService.uploadSealPhoto({ bookingId: "b1", bytes: JPEG });
    const b = await sealService.uploadSealPhoto({ bookingId: "b1", bytes: JPEG });
    expect(a.ok && b.ok && a.url).not.toBe(b.ok && b.url);
  });
});

describe("kanıt fotoğrafı ZİNCİRİN SONUNA ulaşıyor", () => {
  it("`applyCheckInWithinTx` adresi İLK valizin satırına yazar", async () => {
    /*
      R9'da olculen kusur buydu: `check-in.ts` bu alana SABIT `null` geciyordu,
      yani `BookingSeal.photoUrl` uretimde HICBIR ZAMAN dolmuyordu. Zincirin son
      halkasi burasi.

      Fotograf yalnizca ILK valize yaziliyor: tek cekimde birden fazla valiz
      gorunur ve ayni gorseli her satira kopyalamak, olmayan bir kaniti varmis
      gibi gostermek olurdu.
    */
    const createMany = vi.fn().mockResolvedValue({ count: 2 });
    const tx = {
      seal: {
        updateMany: vi.fn().mockResolvedValue({ count: 2 }),
        findMany: vi.fn().mockResolvedValue([
          { serialNumber: 1, shopId: "s1", status: "ASSIGNED" },
          { serialNumber: 2, shopId: "s1", status: "ASSIGNED" },
        ]),
      },
      bookingSeal: { createMany },
    };

    await sealService.applyCheckInWithinTx(tx as never, {
      shopId: "s1",
      bookingId: "b1",
      assignments: [
        { sealNumber: 1, bagIndex: 0, bagSize: "S" },
        { sealNumber: 2, bagIndex: 1, bagSize: "M" },
      ],
      faultySealNumbers: [],
      sealPhotoUrl: "https://cdn.test/seals/b1/foto.jpg",
    });

    const rows = createMany.mock.calls[0][0].data;
    expect(rows[0].photoUrl).toBe("https://cdn.test/seals/b1/foto.jpg");
    expect(rows[1].photoUrl).toBeNull();
  });

  it("fotoğraf YOKSA check-in yine tamamlanır", async () => {
    // Zorunlu kilmak, kamerasi calismayan esnafin valizi hic teslim alamamasi
    // demek olurdu -- kanit toplamak iyidir, isi durdurmak degil.
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const tx = {
      seal: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findMany: vi.fn().mockResolvedValue([{ serialNumber: 9, shopId: "s1", status: "ASSIGNED" }]),
      },
      bookingSeal: { createMany },
    };
    await sealService.applyCheckInWithinTx(tx as never, {
      shopId: "s1", bookingId: "b2",
      assignments: [{ sealNumber: 9, bagIndex: 0, bagSize: "S" }],
      faultySealNumbers: [], sealPhotoUrl: null,
    });
    expect(createMany.mock.calls[0][0].data[0].photoUrl).toBeNull();
  });
});
