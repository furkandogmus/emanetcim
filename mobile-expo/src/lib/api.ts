import * as SecureStore from "expo-secure-store";
import { getLocales } from "expo-localization";

import { API_BASE_URL } from "./config";

const ACCESS_KEY = "bp.accessToken";
const REFRESH_KEY = "bp.refreshToken";

/**
 * Sunucunun dondurdugu hata kodu (`{ error: "insufficient_capacity" }`).
 * Ekranlar ham metni degil `code`u cevirir.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(`${status} ${code}`);
  }
}

let accessToken: string | null = null;
let refreshToken: string | null = null;
let onSessionExpired: (() => void) | null = null;

export async function loadTokens() {
  accessToken = await SecureStore.getItemAsync(ACCESS_KEY);
  refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
  return { accessToken, refreshToken };
}

export async function saveTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  await SecureStore.setItemAsync(ACCESS_KEY, access);
  await SecureStore.setItemAsync(REFRESH_KEY, refresh);
}

export async function clearTokens() {
  accessToken = null;
  refreshToken = null;
  await SecureStore.deleteItemAsync(ACCESS_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}

export function setSessionExpiredHandler(fn: () => void) {
  onSessionExpired = fn;
}

/**
 * Yenileme TEK UCUSTA yapilir. Sunucu refresh token'i tek kullanimlik sayar
 * (jti tekrar kullanimi = tum oturum ailesi iptal, `auth/refresh`). Ayni anda
 * 401 alan iki istek ayri ayri yenilemeye kalksaydi ikincisi kullanicinin
 * butun oturumlarini dusururdu.
 */
let refreshing: Promise<boolean> | null = null;

function refreshOnce(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      if (!refreshToken) return false;
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      }).catch(() => null);
      if (!res?.ok) return false;
      const body = (await res.json()) as { accessToken: string; refreshToken: string };
      await saveTokens(body.accessToken, body.refreshToken);
      return true;
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: boolean;
};

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true } = opts;

  const send = () => {
    const headers: Record<string, string> = {
      Accept: "application/json",
      // Sunucu bildirim dilini bu basliktan cozer (`resolveRequestLocale`).
      "Accept-Language": getLocales()[0]?.languageTag ?? "tr-TR",
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;
    return fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  };

  let res: Response;
  try {
    res = await send();
  } catch {
    throw new ApiError(0, "network");
  }

  if (res.status === 401 && auth && refreshToken) {
    if (await refreshOnce()) {
      res = await send();
    } else {
      await clearTokens();
      onSessionExpired?.();
      throw new ApiError(401, "session_expired");
    }
  }

  const text = await res.text();
  const json = text ? safeJson(text) : null;
  if (!res.ok) {
    const code =
      json && typeof json === "object" && "error" in json && typeof json.error === "string"
        ? json.error
        : `http_${res.status}`;
    throw new ApiError(res.status, code);
  }
  return json as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
