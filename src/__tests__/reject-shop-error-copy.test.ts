import { describe, it, expect } from "vitest";
import { rejectShopErrorKey } from "@/lib/reject-shop-error-copy";

describe("rejectShopErrorKey", () => {
  it("bilinen Errors.* anahtarindan on eki siyirir", () => {
    expect(rejectShopErrorKey("Errors.shopNotFound")).toBe("shopNotFound");
    expect(rejectShopErrorKey("Errors.shopAlreadyApproved")).toBe("shopAlreadyApproved");
    expect(rejectShopErrorKey("Errors.shopHasBookings")).toBe("shopHasBookings");
  });

  it("bilinmeyen veya tanimsiz girdiyi generic'e dusurur", () => {
    expect(rejectShopErrorKey("Errors.somethingNew")).toBe("generic");
    expect(rejectShopErrorKey("boom")).toBe("generic");
    expect(rejectShopErrorKey(undefined)).toBe("generic");
    expect(rejectShopErrorKey("")).toBe("generic");
  });
});
