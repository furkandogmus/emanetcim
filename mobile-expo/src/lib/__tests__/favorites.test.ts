import { beforeEach, describe, expect, it, jest } from "@jest/globals";

jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    __store: store,
  };
});

import * as SecureStore from "expo-secure-store";

import { __resetFavoritesForTest, MAX_FAVORITES, parseFavorites, toggleFavorite, toggleFavoriteId } from "../favorites";

const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;

beforeEach(() => {
  store.clear();
  __resetFavoritesForTest();
});

describe("toggleFavoriteId", () => {
  it("ekler (en yeni basta) ve ikinci dokunusta cikarir", () => {
    expect(toggleFavoriteId(["a"], "b")).toEqual(["b", "a"]);
    expect(toggleFavoriteId(["b", "a"], "b")).toEqual(["a"]);
  });

  it("sinir asilinca en eski duser", () => {
    const full = Array.from({ length: MAX_FAVORITES }, (_, i) => `s${i}`);
    const next = toggleFavoriteId(full, "new");
    expect(next).toHaveLength(MAX_FAVORITES);
    expect(next[0]).toBe("new");
    expect(next).not.toContain(`s${MAX_FAVORITES - 1}`);
  });
});

describe("parseFavorites", () => {
  it("bozuk kayit bos liste, tekrarlar ve gecersizler atilir", () => {
    expect(parseFavorites(null)).toEqual([]);
    expect(parseFavorites("{oops")).toEqual([]);
    expect(parseFavorites('{"a":1}')).toEqual([]);
    expect(parseFavorites('["a","a",3,"","b"]')).toEqual(["a", "b"]);
  });
});

describe("toggleFavorite", () => {
  it("cihaza yazar", async () => {
    toggleFavorite("shop-1");
    await Promise.resolve();
    expect(JSON.parse(store.get("bp_favorite_shops")!)).toEqual(["shop-1"]);
  });
});
