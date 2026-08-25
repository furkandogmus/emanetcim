/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useFavorites } from "@/lib/use-favorites";

const STORAGE_KEY = "bagajpark_favorite_shops";

/**
 * `FavoriteButton` sunucuda render edilen listelerin içinde yaşıyor.
 * `localStorage`'ı lazy `useState` initializer'ında okumak sunucuda `[]`,
 * istemcide hydration anında gerçek listeyi üretip React hydration mismatch
 * uyarısına yol açıyordu — bkz. `use-favorites.ts` içindeki yorum.
 */
describe("useFavorites", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });

  it("ilk render'da (mount öncesi) her zaman boş liste döner — hydration mismatch üretmez", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["shop-1"]));
    const { result } = renderHook(() => useFavorites());
    // Effect henüz akışa girmeden ÖNCEKİ senkron render.
    expect(result.current.isFavorite("shop-1")).toBe(false);
  });

  it("mount sonrası localStorage'daki favoriler yüklenir", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["shop-1"]));
    const { result } = renderHook(() => useFavorites());
    await waitFor(() => expect(result.current.isFavorite("shop-1")).toBe(true));
  });

  it("toggleFavorite ekler/çıkarır ve localStorage'a yazar", async () => {
    const { result } = renderHook(() => useFavorites());
    await waitFor(() => expect(result.current.favorites).toEqual([]));

    act(() => result.current.toggleFavorite("shop-2"));
    expect(result.current.isFavorite("shop-2")).toBe(true);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(["shop-2"]);

    act(() => result.current.toggleFavorite("shop-2"));
    expect(result.current.isFavorite("shop-2")).toBe(false);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual([]);
  });
});
