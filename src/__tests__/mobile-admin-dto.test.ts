import { describe, it, expect } from "vitest";
import { toMobileAdminApplication, toMobileAdminMessage, toMobileAdminUser } from "@/lib/mobile-dto";

describe("admin DTO'ları", () => {
  it("telefon numarası sunucuda WhatsApp biçimine çevrilir, çevrilemezse null", () => {
    const u = (phone: string | null) =>
      toMobileAdminUser({
        id: "u1",
        name: "A",
        email: null,
        phone,
        role: "GUEST",
        isBanned: false,
        isTest: false,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        _count: { bookings: 0, shops: 0 },
      } as never);
    expect(u("5321234567").whatsapp).toBe("905321234567");
    expect(u("0532 123 45 67").whatsapp).toBe("905321234567");
    expect(u("12").whatsapp).toBeNull();
    expect(u(null).whatsapp).toBeNull();
  });

  it("başvuru sahibinin numarası da whatsapp taşır", () => {
    const a = toMobileAdminApplication({
      id: "s1",
      name: "D",
      address: null,
      city: null,
      district: null,
      latitude: null,
      longitude: null,
      pricePerDay: 100,
      capacity: 5,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      owner: { name: "O", phone: "5321234567", email: null },
    } as never);
    expect(a.owner.whatsapp).toBe("905321234567");
    expect(a.hasCoordinates).toBe(false);
  });
});

describe("toMobileAdminMessage", () => {
  const base = {
    id: "m1",
    from: "x@example.com",
    subject: "Konu",
    isRead: false,
    category: "SUPPORT",
    createdAt: new Date("2026-11-01T10:00:00Z"),
    replies: [] as { createdAt: Date }[],
  };

  it("yalnızca-HTML postada etiketsiz düz metin verir ve ham HTML taşımaz", () => {
    const dto = toMobileAdminMessage({ ...base, text: null, html: "<p>Merhaba <b>dünya</b></p><script>x()</script>" });
    expect(dto.text).toBe("Merhaba dünya");
    expect(JSON.stringify(dto)).not.toContain("<p>");
    expect(dto).not.toHaveProperty("html");
  });

  it("düz metin varsa onu kullanır; en son cevabın zamanını verir", () => {
    const dto = toMobileAdminMessage({
      ...base,
      text: "  Selam  ",
      html: "<p>x</p>",
      replies: [{ createdAt: new Date("2026-11-02T08:00:00Z") }],
    });
    expect(dto.text).toBe("Selam");
    expect(dto.repliedAt).toBe("2026-11-02T08:00:00.000Z");
  });

  it("gövdeyi sınırlar", () => {
    const dto = toMobileAdminMessage({ ...base, text: "a".repeat(9000), html: null });
    expect(dto.text?.length).toBe(4000);
  });
});

import { canViewAs } from "@/lib/mobile-dto";

describe("canViewAs (kullanıcı olarak gör düğmesi)", () => {
  it("ADMIN ve yasaklı hesapta false, diğerinde true", () => {
    expect(canViewAs({ role: "PARTNER", isBanned: false })).toBe(true);
    expect(canViewAs({ role: "ADMIN", isBanned: false })).toBe(false);
    expect(canViewAs({ role: "GUEST", isBanned: true })).toBe(false);
  });
});
