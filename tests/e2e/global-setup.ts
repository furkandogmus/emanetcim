/**
 * Checkout slot ızgarası `ShopTimeSlot` ister; taze bir CI veritabanında slot yoktur.
 * Sunucu ayaktayken (Playwright webServer globalSetup'tan ÖNCE başlar) slot üretimini
 * CRON_SECRET ile bir kez tetikler. Yerelde slot zaten varsa idempotent.
 */
export default async function globalSetup() {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    console.warn("[e2e] CRON_SECRET yok — slot üretimi atlandı (checkout testleri slot ister)");
    return;
  }
  const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
  const res = await fetch(`${base}/api/internal/generate-slots`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });
  console.log(`[e2e] generate-slots → ${res.status} ${(await res.text()).slice(0, 120)}`);
}
