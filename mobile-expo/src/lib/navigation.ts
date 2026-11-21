import { router } from "expo-router";

/**
 * Geri git; gidilecek ekran yoksa (uygulama bir uygulama baglantisindan soguk
 * acildi, yigin tek ekran) ana sayfaya. Cıplak `router.back()` o durumda hicbir
 * sey yapmiyor ve geri oku olu kaliyordu.
 */
export function goBackOr() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}
