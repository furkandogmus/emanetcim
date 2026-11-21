import { describe, it, expect } from "vitest";
import { isBlockedSignupEmail, isBotPatternEmail } from "@/lib/disposable-emails";

describe("bot kayit kalibi", () => {
  it.each([
    "janedoe.12345@gmail.com",
    "johnsmith.67890@gmail.com",
    "JohnSmith.67890@GoogleMail.com",
    "janedoe12345@gmail.com", // nokta kaldirilmis: ayni kutu
    "jane.doe.12345@gmail.com",
    "janedoe.12345+promo@gmail.com", // etiketli: ayni kutu
  ])(
    "%s engellenir",
    (email) => expect(isBotPatternEmail(email)).toBe(true),
  );

  it.each([
    "janedoe.1234@gmail.com", // dort rakam
    "janedoe.123451@gmail.com", // alti rakam
    "jane.doe@gmail.com",
    "janedoe.12345@outlook.com", // gmail degil
    "ali.12345@gmail.com", // cok kisa ad: gercek kullanici olabilir
  ])("%s engellenmez", (email) => expect(isBotPatternEmail(email)).toBe(false));

  it("gecici domain de engellenir", () => {
    expect(isBlockedSignupEmail("x@mailinator.com")).toBe(true);
    expect(isBlockedSignupEmail("ayse.yilmaz@gmail.com")).toBe(false);
  });
});

describe("her yeni hesap yolu kalibi uygular", () => {
  it.each([
    "src/app/api/mobile/auth/session/route.ts",
    "src/app/api/mobile/auth/google/route.ts",
    "src/app/api/mobile/auth/apple/route.ts",
    "src/actions/register.ts",
    "src/auth.config.ts",
  ])("%s", async (f) => {
    const { readFileSync } = await import("node:fs");
    expect(readFileSync(f, "utf-8")).toContain("isBlockedSignupEmail");
  });
});
