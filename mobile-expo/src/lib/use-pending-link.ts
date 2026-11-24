import { useEffect, useRef } from "react";
import { router, usePathname, useRootNavigationState } from "expo-router";

import { clearPendingLink, deepLinkHref, takePendingLink } from "./deep-link-target";

// Baglantinin actigi giris akisi; bu ekranlar arasinda gezinmek hedefi dusurmez.
const LOGIN_FLOW = new Set(["/login", "/reset-password", "/link"]);
const AUTH_SCREENS = new Set(["/login", "/reset-password"]);

/**
 * Girissiz acilan web baglantisi (`/link`) giristen sonra kaldigi yerden devam eder.
 * Kullanici girisi tamamlamadan akistan cikarsa hedef silinir: sonra baska hesapla giren
 * kisi onceki kisinin rezervasyon ekranina dusmesin.
 */
export function usePendingLinkResume(status: "loading" | "signedIn" | "signedOut", viewingAs: boolean) {
  const pathname = usePathname();
  const navReady = !!useRootNavigationState()?.key;
  const prev = useRef(pathname);

  useEffect(() => {
    const was = prev.current;
    prev.current = pathname;
    if (status === "signedOut" && LOGIN_FLOW.has(was) && !LOGIN_FLOW.has(pathname)) clearPendingLink();
  }, [pathname, status]);

  /*
    Giris bitince korumali yigin giris ekranini kendisi kapatip ilk acik ekrana gider; bu
    gecis bitmeden yapilan yonlendirme ustune yazilir. Yol giris ekranindan ayrilinca devam.
  */
  useEffect(() => {
    if (!navReady || status !== "signedIn" || viewingAs || AUTH_SCREENS.has(pathname)) return;
    const link = takePendingLink();
    if (link) router.replace(deepLinkHref(link));
  }, [navReady, status, viewingAs, pathname]);
}
