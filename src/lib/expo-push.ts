import { fetchWithTimeout } from "@/lib/async-timeout";

/**
 * iOS bildirimleri Expo push servisi uzerinden gider (bkz. `NotificationService.sendMobilePush`).
 * iOS'ta cihazin yerel token'i APNs token'idir; sunucu FCM'e dogrudan gonderdigi icin onu
 * kullanamaz. Uygulama iOS'ta `getExpoPushTokenAsync` ile Expo token'i kaydeder, Expo da
 * APNs'e EAS'taki APNs anahtariyla iletir. `EXPO_ACCESS_TOKEN` istege bagli: Expo
 * hesabinda "push guvenligi" acilirsa zorunlu olur.
 */
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const CHUNK = 100;
const TIMEOUT_MS = 8000;

export function isExpoPushToken(token: string): boolean {
  return /^Expo(nent)?PushToken\[.+\]$/.test(token);
}

type Ticket = { status: "ok" | "error"; message?: string; details?: { error?: string } };

export type ExpoPushResult = {
  successCount: number;
  staleTokens: string[];
  failures: { token: string; error: string }[];
};

export async function sendExpoPush(
  tokens: string[],
  title: string,
  body: string,
  bookingId?: string,
): Promise<ExpoPushResult> {
  const result: ExpoPushResult = { successCount: 0, staleTokens: [], failures: [] };
  const accessToken = process.env.EXPO_ACCESS_TOKEN?.trim();

  for (let i = 0; i < tokens.length; i += CHUNK) {
    const chunk = tokens.slice(i, i + CHUNK);
    const messages = chunk.map((to) => ({
      to,
      title,
      body,
      sound: "default",
      priority: "high",
      data: bookingId ? { bookingId } : {},
    }));
    try {
      const res = await fetchWithTimeout(
        EXPO_PUSH_URL,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify(messages),
        },
        TIMEOUT_MS,
        "expo_push",
      );
      if (!res.ok) {
        for (const token of chunk) result.failures.push({ token, error: `http_${res.status}` });
        continue;
      }
      const json = (await res.json()) as { data?: Ticket[] };
      const tickets = json.data ?? [];
      chunk.forEach((token, j) => {
        const t = tickets[j];
        if (t?.status === "ok") {
          result.successCount += 1;
          return;
        }
        const error = t?.details?.error ?? t?.message ?? "no_ticket";
        // Uygulama silinmis ya da token gecersiz: bir daha denemenin anlami yok.
        if (error === "DeviceNotRegistered") result.staleTokens.push(token);
        result.failures.push({ token, error });
      });
    } catch (e) {
      const error = e instanceof Error ? e.message : "expo_push_failed";
      for (const token of chunk) result.failures.push({ token, error });
    }
  }
  return result;
}
