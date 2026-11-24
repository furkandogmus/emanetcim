import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { TestProject } from "vitest/node";
import { buildSourceSnapshot } from "./src/__tests__/helpers/source-tree";

declare module "vitest" {
  export interface ProvidedContext {
    sourceSnapshotPath: string;
  }
}

/** Kaynak agacinin anlik goruntusu; neden: `src/__tests__/helpers/source-snapshot.ts`. */
export default function setup(project: TestProject) {
  const file = path.join(os.tmpdir(), `bagajpark-src-snapshot-${process.pid}-${Date.now()}.json`);
  const write = () => fs.writeFileSync(file, JSON.stringify(buildSourceSnapshot()));
  write();
  project.provide("sourceSnapshotPath", file);
  // Izleme kipinde her yeniden kosuda tazelenir; eski icerik taranmasin.
  project.onTestsRerun(() => write());
  return () => fs.rmSync(file, { force: true });
}
