import fs from "node:fs";
import path from "node:path";

/** Depo koku; taramalar cwd'den bagimsiz olsun diye mutlak yol. */
export const REPO_ROOT = path.resolve(__dirname, "../../..");

/** Anlik goruntuye giren kaynak kokleri (depo kokune gore). */
export const SNAPSHOT_ROOTS = ["src", "mobile-expo/src"];

export function walkSourceFiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== "node_modules") walkSourceFiles(p, out);
    } else if (/\.tsx?$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

/** Mutlak yol -> icerik. */
export function buildSourceSnapshot(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const root of SNAPSHOT_ROOTS) {
    for (const f of walkSourceFiles(path.join(REPO_ROOT, root))) {
      out[f] = fs.readFileSync(f, "utf8");
    }
  }
  return out;
}
