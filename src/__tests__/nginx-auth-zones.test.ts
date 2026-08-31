import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * KIMLIK DOGRULAMA YUZEYLERI NGINX'TE DAR KOVADA OLMALI.
 *
 * NEDEN VAR (2026-08-31'de olculdu): `/api/mobile/auth/*` hicbir ozel
 * `location`a dusmuyordu, yani `location /` uzerinden `@next`e gidip
 * `api_general` limitini aliyordu -- 30r/s. Web girisi (`/api/auth/`) ise
 * `api_auth` ile 180r/DAKIKA aliyor.
 *
 * Yani ayni isi yapan iki yuzeyden biri digerinden yaklasik ON KAT gevsek bir
 * kovadaydi, ve gevsek olan parola/OTP denemelerinin ucuz oldugu taraftı:
 * `auth/session` (sifre + OTP dogrulama), `auth/register`, `auth/refresh`,
 * `auth/password-reset/*`.
 *
 * Ayni bosluk misafir rezervasyon sorgulama zincirinde de vardi
 * (`bookings/lookup` -> `guest-cancel`): kimlik dogrulamasi yok, basarisi
 * misafirin QR token'ini ve iptal yetkisini veriyor, ve kaba kuvvetin maliyeti
 * tamamen istek hizina bagli.
 *
 * Uygulama katmaninda bu uclarin hepsinde IP kovasi var. Bu mandal onun yerine
 * gecmiyor, YANINDA duruyor: nginx istegi Node'a hic sokmadan keser, yani
 * veritabani ve bcrypt maliyeti hic dogmaz.
 *
 * NOT: bu tarama `nginx -t`nin yerine GECMEZ. O, `scripts/verify-nginx-conf.sh`
 * ile CI'da kosuyor ve sozdizimini sinar; burasi POLITIKAYI sinar -- hangi
 * yolun hangi kovaya dustugunu.
 */

const CONF = path.resolve(
  __dirname,
  "../../nginx/conf.d/default.conf",
);

type Location = { kind: "exact" | "regex" | "prefix"; pattern: string; zone: string | null };

/**
 * `location` bloklarini ve icindeki `limit_req zone=<ad>` degerini cikarir.
 * nginx onceligi: once tam eslesme (`=`), sonra DOSYA SIRASINDA regex (`~`),
 * en son onek. Bu model o siralamayi taklit ediyor.
 */
function parseLocations(src: string): Location[] {
  const out: Location[] = [];
  const re = /location\s+(=\s+|~\*?\s+)?("[^"]+"|\S+)\s*\{/g;
  for (const m of src.matchAll(re)) {
    const modifier = (m[1] ?? "").trim();
    const pattern = m[2].replace(/^"|"$/g, "");
    // Blok govdesini kabaca al: bir sonraki `location`a ya da dosya sonuna kadar.
    const start = m.index! + m[0].length;
    const nextLoc = src.slice(start).search(/\n\s*location\s/);
    const body = src.slice(start, nextLoc === -1 ? src.length : start + nextLoc);
    const zoneMatch = body.match(/limit_req\s+zone=(\w+)/);
    out.push({
      kind: modifier === "=" ? "exact" : modifier.startsWith("~") ? "regex" : "prefix",
      pattern,
      zone: zoneMatch ? zoneMatch[1] : null,
    });
  }
  return out;
}

/** nginx eslestirme sirasi: tam eslesme -> regex (dosya sirasi) -> onek. */
function resolveLocation(locations: Location[], reqPath: string): Location | null {
  for (const l of locations) {
    if (l.kind === "exact" && l.pattern === reqPath) return l;
  }
  for (const l of locations) {
    if (l.kind === "regex" && new RegExp(l.pattern).test(reqPath)) return l;
  }
  let best: Location | null = null;
  for (const l of locations) {
    if (l.kind !== "prefix") continue;
    if (!reqPath.startsWith(l.pattern)) continue;
    if (!best || l.pattern.length > best.pattern.length) best = l;
  }
  return best;
}

/** Dar kovada olmasi ZORUNLU yollar ve neden. */
const MUST_BE_AUTH_ZONE: Array<{ path: string; why: string }> = [
  { path: "/api/auth/callback/credentials", why: "web sifre girisi" },
  { path: "/api/mobile/auth/session", why: "mobil sifre + OTP dogrulama" },
  { path: "/api/mobile/auth/register", why: "mobil hesap acma" },
  { path: "/api/mobile/auth/refresh", why: "mobil token uretimi" },
  { path: "/api/mobile/auth/otp", why: "OTP gonderimi (SMS maliyeti)" },
  {
    path: "/api/mobile/auth/password-reset/confirm",
    why: "sifre yazar -- hesap devralmaya en yakin uc",
  },
  {
    path: "/api/bookings/lookup",
    why: "rezervasyon kodu kaba kuvveti; basarisi QR token'i ve iptal yetkisi veriyor",
  },
  { path: "/api/bookings/guest-cancel", why: "rezervasyon iptali" },
];

describe("nginx kimlik dogrulama kovalari", () => {
  const src = fs.readFileSync(CONF, "utf8");
  const locations = parseLocations(src);

  it("konfigde en az bir `api_auth` kovasi tanimli", () => {
    expect(locations.some((l) => l.zone === "api_auth")).toBe(true);
  });

  it.each(MUST_BE_AUTH_ZONE)("$path dar kovada ($why)", ({ path: reqPath }) => {
    const loc = resolveLocation(locations, reqPath);
    expect(loc, `${reqPath} hicbir location'a dusmuyor`).not.toBeNull();
    expect(
      loc!.zone,
      `${reqPath} \`${loc!.pattern}\` blogunda ve kovasi \`${loc!.zone}\`. ` +
        `Kimlik dogrulama yuzeyleri \`api_auth\` (180r/dk) kovasinda olmali; ` +
        `\`api_general\` 30r/SANIYE veriyor -- parola ve OTP denemeleri icin ` +
        `on kat fazla.`,
    ).toBe("api_auth");
  });

  it("`/api/health/live` limitlenmiyor (konteyner healthcheck'i onu cagiriyor)", () => {
    /*
      Bunu limitlemek konteyneri unhealthy'e dusurur: nginx kendi
      healthcheck'inde bes saniyede bir cagiriyor. Kardesi `/api/health/jobs`
      ise pahali ve acik oldugu icin KENDI dar kovasinda.
    */
    const live = resolveLocation(locations, "/api/health/live");
    expect(live?.zone).not.toBe("api_health");
    const jobs = resolveLocation(locations, "/api/health/jobs");
    expect(jobs?.zone).toBe("api_health");
  });
});
