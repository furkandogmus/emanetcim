import { createContext, useContext, useState, type ReactNode } from "react";

/**
 * Cok dukkanli esnafin secili dukkani; esnaf ekranlari arasinda TEK kaynak.
 * Ana ekrandaki ozet kartinda secilen dukkan muhur ekraninda da gecerli olmali:
 * stok bir dukkandan okunup talep baskasina acilmasin. `null` = sunucunun web
 * paneliyle ayni varsayilani (`resolvePartnerShops`).
 */
const PartnerShopContext = createContext<[string | null, (id: string | null) => void] | null>(null);

export function PartnerShopProvider({ children }: { children: ReactNode }) {
  const state = useState<string | null>(null);
  return <PartnerShopContext.Provider value={state}>{children}</PartnerShopContext.Provider>;
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
