import fs from "node:fs";
import path from "node:path";
import { inject } from "vitest";
import { REPO_ROOT, buildSourceSnapshot } from "./source-tree";

/**
 * Kaynak agacini TEK dosyadan okur.
 *
 * NEDEN VAR (2026-11-24): statik taramalar her test dosyasinda `src`in ~1150
 * dosyasini ayri ayri aciyordu. Tam paket paralel kosarken onlarca isci ayni
 * anda binlerce `open` yapinca tek tarama 150 ms'den 2+ sn'ye cikiyor (16
 * eszamanli taramada olculdu: okuma 125 ms -> 2.1 sn, yorum ayiklama ~20 ms)
 * ve testler 5 sn sinirinda dusuyordu. `vitest.global-setup.ts` agaci kosu
 * basinda bir kez okuyup tek JSON'a yazar; isci onu bir kez acar.
 * Kurulum yoksa (dogrudan import) agac yerinde okunur.
 */
export type SourceFile = { path: string; text: string };

let cache: Record<string, string> | null = null;

function snapshot(): Record<string, string> {
  if (cache) return cache;
  const file = inject("sourceSnapshotPath");
  cache = file && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : buildSourceSnapshot();
  return cache!;
}

/**
 * `dir` (depo kokune gore ya da mutlak) altindaki .ts/.tsx dosyalari, yola gore sirali.
 * `skipDirs`: bu adli klasorlerin altindakiler atlanir (orn. `__tests__`).
 */
export function readSourceTree(dir: string, opts: { skipDirs?: string[] } = {}): SourceFile[] {
  const abs = path.resolve(REPO_ROOT, dir) + path.sep;
  const skip = new Set(opts.skipDirs ?? []);
  return Object.entries(snapshot())
    .filter(([p]) => p.startsWith(abs))
    .filter(([p]) => !path.relative(abs, p).split(path.sep).slice(0, -1).some((seg) => skip.has(seg)))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([p, text]) => ({ path: p, text }));
}
