/**
 * MapLibre GL v6 ESM-only worker'ini Next.js/Turbopack `import.meta.url` ile
 * cozemiyor -- worker ilk import'ta patliyor, harita monte olur ama hicbir
 * tile istemez (bkz. scripts/copy-maplibre-worker.mjs,ayni kaynak).
 *
 * `predev`/`prebuild` worker + kardes dosyasini `public/maplibre/`e kopyalar;
 * burada o yola isaret ediyoruz. Modul basina BIR KEZ -- birden fazla
 * `setWorkerUrl` cagrisi zararsiz ama gereksiz.
 */
let configured = false;

export function ensureMaplibreWorkerUrl(maplibre: {
  setWorkerUrl: (url: string) => void;
}) {
  if (configured) return;
  configured = true;
  maplibre.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
}
