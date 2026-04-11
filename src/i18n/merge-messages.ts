/**
 * Çeviri eksiklerinde İngilizce tabanı ile birleştirir (Admin vb. tekrar yazılmaz).
 */
export function deepMergeMessages<T extends Record<string, unknown>>(
  base: T,
  override: Partial<T>,
): T {
  const out = structuredClone(base);
  for (const key of Object.keys(override) as (keyof T)[]) {
    const bv = override[key];
    const av = out[key];
    if (
      bv !== null &&
      typeof bv === "object" &&
      !Array.isArray(bv) &&
      av !== null &&
      typeof av === "object" &&
      !Array.isArray(av)
    ) {
      out[key] = deepMergeMessages(
        av as Record<string, unknown>,
        bv as Record<string, unknown>,
      ) as T[keyof T];
    } else if (bv !== undefined) {
      out[key] = bv as T[keyof T];
    }
  }
  return out;
}
