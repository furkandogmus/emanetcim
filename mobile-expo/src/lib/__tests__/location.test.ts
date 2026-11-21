import { describe, expect, it, jest } from "@jest/globals";

const mockRequestPerm = jest.fn<() => Promise<{ status: string; canAskAgain: boolean }>>();
jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: () => mockRequestPerm(),
  getLastKnownPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

import { getDevicePosition } from "@/lib/location";

describe("getDevicePosition", () => {
  it("kalici red canAskAgain=false doner (Ayarlar yolu icin)", async () => {
    mockRequestPerm.mockResolvedValue({ status: "denied", canAskAgain: false });
    expect(await getDevicePosition()).toEqual({ ok: false, reason: "denied", canAskAgain: false });
  });

  it("ilk red yeniden sorulabilir", async () => {
    mockRequestPerm.mockResolvedValue({ status: "denied", canAskAgain: true });
    expect(await getDevicePosition()).toMatchObject({ ok: false, reason: "denied", canAskAgain: true });
  });
});
