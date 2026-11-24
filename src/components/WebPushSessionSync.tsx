"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { rebindBrowserPush } from "@/lib/web-push-client";

/**
 * Giriste (her rol) tarayicida abonelik varsa onu oturumdaki kullaniciya yeniden baglar.
 * `WebPushOptIn` abonelik varken gizlendigi icin baska yoldan baglanamazdi.
 */
export default function WebPushSessionSync() {
  const { data: session, status } = useSession();
  // "Olarak goruntule"de oturum hedefin: abonelik ona baglanmamali (sunucu da 403 doner).
  const userId = status === "authenticated" && !session?.impersonation ? session?.user?.id : undefined;
  const boundFor = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || boundFor.current === userId) return;
    boundFor.current = userId;
    void rebindBrowserPush().catch(() => false);
  }, [userId]);

  return null;
}
