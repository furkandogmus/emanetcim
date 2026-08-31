/**
 * TALEP TESTİ ŞEHİRLERİNİN LİSTESİNİ `prelaunch-points.ts` KAYNAĞINDAN OKUR.
 *
 * NEDEN IMPORT DEĞİL DE METİN AYRIŞTIRMA: `prelaunch-points.ts` yüklenir
 * yüklenmez `main()` çalıştırıyor — import etmek Prisma'yı açar ve kuru çalışma
 * beklerken veritabanına bağlanır. Diziyi ayrı bir modüle taşımak daha temiz
 * olurdu ama o dosya aktif olarak başka bir iş tarafından düzenleniyor;
 * gevşek bağ bilinçli. Ayrıştırma başarısız olursa (biçim değişirse) `--verify`
 * "0 sehir" der ve sapma sessiz kalmaz.
 */

import fs from "node:fs";
import path from "node:path";

export type PrelaunchPoint = { slug: string; name: string; district: string };
export type PrelaunchCity = {
  key: string;
  city: string;
  country: string;
  points: PrelaunchPoint[];
};

const SOURCE = path.join(process.cwd(), "scripts/prelaunch-points.ts");

const CITY_RE =
  /key: "([^"]+)", city: "([^"]+)", country: "([^"]+)", suffix: "([^"]*)", timezone: "([^"]+)",\s*\n\s*points: \[([\s\S]*?)\n {4}\],/g;
const POINT_RE = /\{ slug: "([^"]+)", name: "([^"]+)", district: "([^"]+)"/g;

export function readPrelaunchCities(): PrelaunchCity[] {
  const src = fs.readFileSync(SOURCE, "utf8");
  const start = src.indexOf("const CITIES: City[] = [");
  if (start === -1) throw new Error("prelaunch-points.ts icinde CITIES dizisi bulunamadi");
  const body = src.slice(start);

  const cities: PrelaunchCity[] = [];
  for (const m of body.matchAll(CITY_RE)) {
    const points = [...m[6].matchAll(POINT_RE)].map((p) => ({
      slug: p[1],
      name: p[2],
      district: p[3],
    }));
    cities.push({ key: m[1], city: m[2], country: m[3], points });
  }
  return cities;
}
