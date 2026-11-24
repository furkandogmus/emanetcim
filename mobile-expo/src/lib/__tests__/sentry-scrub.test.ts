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
