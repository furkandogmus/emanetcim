import { describe, expect, it, jest } from "@jest/globals";

jest.mock("expo", () => ({ requireOptionalNativeModule: jest.fn(() => ({})) }));
const mockEnrolled = jest.fn<() => Promise<number>>();
const mockAuth = jest.fn<() => Promise<{ success: boolean }>>();
jest.mock("expo-local-authentication", () => ({
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 },
  getEnrolledLevelAsync: () => mockEnrolled(),
  authenticateAsync: () => mockAuth(),
}));

// eslint-disable-next-line import/first
import { authenticate, deviceCanLock, LOCK_AFTER_BACKGROUND_MS, lockEnabledFor, lockOnResume } from "@/lib/app-lock";

describe("app-lock", () => {
  it("misafir asla, yonetici varsayilan acik, esnaf varsayilan kapali", () => {
    expect(lockEnabledFor("GUEST", true)).toBe(false);
    expect(lockEnabledFor("ADMIN", null)).toBe(true);
    expect(lockEnabledFor("ADMIN", false)).toBe(false);
    expect(lockEnabledFor("PARTNER", null)).toBe(false);
    expect(lockEnabledFor("PARTNER", true)).toBe(true);
  });

  it("5 dakikadan uzun arka plan kilitler, kisa donus kilitlemez", () => {
    expect(lockOnResume(null, 1e9)).toBe(false);
    expect(lockOnResume(0, LOCK_AFTER_BACKGROUND_MS)).toBe(false);
    expect(lockOnResume(0, LOCK_AFTER_BACKGROUND_MS + 1)).toBe(true);
  });

  it("biyometri ya da kod yoksa kilit kurulmaz; yalniz cihaz kodu yeter", async () => {
    mockEnrolled.mockResolvedValueOnce(0);
    await expect(deviceCanLock()).resolves.toBe(false);
    mockEnrolled.mockResolvedValueOnce(1);
    await expect(deviceCanLock()).resolves.toBe(true);
    mockEnrolled.mockRejectedValueOnce(new Error("x"));
    await expect(deviceCanLock()).resolves.toBe(false);
  });

  it("iptal ve hata kilidi acmaz", async () => {
    mockAuth.mockResolvedValueOnce({ success: false });
    await expect(authenticate("p", "c")).resolves.toBe(false);
    mockAuth.mockRejectedValueOnce(new Error("x"));
    await expect(authenticate("p", "c")).resolves.toBe(false);
    mockAuth.mockResolvedValueOnce({ success: true });
    await expect(authenticate("p", "c")).resolves.toBe(true);
  });

  it("yerel modul yoksa (eski ikili) kilit yok", async () => {
    const expo = jest.requireMock<{ requireOptionalNativeModule: jest.Mock }>("expo");
    expo.requireOptionalNativeModule.mockReturnValueOnce(null);
    await expect(deviceCanLock()).resolves.toBe(false);
  });
});
