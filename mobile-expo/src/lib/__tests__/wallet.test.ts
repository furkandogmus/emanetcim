import { describe, expect, it } from "@jest/globals";
import { walletKindFor } from "../wallet";

describe("walletKindFor", () => {
  it("iOS -> Apple, Android -> Google, yalnizca sunucu acik derse", () => {
    expect(walletKindFor({ walletApple: true, walletGoogle: true }, "ios")).toBe("apple");
    expect(walletKindFor({ walletApple: true, walletGoogle: true }, "android")).toBe("google");
    expect(walletKindFor({ walletApple: false, walletGoogle: true }, "ios")).toBeNull();
    expect(walletKindFor({ walletApple: true, walletGoogle: false }, "android")).toBeNull();
  });

  it("eski sunucu (alan yok) ya da yuklenmemis yapilandirma: dugme yok", () => {
    expect(walletKindFor({}, "ios")).toBeNull();
    expect(walletKindFor(undefined, "android")).toBeNull();
    expect(walletKindFor({ walletApple: true }, "web")).toBeNull();
  });
});
