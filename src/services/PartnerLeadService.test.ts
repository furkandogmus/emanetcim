import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({ default: {} }));
vi.mock("@/services/NotificationService", () => ({ notificationService: {} }));

import { normalizeTrPhone } from "./PartnerLeadService";

describe("normalizeTrPhone", () => {
  it.each([
    ["0532 123 45 67", "5321234567"],
    ["+90 532 123 45 67", "5321234567"],
    ["5321234567", "5321234567"],
    ["0212 555 12 34", "2125551234"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeTrPhone(input)).toBe(expected);
  });

  it.each(["123", "0612 555 12 34", "05321234567 9", "abc"])("%s reddedilir", (input) => {
    expect(normalizeTrPhone(input)).toBeNull();
  });
});
