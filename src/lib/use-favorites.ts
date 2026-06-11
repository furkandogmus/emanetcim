"use client";

import { useState, useCallback } from "react";

const STORAGE_KEY = "bagajpark_favorite_shops";

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  });

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
