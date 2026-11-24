import * as SecureStore from "expo-secure-store";

/**
 * Cihaza ozel rastgele kimlik: girissiz "burada olsun" tikinin sunucudaki dedupe
 * anahtari (web'deki `bp_anon` cerezinin karsiligi). Kisiyi tanimlamaz, baska
 * bir yerde kullanilmaz.
 */
const KEY = "bp_device_id";
let memory: string | null = null;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** RFC 4122 v4. Gizli deger degil: `crypto` yoksa `Math.random` yeter. */
export function randomUuidV4(rand: () => number = Math.random): string {
  const hex = Array.from({ length: 32 }, () => Math.floor(rand() * 16));
  hex[12] = 4;
  hex[16] = (hex[16] & 0x3) | 0x8;
  const h = hex.map((n) => n.toString(16)).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function isUuidV4(v: unknown): v is string {
  return typeof v === "string" && UUID.test(v);
}

export async function getDeviceId(): Promise<string> {
  if (memory) return memory;
  const stored = await SecureStore.getItemAsync(KEY).catch(() => null);
  if (isUuidV4(stored)) return (memory = stored);
  const id = randomUuidV4();
  memory = id;
  // Yazilamazsa bu oturum icin bellekteki kimlik yeter.
  await SecureStore.setItemAsync(KEY, id).catch(() => undefined);
  return id;
}
