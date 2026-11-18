import { describe, it, expect } from "vitest";
import { isBlockedSignupEmail, isBotPatternEmail } from "@/lib/disposable-emails";

describe("bot kayit kalibi", () => {
  it.each(["vickirose.45844@gmail.com", "rafaelrobertson.54655@gmail.com", "RafaelRobertson.54655@GoogleMail.com"])(
    "%s engellenir",
    (email) => expect(isBotPatternEmail(email)).toBe(true),
  );

  it.each([
    "vickirose.4584@gmail.com", // dort rakam
    "vickirose.458441@gmail.com", // alti rakam
    "vicki.rose@gmail.com",
    "vickirose45844@gmail.com", // nokta yok
    "vickirose.45844@outlook.com", // gmail degil
    "ali.12345@gmail.com", // cok kisa ad: gercek kullanici olabilir
  ])("%s engellenmez", (email) => expect(isBotPatternEmail(email)).toBe(false));

  it("gecici domain de engellenir", () => {
    expect(isBlockedSignupEmail("x@mailinator.com")).toBe(true);
    expect(isBlockedSignupEmail("ayse.yilmaz@gmail.com")).toBe(false);
  });
});
