"use client";

import { useLayoutEffect } from "react";

/**
 * Afis bagindaki `?t=` token'i adres cubugundan silinir. Sunucu onu zaten
 * okudu; acik kalirsa analitik (`location.href`), gecmis ve ekran goruntusu
 * 15 dakikalik bagi tasir. Layout efekti, analitik betiginin yuklendigi
 * `useEffect`lerden once calisir.
 */
export default function PosterTokenScrub() {
  useLayoutEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("t")) return;
    url.searchParams.delete("t");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, []);
  return null;
}
