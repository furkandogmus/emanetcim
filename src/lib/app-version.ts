import prisma from "@/lib/db";

/**
 * Mobil uygulama surum kapisi (`PlatformSettings.minAppVersion` /
 * `latestAppVersion`). `getPricingRules()`'tan (platform-settings.ts) BİLİNÇLİ
 * OLARAK ayrı: o fiyatlandırma/rezervasyon kurallarının tek kaynağı,
 * `PricingRules` tipine surum bilgisi karışması ilgisiz iki kavramı birbirine
 * bağlar (fiyat degisikligi surum kapisini de invalide eder gibi bir yaniltici
 * bagimlilik dogar).
 */
export type AppVersionGate = {
  minAppVersion: string | null;
  latestAppVersion: string | null;
};

let cache: { gate: AppVersionGate; at: number } | null = null;
const TTL_MS = 60_000;

export async function getAppVersionGate(): Promise<AppVersionGate> {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return cache.gate;
  }
  const row = await prisma.platformSettings.findUnique({
    where: { id: "default" },
    select: { minAppVersion: true, latestAppVersion: true },
  });
  const gate: AppVersionGate = {
    minAppVersion: row?.minAppVersion ?? null,
    latestAppVersion: row?.latestAppVersion ?? null,
  };
  cache = { gate, at: Date.now() };
  return gate;
}

export function invalidateAppVersionGateCache(): void {
  cache = null;
}
