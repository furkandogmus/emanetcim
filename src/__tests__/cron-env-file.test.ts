import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

/*
  Sunucuda sir dosyasi docker-compose.env (secrets-render.sh uretir); .env yok.
  Betik yalnizca .env aradigi icin 2026-10-25'ten itibaren butun cron isleri
  "bulunamadi" diyip hic calismadi. Iki dosya adi da okunmali.
*/
const SCRIPT = join(process.cwd(), "scripts/call-internal-job.sh");
let dir = "";

function run(envName: string) {
  dir = mkdtempSync(join(tmpdir(), "cron-env-"));
  writeFileSync(join(dir, envName), 'CRON_SECRET="test-secret"\n');
  return spawnSync("bash", [SCRIPT, "--job", "x", "--app-dir", dir, "--base-url", "http://127.0.0.1:9", "--timeout", "2"], {
    encoding: "utf-8",
  });
}

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe("call-internal-job.sh sir dosyasi", () => {
  it.each(["docker-compose.env", ".env"])("%s okunur ve istek gonderilir", (name) => {
    const r = run(name);
    const out = r.stdout + r.stderr;
    expect(out).not.toContain("bulunamadi");
    expect(out).toContain("tetikleniyor");
  });

  it("hic dosya yoksa acikca hata verir", () => {
    dir = mkdtempSync(join(tmpdir(), "cron-env-"));
    const r = spawnSync("bash", [SCRIPT, "--job", "x", "--app-dir", dir], { encoding: "utf-8" });
    expect(r.status).not.toBe(0);
    expect(r.stdout + r.stderr).toContain("bulunamadi");
  });
});
