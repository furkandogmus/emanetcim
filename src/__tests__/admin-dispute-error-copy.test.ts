import { describe, it, expect } from "vitest";
import { adminDisputeErrorKey } from "@/lib/admin-dispute-error-copy";

/**
 * `updateDisputeStatusAction` basarisizlikta "Errors.x" anahtari doner.
 * Cevrilmeden gosterilirse toast'ta birebir "Hata: Errors.unauthorized"
 * yazardi (bkz. guest tarafindaki ayni sinif duzeltme: dispute-error-copy.ts).
 */
describe("adminDisputeErrorKey", () => {
  it("bilinen Errors.* anahtarindan on eki siyirir", () => {
    expect(adminDisputeErrorKey("Errors.unauthorized")).toBe("unauthorized");
    expect(adminDisputeErrorKey("Errors.invalidData")).toBe("invalidData");
  });

  it("bilinmeyen veya ham metni generic'e dusurur", () => {
    expect(adminDisputeErrorKey("Errors.somethingNew")).toBe("generic");
    expect(adminDisputeErrorKey("boom")).toBe("generic");
    expect(adminDisputeErrorKey("")).toBe("generic");
  });
});
