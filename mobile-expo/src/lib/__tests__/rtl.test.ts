import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { I18nManager } from "react-native";
import * as Updates from "expo-updates";
import * as SecureStore from "expo-secure-store";

import { isRtlLanguage, syncLayoutDirection } from "@/lib/rtl";

jest.mock("expo-updates", () => ({ reloadAsync: jest.fn(() => Promise.resolve()) }));
jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn((k: string) => Promise.resolve(store.get(k) ?? null)),
    setItemAsync: jest.fn((k: string, v: string) => Promise.resolve(void store.set(k, v))),
    deleteItemAsync: jest.fn((k: string) => Promise.resolve(void store.delete(k))),
  };
});

describe("rtl", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(I18nManager, "forceRTL").mockImplementation(() => undefined);
    jest.spyOn(I18nManager, "allowRTL").mockImplementation(() => undefined);
  });

  it("yalniz Farsca sagdan sola", () => {
    expect(isRtlLanguage("fa")).toBe(true);
    for (const l of ["tr", "en", "de", "ru", "fr", "ja"]) expect(isRtlLanguage(l)).toBe(false);
  });

  it("yon zaten uyuyorsa yeniden yuklemez", async () => {
    await expect(syncLayoutDirection("en")).resolves.toBe(false);
    expect(Updates.reloadAsync).not.toHaveBeenCalled();
  });

  it("Farsca secilince RTL'e zorlar ve yeniden yukler", async () => {
    await expect(syncLayoutDirection("fa", true)).resolves.toBe(true);
    expect(I18nManager.allowRTL).toHaveBeenCalledWith(true);
    expect(I18nManager.forceRTL).toHaveBeenCalledWith(true);
    expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
  });

  it("acilista ayni yon icin ikinci kez denemez (dongu yok)", async () => {
    // Onceki test denemeyi kaydetti ama isRTL degismedi (platform yok saydi).
    await expect(syncLayoutDirection("fa")).resolves.toBe(false);
    expect(Updates.reloadAsync).not.toHaveBeenCalled();
    expect(SecureStore.getItemAsync).toHaveBeenCalled();
  });
});
