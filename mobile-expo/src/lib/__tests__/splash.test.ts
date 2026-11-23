import { describe, expect, it, jest } from "@jest/globals";

import { nativeSplashIsBlank } from "../splash";

// jest.mock cagrilari importlarin ustune tasinir.

jest.mock("expo-splash-screen", () => ({ hideAsync: jest.fn(() => Promise.resolve()) }));
jest.mock("expo-updates", () => ({ runtimeVersion: "0.3.3" }));


describe("nativeSplashIsBlank", () => {
  it("logolu eski ikililerde false, 0.3.4 ve sonrasinda true", () => {
    expect(nativeSplashIsBlank("0.3.0")).toBe(false);
    expect(nativeSplashIsBlank("0.3.3")).toBe(false);
    expect(nativeSplashIsBlank("0.3.4")).toBe(true);
    expect(nativeSplashIsBlank("0.4.0")).toBe(true);
  });
  it("surum bilinmiyorsa logolu varsayar (gecis sicramasin)", () => {
    expect(nativeSplashIsBlank(null)).toBe(false);
  });
});
