/**
 * Yonetici bildirimi dokunusu: sunucunun `adminScreen` degeri yonetici ekranina gider,
 * tanimadigi deger ya da yonetici olmayan rol hicbir yere gitmez.
 */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import { adminPathFromPush, openFromNotification } from "@/lib/push";

jest.mock("expo-secure-store", () => ({}));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("expo-notifications", () => ({ setNotificationHandler: jest.fn() }));
jest.mock("expo-constants", () => ({ expoConfig: {} }));

const { router } = jest.requireMock<{ router: { push: jest.Mock } }>("expo-router");
const response = (data: Record<string, unknown>) =>
  ({ notification: { request: { content: { data } } } }) as never;

describe("adminPathFromPush", () => {
  it("maps each admin screen", () => {
    expect(adminPathFromPush({ adminScreen: "dispute", disputeId: "3f2b8c1e-9a4d-4e2f-8b1a-0c9d7e6f5a41" })).toBe("/admin/dispute/3f2b8c1e-9a4d-4e2f-8b1a-0c9d7e6f5a41");
    expect(adminPathFromPush({ adminScreen: "dispute" })).toBe("/admin/disputes");
    expect(adminPathFromPush({ adminScreen: "applications" })).toBe("/admin/applications");
    expect(adminPathFromPush({ adminScreen: "partnerLeads" })).toBe("/admin/partner-leads");
    expect(adminPathFromPush({ adminScreen: "affiliates" })).toBe("/admin/affiliates");
    expect(adminPathFromPush({ adminScreen: "roleApprovals" })).toBe("/admin/role-approvals");
    expect(adminPathFromPush({ adminScreen: "messages" })).toBe("/admin/messages");
  });

  it("ignores unknown values", () => {
    expect(adminPathFromPush({ adminScreen: "/admin/../evil" })).toBeNull();
    expect(adminPathFromPush(undefined)).toBeNull();
    // Gecersiz kimlik yol parcasina girmez; liste acilir.
    expect(adminPathFromPush({ adminScreen: "dispute", disputeId: "../../partner/x" })).toBe("/admin/disputes");
  });
});

describe("openFromNotification for admins", () => {
  beforeEach(() => {
    router.push.mockClear();
  });

  it("opens the dispute for an admin", () => {
    openFromNotification(response({ adminScreen: "dispute", disputeId: "3f2b8c1e-9a4d-4e2f-8b1a-0c9d7e6f5a41" }), "ADMIN");
    expect(router.push).toHaveBeenCalledWith("/admin/dispute/3f2b8c1e-9a4d-4e2f-8b1a-0c9d7e6f5a41");
  });

  it("opens role approvals for an admin", () => {
    openFromNotification(response({ adminScreen: "roleApprovals" }), "ADMIN");
    expect(router.push).toHaveBeenCalledWith("/admin/role-approvals");
  });

  it("opens the booking (with its dispute card) for a guest dispute outcome", () => {
    openFromNotification(response({ bookingId: "b1" }), "GUEST");
    expect(router.push).toHaveBeenCalledWith("/bookings/b1");
  });

  it("does not route a guest to an admin screen", () => {
    openFromNotification(response({ adminScreen: "applications" }), "GUEST");
    expect(router.push).not.toHaveBeenCalled();
  });
});
