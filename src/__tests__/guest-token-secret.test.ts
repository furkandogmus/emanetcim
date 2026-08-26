import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { guestLookupSecret } from "@/lib/guest-lookup-token";

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

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

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
    const offenders = walk("src")
      .filter((f) => !f.endsWith("guest-token-secret.test.ts"))
      .filter((f) => {
        // Yorumlar sayılmaz: hatanın kendisini yorumda ANLATAN dosyalar var.
        const src = fs
          .readFileSync(f, "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/^\s*\/\/.*$/gm, "");
        // "AUTH_SECRET || <dize>" kalıbı: eksik sırrın sabit bir değere düşmesi.
        return /AUTH_SECRET\s*(\|\||\?\?)\s*["'`]/.test(src);
      });
    expect(offenders).toEqual([]);
  });
});
