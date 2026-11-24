import { Redirect } from "expo-router";

import { useAuth } from "@/lib/auth";
import { landingRoute } from "@/lib/shop-access";

/** Capa rota: oturuma ve role gore dogru gruba yonlendirir. */
export default function Index() {
  const { state } = useAuth();
  // Giris yapmadan da gezilebilir: turist harita ve dukkanlari gorur, giris rezervasyonda istenir.
  if (state.status !== "signedIn") return <Redirect href="/home" />;
  // Personel (rolu GUEST) esnaf paneline acilir; kural `shop-access.ts`.
  return <Redirect href={landingRoute(state.user)} />;
}
