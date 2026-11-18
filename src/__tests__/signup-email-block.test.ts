import { describe, it, expect } from "vitest";
import { isBlockedSignupEmail, isBotPatternEmail } from "@/lib/disposable-emails";

describe("bot kayit kalibi", () => {
  it.each(["janedoe.12345@gmail.com", "johnsmith.67890@gmail.com", "JohnSmith.67890@GoogleMail.com"])(
    "%s engellenir",
    (email) => expect(isBotPatternEmail(email)).toBe(true),
  );

  it.each([
    "janedoe.1234@gmail.com", // dort rakam
    "janedoe.123451@gmail.com", // alti rakam
    "jane.doe@gmail.com",
    "janedoe12345@gmail.com", // nokta yok
    "janedoe.12345@outlook.com", // gmail degil
    "ali.12345@gmail.com", // cok kisa ad: gercek kullanici olabilir
  ])("%s engellenmez", (email) => expect(isBotPatternEmail(email)).toBe(false));

  it("gecici domain de engellenir", () => {
    expect(isBlockedSignupEmail("x@mailinator.com")).toBe(true);
    expect(isBlockedSignupEmail("ayse.yilmaz@gmail.com")).toBe(false);
  });
});
