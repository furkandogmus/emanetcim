import { describe, it, expect, beforeAll } from "vitest";
import { decodeJwt } from "jose";
import { createQrToken, verifyQrToken } from "@/lib/qr-token";

/**
 * QR TOKEN OMRU = CHECK-OUT + 24 SAAT.
 *
 * Olusturma `checkOutTime` gecmiyordu, bu yuzden her token olusturmadan 48 saat
 * sonra bitiyordu: 5 gun sonrasina alinan rezervasyonun bileti teslim gunu
 * "taninmayan kod" veriyordu.
 */
describe("qr token omru", () => {
  beforeAll(() => {
    process.env.AUTH_SECRET = "test-secret-test-secret-test-secret";
  });

  it("5 gun sonraki cikis icin token cikis + 24 saate kadar gecerli", async () => {
    const checkOut = new Date(Date.now() + 5 * 24 * 3600_000);
    const token = await createQrToken({
      bookingId: "b1",
      guestId: "g1",
      shopId: "s1",
      checkOutTime: checkOut.toISOString(),
    });
    const exp = decodeJwt(token).exp! * 1000;
    expect(exp).toBeGreaterThanOrEqual(checkOut.getTime() + 24 * 3600_000 - 2000);
    expect((await verifyQrToken(token))?.bookingId).toBe("b1");
  });

  it("cikis verilmezse en az 48 saat (eski davranis)", async () => {
    const token = await createQrToken({ bookingId: "b1", guestId: "g1", shopId: "s1" });
    const exp = decodeJwt(token).exp! * 1000;
    expect(exp - Date.now()).toBeGreaterThan(47 * 3600_000);
    expect(exp - Date.now()).toBeLessThan(49 * 3600_000);
  });
});
