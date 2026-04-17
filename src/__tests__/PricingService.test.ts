import { describe, it, expect } from "vitest";
import { PricingService } from "../services/PricingService";
import { DEFAULT_PRICING_RULES } from "@/lib/pricing-rules";

describe("PricingService", () => {
  const service = new PricingService();

  describe("calculateTotal", () => {
    it("should calculate correctly for standard inputs", () => {
      // 2 bags, 3 days, 50 TL/day = 300 TL
      const total = service.calculateTotal(2, 3, 50);
      expect(total).toBe(300);
    });

    it("should round up partial days", () => {
      // 1.2 days -> 2 days. 1 bag, 50 TL/day = 100 TL
      const total = service.calculateTotal(1, 1.2, 50);
      expect(total).toBe(100);
    });

    it("should maintain minimum 1 day", () => {
      // 0.1 day -> 1 day. 1 bag, 50 TL/day = 50 TL
      const total = service.calculateTotal(1, 0.1, 50);
      expect(total).toBe(50);
    });

    it("should handle rounding of floats", () => {
      // 3.33 * 3 = 9.99
      const total = service.calculateTotal(1, 3, 3.33333333);
      expect(total).toBe(10); // rounded to 10 based on implementation (Math.round(total * 100) / 100)
    });
  });

  describe("calculateEarlyRefund", () => {
    const mockRules = {
      ...DEFAULT_PRICING_RULES,
      earlyRefundRatio: 0.8, // %80 refund for saved days
    };

    it("should return 0 if actual checkout is same or after planned checkout", () => {
      const checkIn = new Date("2024-01-01T10:00:00");
      const plannedOut = new Date("2024-01-02T10:00:00"); // 1 day
      const actualOut = new Date("2024-01-02T11:00:00");

      const refund = service.calculateEarlyRefund(
        { checkInTime: checkIn, checkOutTime: plannedOut, unitPrice: 50, bagCountM: 1 },
        actualOut,
        mockRules
      );
      expect(refund).toBe(0);
    });

    it("should calculate refund for unused full days (24h blocks)", () => {
      // Planned: 3 days (Jan 1 to Jan 4)
      // Actual: 1 day (Jan 1 to Jan 2)
      // Saved: 2 days
      const checkIn = new Date("2024-01-01T10:00:00");
      const plannedOut = new Date("2024-01-04T10:00:00");
      const actualOut = new Date("2024-01-02T10:00:00");

      // unitPrice 50, bagCountM 1, insurance 15, total 165
      // dailyService = 50 * 1 * 1.0 (multiplier for M) = 50
      // rawRefund = 2 (saved) * 50 * 0.8 (ratio) = 80
      const refund = service.calculateEarlyRefund(
        {
          checkInTime: checkIn,
          checkOutTime: plannedOut,
          unitPrice: 50,
          bagCountM: 1,
          totalPrice: 165,
          insuranceFee: 15
        },
        actualOut,
        mockRules
      );
      expect(refund).toBe(80);
    });

    it("should cap refund to service paid (totalPrice - insurance)", () => {
      const checkIn = new Date("2024-01-01T10:00:00");
      const plannedOut = new Date("2024-01-10T10:00:00"); // 9 days
      const actualOut = new Date("2024-01-02T10:00:00"); // 1 day
      // Saved: 8 days
      // Price: 50 * 1 * 0.8 (ratio) = 40 refund per day. 8 * 40 = 320 raw refund
      // But user only paid totalPrice=100, insurance=15. Service paid = 85.
      
      const refund = service.calculateEarlyRefund(
        {
          checkInTime: checkIn,
          checkOutTime: plannedOut,
          unitPrice: 50,
          bagCountM: 1,
          totalPrice: 100,
          insuranceFee: 15
        },
        actualOut,
        mockRules
      );
      expect(refund).toBe(85);
    });
  });
});
