import { describe, it, expect } from "vitest";
import { disputeErrorKey } from "@/lib/dispute-error-copy";

/**
 * `createDisputeAction` basarisizlikta "Errors.x" anahtari doner. Cevrilmeden
 * gosterilirse ekranda birebir "Errors.duplicateDispute" gibi bir anahtar
 * yazardi (bkz. action-error.ts'teki ayni sinif duzeltme).
 */
describe("disputeErrorKey", () => {
  it("bilinen Errors.* anahtarindan on eki siyirir", () => {
    expect(disputeErrorKey("Errors.duplicateDispute")).toBe("duplicateDispute");
    expect(disputeErrorKey("Errors.disputeNotReady")).toBe("disputeNotReady");
    expect(disputeErrorKey("Errors.authRequired")).toBe("authRequired");
    expect(disputeErrorKey("Errors.unauthorized")).toBe("unauthorized");
  });

  it("bilinmeyen veya ham metni generic'e dusurur", () => {
    expect(disputeErrorKey("Errors.somethingNew")).toBe("generic");
    expect(disputeErrorKey("boom")).toBe("generic");
    expect(disputeErrorKey("")).toBe("generic");
  });
});
