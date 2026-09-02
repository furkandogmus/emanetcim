import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { JOB_REGISTRY } from "@/lib/jobs/registry";
import {
  CHECK_IN_REMINDER_WINDOW_MINUTES,
  CHECK_OUT_REMINDER_WINDOW_MINUTES,
  CHECK_IN_REMINDER_SUBJECT_PREFIX,
} from "@/lib/reminder-notice";

/**
 * HATIRLATMA PENCERESI, ISIN PERIYODUNDAN BUYUK OLMAK ZORUNDA.
 *
 * Olculdu (2026-09-02): uc "2 saat icinde check-in yapacaklar" diye
 * sorguluyordu ama `jobs/registry.ts` isi `7 9 * * *` ile GUNDE BIR
 * kosuyordu. Is 09:07'de bir kez calisip yalnizca 09:07-11:07 arasini
 * tariyordu; gunun kalan 22 saatinde check-in yapan hicbir misafir hatirlatma
 * ALMIYORDU. Uc dosyasinin kendi basligi "her 15 dakikada bir calisacak
 * sekilde tasarlanmistir" diyordu -- iki yer sessizce ayrismisti ve is bu
 * haliyle her gun "basarili" raporluyordu.
 *
 * Bu testin olctugu sey bir sayi degil, bir ILISKI: pencere periyottan
 * kucuk oldugu anda arada kapsanmayan bir bosluk olusur ve o boslugun icine
 * dusen her rezervasyon sessizce atlanir.
 */
function cronPeriodMinutes(expr: string): number {
  const [minute, hour, , , dow] = expr.trim().split(/\s+/);
  const kacKez = (alan: string, tavan: number): number | null => {
    if (alan === "*") return tavan;
    const step = alan.match(/^\*\/(\d+)$/);
    if (step) return Math.floor(tavan / Number(step[1]));
    if (alan.includes(",")) return alan.split(",").length;
    return null;
  };
  const dakikaKez = kacKez(minute, 60);
  if (dakikaKez) return 60 / dakikaKez;
  const saatKez = kacKez(hour, 24);
  if (saatKez) return (24 / saatKez) * 60;
  return (dow === "*" ? 24 : 168) * 60;
}

describe("hatirlatma penceresi is periyodunu kapsiyor", () => {
  const job = JOB_REGISTRY.find((j) => j.name === "booking-reminders");

  it("is kayit defterinde duruyor", () => {
    expect(job, "booking-reminders kayit defterinden dusmus").toBeDefined();
  });

  it("check-in penceresi periyottan buyuk", () => {
    const periyot = cronPeriodMinutes(job!.cron);
    expect(
      CHECK_IN_REMINDER_WINDOW_MINUTES,
      `pencere ${CHECK_IN_REMINDER_WINDOW_MINUTES}dk, periyot ${periyot}dk: aradaki fark kapsanmayan bir bosluk`,
    ).toBeGreaterThan(periyot);
  });

  it("check-out penceresi periyottan buyuk", () => {
    const periyot = cronPeriodMinutes(job!.cron);
    expect(CHECK_OUT_REMINDER_WINDOW_MINUTES).toBeGreaterThan(periyot);
  });

  it("gunde bir kosan bir cron bu kapiyi GECEMEZ", () => {
    // Kapinin gercekten kapanip kapanmadigini olcer: hatanin kendisi
    // ("7 9 * * *") bu testte dusmeli, yoksa test bir sey korumuyor demektir.
    expect(cronPeriodMinutes("7 9 * * *")).toBe(1440);
    expect(CHECK_IN_REMINDER_WINDOW_MINUTES).toBeLessThan(1440);
  });
});

/**
 * SIKLASTIRMA TEK BASINA SPAM URETIR: 2 saatlik pencere 15 dakikalik periyotla
 * ayni rezervasyonu SEKIZ calismaya sokar. Tekrar kontrolu bu yuzden pencerenin
 * ayrilmaz parcasi -- pencereyi daraltmak degil.
 */
describe("ayni rezervasyona ikinci hatirlatma gitmiyor", () => {
  const src = readFileSync(
    join(process.cwd(), "src/app/api/internal/booking-reminders/route.ts"),
    "utf-8",
  );

  it("gonderim oncesi NotificationLog sorgulanıyor", () => {
    expect(src).toContain("alreadyNotified");
    expect(src).toMatch(/notificationLog\.findMany/);
  });

  it("her iki hatirlatma dali da kontrolden geciyor", () => {
    expect(src).toMatch(/if \(checkInNotified\.has\(booking\.id\)\) continue;/);
    expect(src).toMatch(/if \(checkOutNotified\.has\(booking\.id\)\) continue;/);
  });

  it("konu metni ortak sabitten geliyor -- sayim ona dayaniyor", () => {
    // Elle yazilan bir konu, tekrar sayimini sessizce sifirlar.
    expect(src).toContain("CHECK_IN_REMINDER_SUBJECT_PREFIX");
    expect(src).not.toContain('"BagajPark: Check-in zamanınız yaklaşıyor! 🎒"');
    expect(CHECK_IN_REMINDER_SUBJECT_PREFIX.length).toBeGreaterThan(10);
  });

  it("tarama siniri asildiginda sessiz kalmiyor", () => {
    expect(src).toContain("booking_reminders_checkin_limit_reached");
    expect(src).toContain("booking_reminders_checkout_limit_reached");
  });
});
