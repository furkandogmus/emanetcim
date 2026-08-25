"use client";

import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "bagajpark_favorite_shops";

/**
 * `FavoriteButton` sunucuda render edilen listelerin (arama sonuçları, dükkan
 * kartları) içinde yaşıyor. İlk state'i `localStorage`'dan lazy initializer
 * ile okumak sunucuda boş `[]`, istemcinin hydration geçişinde ise gerçek
 * favori listesini üretiyordu — ikisi eşleşmeyince React hydration mismatch
 * uyarısı veriyor, kalp ikonu da bir anlığın "boş → dolu" diye çakıyordu.
 * Okuma `useEffect`'e alınarak ilk render her iki tarafta da `[]` oluyor;
 * gerçek liste mount SONRASI (React'in beklediği, mismatch üretmeyen an) geliyor.
 */
export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) setFavorites(JSON.parse(raw));
      } catch {}
    });
  }, []);

  const toggleFavorite = useCallback((shopId: string) => {
    setFavorites((prev) => {
      const next = prev.includes(shopId)
        ? prev.filter((id) => id !== shopId)
        : [...prev, shopId];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const isFavorite = useCallback(
    (shopId: string) => favorites.includes(shopId),
    [favorites]
  );

  return { favorites, toggleFavorite, isFavorite };
}
