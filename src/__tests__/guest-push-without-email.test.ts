import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Telefonla kayitli (e-postasiz) misafir de tek seferlik olaylarda push alir.
 * Push e-postanin yaninda gidiyordu ve cagiranlar e-posta yoksa yontemi hic
 * cagirmiyordu (2026-11-18).
 */
describe("e-postasiz misafire push", () => {
  it.each([
    ["src/app/api/mobile/bookings/[id]/check-in/route.ts", "checkIn"],
    ["src/app/api/mobile/bookings/[id]/check-out/route.ts", "checkOut"],
    ["src/actions/partner.ts", "checkIn"],
    ["src/actions/partner.ts", "checkOut"],
    ["src/services/booking/partner-review.ts", "approved"],
    ["src/services/booking/partner-review.ts", "cancelled"],
    ["src/services/booking/bag-revision.ts", "bagRevision"],
  ])("%s -> %s", (file, event) => {
    const src = readFileSync(file, "utf-8");
    expect(src).toMatch(new RegExp(`pushGuestOnly\\([^)]*["']${event}["']`));
  });
});
