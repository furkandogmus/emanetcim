/**
 * Imlecli liste yardimcilari (sunucu: `../src/lib/cursor-page.ts`). Sayfalar
 * arasinda ayni kayit iki kez gelebilir (liste arada degisti, ilk sayfa yoklamayla
 * yenilendi); FlatList ayni anahtari iki kez gorurse satir karisir.
 */
export function mergeUniqueById<T extends { id: string }>(...lists: T[][]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const list of lists) {
    for (const item of list) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(item);
    }
  }
  return out;
}

/** `useInfiniteQuery` sayfalarini tek listeye indirir. */
export function flattenPages<P, T extends { id: string }>(
  data: { pages: P[] } | undefined,
  pick: (page: P) => T[],
): T[] {
  return data ? mergeUniqueById(...data.pages.map(pick)) : [];
}

/** Eski sunucu `nextCursor` gondermez: o zaman sonraki sayfa yok. */
export function nextCursorOf(page: { nextCursor?: string | null }): string | undefined {
  return page.nextCursor ?? undefined;
}
