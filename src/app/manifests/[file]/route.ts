import { buildManifest, isAppLocale, manifestResponse } from "@/lib/pwa-manifest";

/** `/manifests/<dil>.webmanifest` — bkz. `src/lib/pwa-manifest.ts`. */
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const locale = file.replace(/\.webmanifest$/, "");
  if (!file.endsWith(".webmanifest") || !isAppLocale(locale)) {
    return new Response("Not found", { status: 404 });
  }
  return manifestResponse(await buildManifest(locale));
}
