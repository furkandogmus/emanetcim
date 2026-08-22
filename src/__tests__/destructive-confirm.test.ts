import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Geri alınamaz işlemler onaysız tetiklenmemeli.
 *
 * NEDEN VAR (2026-08-22): `/account/privacy` sayfasındaki "Hesabı kapat" butonu
 * **tek tıkla** çalışıyordu — hesap anonimleştiriliyor ve oturum kapatılıyordu.
 * Geri alınamaz bir işlem, hiçbir onay adımı olmadan. Kod tabanındaki diğer tüm
 * yıkıcı işlemlerde onay vardı (`ConfirmDialog`, `askConfirm`, `window.confirm`,
 * ya da bir onay modali); misafirin yapabileceği **en** yıkıcı işlemde yoktu.
 * Mobilde yanlış dokunuş bunun için fazlasıyla kolay.
 *
 * Bu test, o boşluğun sessizce geri gelmesini engeller.
 */

/**
 * Geri alınamaz veya para/veri kaybettiren server action'lar.
 *
 * Yeni bir yıkıcı action eklerken BURAYA da ekleyin — listede olmayan bir action
 * bu korumanın dışında kalır.
 */
const DESTRUCTIVE_ACTIONS = [
  "anonymizeGuestAccountAction",
  "deleteUserAction",
  "deleteReviewAction",
  "deleteCampaignAction",
  "deleteBlogPostAction",
  "cancelBookingAction",
  "rejectBookingAction",
  "rejectShopAction",
];

/**
 * Onay mekanizması sayılan kalıplar.
 *
 * Bir modal açmak da onaydır: kullanıcı ikinci bir bilinçli eylemle devam eder.
 * `BookingsClient` iptal akışı bunu böyle yapıyor ve doğrudur.
 */
const CONFIRM_PATTERNS = [
  "ConfirmDialog",
  "window.confirm",
  "confirm(",
  "askConfirm",
  "setCancelModalBooking",
  "setPendingDelete",
  "pendingDeleteId",
];

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("yıkıcı işlemler onay istiyor", () => {
  it("yıkıcı bir action çağıran her bileşende onay mekanizması var", () => {
    const offenders: string[] = [];

    for (const root of ["src/components", "src/app"]) {
      const abs = path.join(process.cwd(), root);
      if (!fs.existsSync(abs)) continue;
      for (const file of walk(abs)) {
        const src = stripComments(fs.readFileSync(file, "utf8"));
        const used = DESTRUCTIVE_ACTIONS.filter((a) => src.includes(a));
        if (used.length === 0) continue;
        const confirmed = CONFIRM_PATTERNS.some((p) => src.includes(p));
        if (!confirmed) {
          offenders.push(
            `${path.relative(process.cwd(), file)} (${used.join(", ")})`,
          );
        }
      }
    }

    expect(
      offenders,
      `Bu bileşenler geri alınamaz bir işlemi ONAYSIZ tetikliyor:\n` +
        offenders.map((o) => `  ${o}`).join("\n"),
    ).toEqual([]);
  });

  it("yıkıcı action listesi gerçekten var olan action'ları içeriyor", () => {
    // Yeniden adlandirilmis bir action listede kalirsa koruma sessizce delinir.
    const actionsDir = path.join(process.cwd(), "src/actions");
    const allSource = fs
      .readdirSync(actionsDir)
      .filter((f) => f.endsWith(".ts"))
      .map((f) => fs.readFileSync(path.join(actionsDir, f), "utf8"))
      .join("\n");

    const missing = DESTRUCTIVE_ACTIONS.filter(
      (a) => !allSource.includes(`export async function ${a}`),
    );
    expect(
      missing,
      `Bu action'lar artık yok (yeniden adlandırıldı veya silindi); ` +
        `listeyi güncelleyin yoksa koruma boşa çalışır: ${missing.join(", ")}`,
    ).toEqual([]);
  });
});
