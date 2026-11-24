import { describe, expect, it } from "@jest/globals";
import { walletKindFor } from "../wallet";

describe("walletKindFor", () => {
  it("iOS -> Apple, Android -> Google, yalnizca sunucu acik derse", () => {
    expect(walletKindFor({ walletApple: true, walletGoogle: true }, "ios", "APPROVED")).toBe("apple");
    expect(walletKindFor({ walletApple: true, walletGoogle: true }, "android", "APPROVED")).toBe("google");
    expect(walletKindFor({ walletApple: false, walletGoogle: true }, "ios", "APPROVED")).toBeNull();
    expect(walletKindFor({ walletApple: true, walletGoogle: false }, "android", "APPROVED")).toBeNull();
  });

  it("eski sunucu (alan yok) ya da yuklenmemis yapilandirma: dugme yok", () => {
    expect(walletKindFor({}, "ios", "APPROVED")).toBeNull();
    expect(walletKindFor(undefined, "android", "APPROVED")).toBeNull();
    expect(walletKindFor({ walletApple: true }, "web", "APPROVED")).toBeNull();
  });

  it("sunucunun kart vermedigi durumda dugme yok (PENDING, CANCELLED, CHECKED_OUT)", () => {
    for (const status of ["PENDING", "CANCELLED", "CHECKED_OUT"]) {
      expect(walletKindFor({ walletApple: true, walletGoogle: true }, "ios", status)).toBeNull();
    }
    expect(walletKindFor({ walletApple: true }, "ios", "CHECKED_IN")).toBe("apple");
  });
});
