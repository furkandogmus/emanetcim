/**
 * Apple girisi `authorizationCode`u da sunucuya tasir: sunucu onu refresh token'a
 * cevirir ve hesap silinince Apple yetkisini iptal eder (App Store 5.1.1(v)).
 */
const mockSignIn = jest.fn();

jest.mock("expo-apple-authentication", () => ({
  signInAsync: (...args: unknown[]) => mockSignIn(...args),
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

import { pickAppleCredential } from "../apple-auth";

describe("pickAppleCredential", () => {
  it("kimlik belirteci ve yetki kodunu birlikte dondurur", async () => {
    mockSignIn.mockResolvedValue({
      identityToken: "id-token",
      authorizationCode: "auth-code",
      fullName: { givenName: "Ada", familyName: null },
    });
    await expect(pickAppleCredential()).resolves.toEqual({
      identityToken: "id-token",
      authorizationCode: "auth-code",
      givenName: "Ada",
      familyName: undefined,
    });
  });

  it("kod gelmezse alan bos kalir, giris yine calisir", async () => {
    mockSignIn.mockResolvedValue({ identityToken: "id-token", authorizationCode: null, fullName: null });
    const cred = await pickAppleCredential();
    expect(cred?.identityToken).toBe("id-token");
    expect(cred?.authorizationCode).toBeUndefined();
  });
});
