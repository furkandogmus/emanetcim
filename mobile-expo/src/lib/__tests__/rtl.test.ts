import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { I18nManager } from "react-native";
import * as Updates from "expo-updates";
import * as SecureStore from "expo-secure-store";

import { isRtlLanguage, resetRtlSessionForTests, syncLayoutDirection } from "@/lib/rtl";

jest.mock("expo-updates", () => ({ reloadAsync: jest.fn(() => Promise.resolve()) }));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

const store = new Map<string, string>();
const get = SecureStore.getItemAsync as unknown as jest.Mock<(k: string) => Promise<string | null>>;
const set = SecureStore.setItemAsync as unknown as jest.Mock<(k: string, v: string) => Promise<void>>;

describe("rtl", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    store.clear();
    resetRtlSessionForTests();
    get.mockImplementation((k) => Promise.resolve(store.get(k) ?? null));
    set.mockImplementation((k, v) => Promise.resolve(void store.set(k, v)));
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

  it("acilista ayni yon icin kayitli deneme varsa yeniden yuklemez", async () => {
    store.set("rtl_reload_attempt", "rtl");
    await expect(syncLayoutDirection("fa")).resolves.toBe(false);
    expect(Updates.reloadAsync).not.toHaveBeenCalled();
  });

  it("SecureStore yazamazsa acilista yeniden yuklemez (dongu yok)", async () => {
    set.mockImplementation(() => Promise.reject(new Error("keychain")));
    await expect(syncLayoutDirection("fa")).resolves.toBe(false);
    expect(Updates.reloadAsync).not.toHaveBeenCalled();
  });

  it("ayni oturumda en fazla bir yeniden yukleme", async () => {
    await expect(syncLayoutDirection("fa", true)).resolves.toBe(true);
    await expect(syncLayoutDirection("fa", true)).resolves.toBe(false);
    await expect(syncLayoutDirection("fa")).resolves.toBe(false);
    expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
  });
});
