import { describe, it, expect, afterEach } from "vitest";
import { guestLookupSecret } from "@/lib/guest-lookup-token";
import { readSourceTree } from "./helpers/source-snapshot";

/**
 * P2-6: misafir rezervasyon token'ı repoda YAZILI bir sırra düşüyordu.
 *
 * Üç uç (`lookup`, `lookup/me`, `guest-cancel`) sırrı şöyle türetiyordu:
 *   `process.env.AUTH_SECRET || "bagajpark-guest-management-secret"`
 * `AUTH_SECRET` tanımsızsa üçü de herkesin okuyabildiği sabit bir sırla imza
 * doğruluyordu; o sırla üretilmiş bir token `guest-cancel`'da kabul edilir ve
 * saldırgan `bookingId` + `email` doldurup başkasının rezervasyonunu iptal eder.
 *
 * Bu tarama iki şeyi sabitler: (1) fallback geri gelmesin, (2) sır eksikken
 * sessizce çalışmak yerine hata versin.
 */
const ORIGINAL_AUTH = process.env.AUTH_SECRET;
const ORIGINAL_NEXTAUTH = process.env.NEXTAUTH_SECRET;

afterEach(() => {
  if (ORIGINAL_AUTH === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = ORIGINAL_AUTH;
  if (ORIGINAL_NEXTAUTH === undefined) delete process.env.NEXTAUTH_SECRET;
  else process.env.NEXTAUTH_SECRET = ORIGINAL_NEXTAUTH;
});

describe("misafir token sırrı", () => {
  it("sır yoksa atar; sabit bir değere düşmez", () => {
    delete process.env.AUTH_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    expect(() => guestLookupSecret()).toThrow(/AUTH_SECRET/);
  });

  it("sır varsa onu kodlar", () => {
    process.env.AUTH_SECRET = "x".repeat(40);
    const bytes = guestLookupSecret();
    expect(new TextDecoder().decode(bytes)).toBe("x".repeat(40));
  });

  it("repoda yazılı fallback sır yok", () => {
    const offenders = readSourceTree("src")
      .filter((f) => !f.path.endsWith("guest-token-secret.test.ts"))
      .filter((f) => {
        // Yorumlar sayılmaz: hatanın kendisini yorumda ANLATAN dosyalar var.
        const src = f.text
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/^\s*\/\/.*$/gm, "");
        // "AUTH_SECRET || <dize>" kalıbı: eksik sırrın sabit bir değere düşmesi.
        return /AUTH_SECRET\s*(\|\||\?\?)\s*["'`]/.test(src);
      })
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });
});
