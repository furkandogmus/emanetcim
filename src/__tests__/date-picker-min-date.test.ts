import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/*
  Misafirin tarih sectigi her takvim gecmis gunleri kapatmali: arama sayfasindaki
  birakma takvimi `minDate` vermedigi icin gecmis tarih secilebiliyordu
  (2026-11-23). Misafir bilesenlerinde `minDate`siz `<DateTimePicker` kalmasin.
*/
function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) files(p, out);
    else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

describe("misafir takvimleri gecmis gunu kapatir", () => {
  it("her <DateTimePicker kullanimi minDate tasir", () => {
    const missing: string[] = [];
    let scanned = 0;
    for (const f of files(join(process.cwd(), "src/components/guest"))) {
      const src = readFileSync(f, "utf-8");
      for (const m of src.matchAll(/<DateTimePicker\b[\s\S]*?\/>/g)) {
        scanned++;
        if (!/\bminDate=/.test(m[0])) missing.push(`${f.replace(process.cwd() + "/", "")}: ${m[0].slice(0, 80)}`);
      }
    }
    expect(scanned, "tarama bozulmus olabilir").toBeGreaterThanOrEqual(6);
    expect(missing).toEqual([]);
  });
});
