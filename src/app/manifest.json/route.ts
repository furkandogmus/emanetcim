import { buildManifest, manifestResponse } from "@/lib/pwa-manifest";

/**
 * Eski adres. 2026-09-23'e kadar `public/manifest.json` statik dosyasiydi ve
 * kurulu uygulamalar / dis baglantilar onu gosteriyor. Artik varsayilan dilin
 * (tr) uretilen manifest'i; tek kaynak `src/lib/pwa-manifest.ts`.
 */
export async function GET() {
  return manifestResponse(await buildManifest());
}
