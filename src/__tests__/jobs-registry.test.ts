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

describe("her iş çalıştığını deftere yazıyor", () => {
  /**
   * NEDEN BU TEST VAR: 2026-08-29'da sekiz işin tamamı elle koşturuldu ve
   * SEKİZİ DE HTTP 200 döndü -- ama yalnızca DÖRDÜ `JobRun` tablosuna satır
   * yazdı. Diğer dördü `withJobRun` kullanmıyordu.
   *
   * Sonucu sinsi: `/api/health/jobs` gecikmeyi `JobRun` üzerinden ölçüyor.
   * Defterine yazmayan bir iş, mükemmel çalışsa bile sağlık kontrolü için
   * "hiç koşmamış" görünür. `enforced=true` yapıldığı anda o dört iş sonsuza
   * dek DEGRADED olurdu -- yani gözlemlenebilirlik katmanı, gözlemlediği
   * sağlıklı sistemi bozuk gösterirdi.
   */
  it.each(JOB_REGISTRY.map((j) => [j.name] as const))(
    "%s: route'u withJobRun kullanıyor",
    (name) => {
      const routePath = path.join(
        process.cwd(),
        "src/app/api/internal",
        name,
        "route.ts",
      );
      const src = fs.readFileSync(routePath, "utf8");
      expect(
        src.includes("withJobRun"),
        `${name}: withJobRun yok -> /api/health/jobs bu işi hiç göremez, ` +
          `enforced=true yapılınca sonsuza dek DEGRADED olur`,
      ).toBe(true);
      // Defter adı iş adıyla aynı olmalı; farklıysa sağlık kontrolü yine
      // eşleştiremez ve hata sessizce geri gelir.
      expect(
        src.includes(`withJobRun("${name}"`),
        `${name}: withJobRun farklı bir iş adıyla çağrılmış`,
      ).toBe(true);
    },
  );
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

/**
 * Bir cron ifadesinin GERCEK periyodu, saat cinsinden.
 *
 * NEDEN YENIDEN YAZILDI (2026-09-02): onceki hal yalnizca gun-of-week alanina
 * bakip `dow === "*" ? 24 : 168` diyordu -- yani dakika ve saat alanlarini hic
 * okumadan HER isi gunluk ya da haftalik sayiyordu. Gunde birden sik kosan bir
 * is eklendiginde test onu 24 saatlik sanip `maxStaleHours` esigini gereksiz
 * yere yuksege zorluyordu. Olcmesi gereken seyi olcmuyordu.
 */
function cronPeriodHours(expr: string): number {
  const [minute, hour, , , dow] = expr.trim().split(/\s+/);

  const kacKez = (alan: string, tavan: number): number | null => {
    if (alan === "*") return tavan;
    const step = alan.match(/^\*\/(\d+)$/);
    if (step) return Math.floor(tavan / Number(step[1]));
    if (alan.includes(",")) return alan.split(",").length;
    return null; // tek sabit deger
  };

  const dakikaKez = kacKez(minute, 60);
  if (dakikaKez) return 1 / dakikaKez; // saat icinde birden cok kez

  const saatKez = kacKez(hour, 24);
  if (saatKez) return 24 / saatKez; // gun icinde birden cok kez

  return dow === "*" ? 24 : 168;
}

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
      const periodHours = cronPeriodHours(j.cron);
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
    // 2026-08-29: SEKIZININ DE cron'u kuruldu (ops/crontab.prod), sekizi de
    // canlida elle kosturulup HTTP 200 dondugu ve JobRun'a yazdigi dogrulandi.
    // Onceki beklenti "yalnizca generate-slots kurulu" idi -- artik gecersiz.
    //
    // Bir isi enforced=false'a almak, gecikmesinin saglik kontrolunu DEGRADED
    // YAPMAMASI demektir; yani bir isi sessizce izlenemez hale getirir.
    // Bu liste kisalirsa sebebi commit govdesinde yazili olmali.
    expect(enforcedJobs().length).toBe(JOB_REGISTRY.length);
  });
});
