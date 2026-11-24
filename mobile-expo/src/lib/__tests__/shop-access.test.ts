import { describe, expect, it } from "@jest/globals";

import { accessForShop, dashboardAccess, hasStaffPanel, landingRoute } from "../shop-access";

describe("dukkan personeli (istemci)", () => {
  it("eski sunucu `access` gondermez: sahip sayilir", () => {
    expect(dashboardAccess(undefined)).toBe("owner");
    expect(dashboardAccess({})).toBe("owner");
    expect(dashboardAccess({ access: "staff" })).toBe("staff");
  });

  it("rezervasyonun dukkanina gore yetki", () => {
    const d = { shops: [{ id: "a", name: "A", access: "owner" as const }, { id: "b", name: "B", access: "staff" as const }] };
    expect(accessForShop(d, "a")).toBe("owner");
    expect(accessForShop(d, "b")).toBe("staff");
    expect(accessForShop(d, "yok")).toBe("owner");
    expect(accessForShop(undefined, "b")).toBe("owner");
  });

  it("acilis rotasi: personel misafir esnaf paneline; eski sunucuda misafir kalir", () => {
    expect(landingRoute({ role: "PARTNER" })).toBe("/partner");
    expect(landingRoute({ role: "ADMIN", staffShopCount: 2 })).toBe("/admin");
    expect(landingRoute({ role: "GUEST", staffShopCount: 1 })).toBe("/partner");
    expect(landingRoute({ role: "GUEST", staffShopCount: 0 })).toBe("/home");
    expect(landingRoute({ role: "GUEST" })).toBe("/home");
    expect(hasStaffPanel({ role: "PARTNER", staffShopCount: 3 })).toBe(false);
  });
});
