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
    expect(adminPathFromPush({ adminScreen: "dispute", disputeId: "d1" })).toBe("/admin/dispute/d1");
    expect(adminPathFromPush({ adminScreen: "dispute" })).toBe("/admin/disputes");
    expect(adminPathFromPush({ adminScreen: "applications" })).toBe("/admin/applications");
    expect(adminPathFromPush({ adminScreen: "partnerLeads" })).toBe("/admin/partner-leads");
    expect(adminPathFromPush({ adminScreen: "affiliates" })).toBe("/admin/affiliates");
  });

  it("ignores unknown values", () => {
    expect(adminPathFromPush({ adminScreen: "/admin/../evil" })).toBeNull();
    expect(adminPathFromPush(undefined)).toBeNull();
  });
});

describe("openFromNotification for admins", () => {
  beforeEach(() => {
    router.push.mockClear();
  });

  it("opens the dispute for an admin", () => {
    openFromNotification(response({ adminScreen: "dispute", disputeId: "d1" }), "ADMIN");
    expect(router.push).toHaveBeenCalledWith("/admin/dispute/d1");
  });

  it("does not route a guest to an admin screen", () => {
    openFromNotification(response({ adminScreen: "applications" }), "GUEST");
    expect(router.push).not.toHaveBeenCalled();
  });
});
