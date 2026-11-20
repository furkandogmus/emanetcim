import { describe, expect, it } from "@jest/globals";

import { parseIdentity } from "@/lib/identity";

describe("parseIdentity", () => {
  it("e-postayi kucuk harfe cevirir", () => {
    expect(parseIdentity(" Esnaf@Test.com ")).toEqual({ email: "esnaf@test.com" });
  });
  it("telefonu rakamlara indirir", () => {
    expect(parseIdentity("0532 123 45 67")).toEqual({ phone: "05321234567" });
    expect(parseIdentity("+90 (532) 123-45-67")).toEqual({ phone: "905321234567" });
    expect(parseIdentity("5321234567")).toEqual({ phone: "5321234567" });
  });
  it("gecersizi reddeder", () => {
    expect(parseIdentity("esnaf")).toBeNull();
    expect(parseIdentity("a@b")).toBeNull();
    expect(parseIdentity("12345")).toBeNull();
    expect(parseIdentity("0532abc1234")).toBeNull();
  });
});
