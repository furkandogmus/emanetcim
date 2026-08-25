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

  it("requireAdmin()'in donebildigi authRequired/notAuthorizedAdmin'i generic'e dusurmez", () => {
    // src/lib/action-auth.ts::requireAdmin() -- oturum yoksa/admin degilse
    expect(adminDisputeErrorKey("Errors.authRequired")).toBe("authRequired");
    expect(adminDisputeErrorKey("Errors.notAuthorizedAdmin")).toBe("notAuthorizedAdmin");
  });

  it("bilinmeyen veya ham metni generic'e dusurur", () => {
    expect(adminDisputeErrorKey("Errors.somethingNew")).toBe("generic");
    expect(adminDisputeErrorKey("boom")).toBe("generic");
    expect(adminDisputeErrorKey("")).toBe("generic");
  });
});
