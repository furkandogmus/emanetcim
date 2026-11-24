import { describe, expect, it } from "@jest/globals";

import { busiestHour, hasPin, phoneChange, roundCoord } from "@/lib/partner-parity";

describe("hasPin", () => {
  it("gecerli koordinat", () => {
    expect(hasPin({ latitude: 41.01, longitude: 28.97 })).toBe(true);
  });
  it.each([
    [{}],
    [{ latitude: null, longitude: null }],
    [{ latitude: 41, longitude: null }],
    [{ latitude: 0, longitude: 0 }],
    [{ latitude: 41, longitude: 3e16 }],
  ])("pin yok: %j", (shop) => {
    expect(hasPin(shop)).toBe(false);
  });
});

it("roundCoord 6 ondalik", () => {
  expect(roundCoord(41.008234567)).toBe(41.008235);
});

describe("phoneChange", () => {
  it("ayni numara farkli yazimla degisiklik sayilmaz", () => {
    expect(phoneChange("5321234567", "0532 123 45 67")).toEqual({ kind: "none" });
  });
  it("ilk numara onaysiz kaydedilir", () => {
    expect(phoneChange(null, "0532 123 45 67")).toEqual({ kind: "save", phone: "5321234567", confirm: null });
  });
  it("kayitli numarayi degistirmek onay ister", () => {
    expect(phoneChange("5321234567", "5331112233")).toEqual({ kind: "save", phone: "5331112233", confirm: "change" });
  });
  it("bosaltmak silmedir ve onay ister", () => {
    expect(phoneChange("5321234567", "  ")).toEqual({ kind: "save", phone: null, confirm: "clear" });
  });
  it("numarasiz hesapta bos alan bir sey yapmaz", () => {
    expect(phoneChange(null, "")).toEqual({ kind: "none" });
  });
  it("gecersiz numara", () => {
    expect(phoneChange(null, "12345")).toEqual({ kind: "invalid" });
  });
});

describe("busiestHour", () => {
  it("en cok birakis olan saat; esitlikte erken olan", () => {
    const hours = Array.from({ length: 24 }, (_, h) => ({ hour: `${h}`, count: h === 9 || h === 14 ? 5 : 1 }));
    expect(busiestHour(hours)).toBe(9);
  });
  it("veri yoksa null", () => {
    expect(busiestHour(Array.from({ length: 24 }, (_, h) => ({ hour: `${h}`, count: 0 })))).toBeNull();
  });
});
