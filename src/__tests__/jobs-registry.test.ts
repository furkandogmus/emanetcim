import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { JOB_REGISTRY, findJob, enforcedJobs } from "@/lib/jobs/registry";

/**
 * Zamanlanmış iş kayıt defteri.
 *
 * Neden test edilir: iş tanımları üç ayrı yere dağılmıştı ve hiçbiri diğerini
 * bilmiyordu. Slot üretimi 37 gün durdu (P0-1), ödeme mutabakat cron'u 2 ay
 * boyunca 404 aldı (P1-1b) — ikisi de kimse fark etmeden. Kayıt defterinin
 * gerçekle ayrışması, tam olarak o hatanın tekrar etmesi demektir (P1-11).
 */

const INTERNAL_DIR = path.join(process.cwd(), "src/app/api/internal");

function endpointNames(): string[] {
  return fs
    .readdirSync(INTERNAL_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

describe("kayıt defteri gerçekle örtüşüyor", () => {
  it("her `/api/internal/<ad>` ucu kayıt defterinde var", () => {
    const missing = endpointNames().filter((n) => !findJob(n));
    expect(
      missing,
      `Bu uçlar src/lib/jobs/registry.ts içinde tanımlı değil — ` +
        `sağlık kontrolü onları izleyemez: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("kayıt defterindeki her işin gerçekten bir ucu var", () => {
    const endpoints = new Set(endpointNames());
    const orphans = JOB_REGISTRY.filter((j) => !endpoints.has(j.name)).map((j) => j.name);
    expect(
      orphans,
      `Bu işler kayıt defterinde var ama uçları yok. Ödeme mutabakat cron'u tam ` +
        `olarak böyle 2 ay boyunca 404 aldı: ${orphans.join(", ")}`,
    ).toEqual([]);
  });

  it("bildirilen sarmalayıcı script'ler gerçekten var", () => {
    for (const job of JOB_REGISTRY) {
      if (!job.script) continue;
      const p = path.join(process.cwd(), job.script);
      expect(fs.existsSync(p), `${job.name} → ${job.script} bulunamadı`).toBe(true);
    }
  });
});

describe("HTTP metodu uçla örtüşüyor", () => {
  /**
   * NEDEN BU TEST VAR: `call-internal-job.sh` sabit POST gönderiyordu, ama
   * `booking-reminders` ve `finance-export` route'ları yalnızca GET export
   * ediyor. İkisi de 405 alıp SESSİZCE düşüyordu -- iş "kurulu" görünüyor,
   * cron çalışıyor, ama hiçbir şey olmuyordu. 2026-08-29'da duman testinde
   * yakalandı; buradaki asıl hata sınıfı bu ("kurulu ama çalışmıyor").
   *
   * Artık metot kayıt defterinde ve bu test route dosyasının gerçekten o metodu
   * export ettiğini doğruluyor. Biri değişip diğeri unutulursa CI kırmızı olur.
   */
  it.each(JOB_REGISTRY.map((j) => [j.name, j.method] as const))(
    "%s: route dosyası '%s' export ediyor",
    (name, method) => {
      const routePath = path.join(
        process.cwd(),
        "src/app/api/internal",
        name,
        "route.ts",
      );
      const src = fs.readFileSync(routePath, "utf8");
      const exported = [...src.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH)/g)]
        .map((m) => m[1]);
      expect(
        exported,
        `${name}: kayıt defteri "${method}" diyor, route ${exported.join("/") || "hiçbir metot"} export ediyor`,
      ).toContain(method);
    },
  );

  it("her işin metodu GET veya POST", () => {
    for (const j of JOB_REGISTRY) {
      expect(["GET", "POST"]).toContain(j.method);
    }
  });
});

describe("kayıt defteri tanımları tutarlı", () => {
  it("iş adları benzersiz", () => {
    const names = JOB_REGISTRY.map((j) => j.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("her işin ne yaptığı VE durursa ne olacağı yazılı", () => {
    // Gerekcesi yazilamayan bir is ya gereksizdir ya da kimse ne yaptigini bilmiyordur.
    for (const j of JOB_REGISTRY) {
      expect(j.what.length, `${j.name}: what bos`).toBeGreaterThan(20);
      expect(j.ifItStops.length, `${j.name}: ifItStops bos`).toBeGreaterThan(20);
    }
  });

  it("cron ifadeleri 5 alanlı", () => {
    for (const j of JOB_REGISTRY) {
      expect(j.cron.trim().split(/\s+/), `${j.name}: "${j.cron}"`).toHaveLength(5);
    }
  });

  it("cron dakikaları :00 ve :30'a yığılmamış", () => {
    // Hepsi ayni dakikada calisirsa tek bir DB yuku tepesi olusur.
    const minutes = JOB_REGISTRY.map((j) => j.cron.trim().split(/\s+/)[0]);
    expect(minutes).not.toContain("0");
    expect(minutes).not.toContain("30");
  });

  it("maxStaleHours cron periyodundan büyük — tek kaçırılan çalışma alarm üretmez", () => {
    for (const j of JOB_REGISTRY) {
      const [, , , , dow] = j.cron.trim().split(/\s+/);
      // Haftalik islerde periyot 168 saat, gunluklerde 24.
      const periodHours = dow === "*" ? 24 : 168;
      expect(
        j.maxStaleHours,
        `${j.name}: maxStaleHours (${j.maxStaleHours}) periyottan (${periodHours}s) büyük olmalı`,
      ).toBeGreaterThan(periodHours);
    }
  });

  it("enforcedJobs yalnızca cron'u kurulmuş işleri döner", () => {
    for (const j of enforcedJobs()) {
      expect(j.enforced).toBe(true);
    }
    // Su an yalnizca generate-slots'un cron'u kurulu (scripts/README.md).
    expect(enforcedJobs().map((j) => j.name)).toEqual(["generate-slots"]);
  });
});
