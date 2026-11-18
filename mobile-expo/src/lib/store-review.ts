import * as SecureStore from "expo-secure-store";

const KEY = "store_review_asked_at";
const COOLDOWN_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Misafir dukkana 4-5 yildiz verdikten hemen sonra mağaza puani ister: memnun oldugu
 * an. Play kendi kotasini da uygular; 90 gunluk bekleme ayni kisiye sik sormamak icin.
 */
export async function maybeAskForStoreReview(rating: number): Promise<void> {
  if (rating < 4) return;
  // Gec yukleme: modulu tasimayan eski bir derlemede (dev client) ice aktarim cokmesin.
  const StoreReview = await import("expo-store-review").catch(() => null);
  if (!StoreReview || !(await StoreReview.isAvailableAsync())) return;
  const last = Number((await SecureStore.getItemAsync(KEY)) ?? 0);
  if (Date.now() - last < COOLDOWN_MS) return;
  await SecureStore.setItemAsync(KEY, String(Date.now()));
  await StoreReview.requestReview();
}
