import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";

/** Son secilen dukkan: uygulama yeniden acilinca esnaf kaldigi dukkandan devam eder. */
const KEY = "partner_shop";

/**
 * Cok dukkanli esnafin secili dukkani; esnaf ekranlari arasinda TEK kaynak.
 * Ana ekrandaki ozet kartinda secilen dukkan muhur ekraninda da gecerli olmali:
 * stok bir dukkandan okunup talep baskasina acilmasin. `null` = sunucunun web
 * paneliyle ayni varsayilani (`resolvePartnerShops`).
 */
const PartnerShopContext = createContext<[string | null, (id: string | null) => void] | null>(null);

export function PartnerShopProvider({ children }: { children: ReactNode }) {
  const [shopId, setShopId] = useState<string | null>(null);

  // Kayitli id artik bu esnafin degilse sunucu ilk dukkana duser (`resolvePartnerShops`).
  useEffect(() => {
    void SecureStore.getItemAsync(KEY)
      .then((saved) => {
        if (saved) setShopId((cur) => cur ?? saved);
      })
      .catch(() => undefined);
  }, []);

  const select = useCallback((id: string | null) => {
    setShopId(id);
    void (id ? SecureStore.setItemAsync(KEY, id) : SecureStore.deleteItemAsync(KEY)).catch(() => undefined);
  }, []);

  return <PartnerShopContext.Provider value={[shopId, select]}>{children}</PartnerShopContext.Provider>;
}

export function usePartnerShopSelection() {
  const ctx = useContext(PartnerShopContext);
  if (!ctx) throw new Error("usePartnerShopSelection must be used inside PartnerShopProvider");
  return ctx;
}

/** Esnaf ucuna secili dukkani `?shop=` olarak ekler. */
export function withShop(path: string, shopId: string | null | undefined) {
  if (!shopId) return path;
  return `${path}${path.includes("?") ? "&" : "?"}shop=${encodeURIComponent(shopId)}`;
}
