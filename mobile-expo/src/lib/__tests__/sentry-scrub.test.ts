import { describe, expect, it } from "@jest/globals";
import type { ErrorEvent } from "@sentry/react-native";

import { scrubBreadcrumb, scrubEvent, scrubString } from "@/lib/sentry-scrub";

describe("sentry-scrub", () => {
  it("e-posta, telefon, JWT ve Bearer metinden silinir", () => {
    const s = scrubString(
      "user ayse@example.com +90 532 123 45 67 05321234567 Bearer abc.def eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig",
    );
    expect(s).not.toMatch(/ayse@|532|abc\.def|eyJ/);
    expect(s).toContain("[email]");
    expect(s).toContain("[phone]");
    expect(s).toContain("[jwt]");
  });

  it("tarih, saat ve rezervasyon kimligi korunur", () => {
    const s = "booking 0f8fad5b-d9cb-469f-a165-70867728950e at 2026-11-24T10:00:00Z failed 500";
    expect(scrubString(s)).toBe(s);
  });

  it("breadcrumb adresinin sorgusu ve govdesi atilir", () => {
    const b = scrubBreadcrumb({
      category: "fetch",
      message: "POST https://x.test/api/mobile/auth/verify?email=a@b.co",
      data: { url: "https://x.test/api/mobile/auth/verify?code=123456", body: "{\"code\":\"123456\"}", status_code: 400 },
    });
    expect(b?.data).toEqual({ url: "https://x.test/api/mobile/auth/verify", status_code: 400 });
    expect(b?.message).not.toContain("a@b.co");
  });

  it("olayda istek govdesi, basliklar ve kullanici alanlari gitmez", () => {
    const e = scrubEvent({
      type: undefined,
      message: "fail for a@b.co",
      exception: { values: [{ type: "ApiError", value: "phone 0532 123 45 67 in use" }] },
      request: { url: "https://x.test/p?token=abc", data: "{}", headers: { Authorization: "Bearer x" }, cookies: { s: "1" } },
      user: { id: "u1", email: "a@b.co", ip_address: "1.2.3.4" },
      extra: { password: "hunter2", nested: { note: "mail a@b.co" } },
    } as ErrorEvent);
    expect(e?.message).toBe("fail for [email]");
    expect(e?.exception?.values?.[0].value).toBe("phone [phone] in use");
    expect(e?.request).toEqual({ url: "https://x.test/p" });
    expect(e?.user).toEqual({ id: "u1" });
    expect(e?.extra).toEqual({ password: "[redacted]", nested: { note: "mail [email]" } });
  });
});

describe("sentry-scrub (genis)", () => {
  it.each([
    "+905321234567",
    "+44 20 7946 0958",
    "+1 (415) 555-0132",
    "0532 123 45 67",
    "532-123-4567",
    "05321234567",
  ])("telefon silinir: %s", (p) => {
    expect(scrubString(`tel ${p} kayitli`)).toBe("tel [phone] kayitli");
  });

  it.each(["1732467891234", "1732467891", "2026-11-24", "2026-11-24T10:00:00.000Z", "v0.3.6", "status 500 after 12000 ms"])(
    "telefon olmayan korunur: %s",
    (s) => {
      expect(scrubString(s)).toBe(s);
    },
  );

  it("anahtar adinda phone/email/name/address/token/secret/password gecen deger gitmez", () => {
    const e = scrubEvent({
      type: undefined,
      extra: { guestPhone: "x", shopName: "Ornek", userEmail: "y", shopAddress: "z", refresh_token: "t", apiSecret: "s", newPassword: "p", count: 3 },
    } as ErrorEvent);
    expect(e?.extra).toEqual({
      guestPhone: "[redacted]",
      shopName: "[redacted]",
      userEmail: "[redacted]",
      shopAddress: "[redacted]",
      refresh_token: "[redacted]",
      apiSecret: "[redacted]",
      newPassword: "[redacted]",
      count: 3,
    });
  });

  it("tags, logentry, fingerprint ve request.url sorgusu temizlenir", () => {
    const e = scrubEvent({
      type: undefined,
      tags: { contact: "a@b.co", role: "ADMIN" },
      logentry: { message: "login %s", params: ["a@b.co"] },
      fingerprint: ["user a@b.co", "{{ default }}"],
      request: { url: "https://x.test/p?phone=05321234567" },
    } as ErrorEvent);
    expect(e?.tags).toEqual({ contact: "[email]", role: "ADMIN" });
    expect(e?.logentry).toEqual({ message: "login %s", params: ["[email]"] });
    expect(e?.fingerprint).toEqual(["user [email]", "{{ default }}"]);
    expect(e?.request?.url).toBe("https://x.test/p");
  });
});
