import { describe, it, expect, vi, beforeEach } from "vitest";

/** Kart guncellemesi tek yerden: her gecisin yazildigi `BookingEventService.record`. */
const { mockPrisma, mockNotify } = vi.hoisted(() => ({
  mockPrisma: { bookingEvent: { create: vi.fn() } },
  mockNotify: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/services/WalletPassService", () => ({ walletPassService: { notifyBookingChanged: mockNotify } }));

import { bookingEventService } from "@/services/BookingEventService";

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.bookingEvent.create.mockResolvedValue({});
  mockNotify.mockResolvedValue(undefined);
});

describe("wallet guncelleme tetigi", () => {
  it.each(["CANCELLED", "MODIFIED", "BAGS_MODIFIED", "CHECKED_IN", "CHECKED_OUT"] as const)("%s karti gunceller", async (event) => {
    await bookingEventService.record({ bookingId: "bk-1", event });
    expect(mockNotify).toHaveBeenCalledWith("bk-1");
  });

  it("kartta gorunmeyen olay (OVERDUE, SEAL_ASSIGNED) push uretmez", async () => {
    await bookingEventService.record({ bookingId: "bk-1", event: "OVERDUE" });
    await bookingEventService.record({ bookingId: "bk-1", event: "SEAL_ASSIGNED" });
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("guncelleme hatasi olay kaydini dusurmez", async () => {
    mockNotify.mockRejectedValue(new Error("apns down"));
    await expect(bookingEventService.record({ bookingId: "bk-1", event: "CANCELLED" })).resolves.toBeUndefined();
  });
});
