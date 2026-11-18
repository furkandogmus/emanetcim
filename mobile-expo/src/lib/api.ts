import * as SecureStore from "expo-secure-store";

import { API_BASE_URL } from "./config";
import i18n from "./i18n";
import { languageInfo } from "./languages";

/**
 * Sunucu bildirim dilini bu basliktan cozer (web'de de/fr/fa/ja da var). Turkce cihazda
 * profilden English secildiyse cihaz etiketi yanlis olur; o zaman uygulama dili gider.
 */
function requestLanguage() {
  // Once uygulama dili, sonra Ingilizce: sunucu tanimadigi dilde (ru) Turkceye
  // dusuyordu; Rusca telefonla Ingilizce kullanan misafire e-posta Turkce gidiyordu.
  const lang = languageInfo(i18n.language);
  return `${lang.intl}, ${lang.value}, en;q=0.5`;
}

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
    /** Hata yanitinin govdesi (ornegin `schedule_conflict`in `conflicts` listesi). */
    public readonly body?: unknown,
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
 * RN'in fetch'inde zaman asimi yok: zayif wifi'da acilistaki `/auth/me` acilis ekranini
 * onlarca saniye tutuyordu. Iptal edilen istek `network` hatasina duser; acilis o zaman
 * onbellekteki kullaniciyla devam eder (auth.tsx).
 */
const REQUEST_TIMEOUT_MS = 12_000;
const UPLOAD_TIMEOUT_MS = 60_000;

/** `fetch` ve XHR yanitlarinin ortak, kullandigimiz kadarlik yuzu. */
type HttpResponse = { status: number; ok: boolean; text(): Promise<string>; json(): Promise<unknown> };

/**
 * Dosya yuklemesi XHR ile: Expo'nun genel `fetch`i (expo/fetch) React Native'in
 * `{ uri, name, type }` dosya parcasini tanimiyor ve istek sunucuya hic gitmeden
 * "Unsupported FormDataPart implementation" ile dusuyordu; esnafin vitrin fotografi
 * ve profil fotografi bu yuzden "sunucuya ulasilamadi" veriyordu (2026-11-18,
 * emulatorde). RN'nin yerel XHR'si bu parcayi dosyadan okuyup gonderiyor.
 */
function uploadWithXhr(
  url: string,
  init: { method: string; headers: Record<string, string>; body: FormData },
  ms: number,
): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(init.method, url);
    for (const [k, v] of Object.entries(init.headers)) xhr.setRequestHeader(k, v);
    xhr.timeout = ms;
    xhr.onload = () => {
      const text = xhr.responseText ?? "";
      resolve({
        status: xhr.status,
        ok: xhr.status >= 200 && xhr.status < 300,
        text: async () => text,
        json: async () => JSON.parse(text),
      });
    };
    xhr.onerror = () => reject(new Error("network"));
    xhr.ontimeout = () => reject(new Error("timeout"));
    xhr.send(init.body);
  });
}

function fetchWithTimeout(url: string, init: RequestInit, ms = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

/**
 * Yenileme TEK UCUSTA yapilir. Sunucu refresh token'i tek kullanimlik sayar
 * (jti tekrar kullanimi = tum oturum ailesi iptal, `auth/refresh`). Ayni anda
 * 401 alan iki istek ayri ayri yenilemeye kalksaydi ikincisi kullanicinin
 * butun oturumlarini dusururdu.
 */
let refreshing: Promise<RefreshOutcome> | null = null;

/*
  "network": sunucuya ulasilamadi ya da 5xx -- gecici, oturum DUSURULMEZ.
  Eskiden ikisi de `false`ti: refresh anindaki kisa bir ag kopuklugu kullaniciyi
  cikis yaptiriyordu, oysa acilista ayni durum onbellekteki kullaniciyla tolere ediliyor.
*/
type RefreshOutcome = "ok" | "rejected" | "network";

function refreshOnce(): Promise<RefreshOutcome> {
  if (!refreshing) {
    refreshing = (async (): Promise<RefreshOutcome> => {
      if (!refreshToken) return "rejected";
      const res = await fetchWithTimeout(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      }).catch(() => null);
      // 429 (operator NAT'inda paylasilan IP'ye hiz siniri) ve 408 gecicidir: bunlarda
      // token silinip kullanici disari atilmasin.
      if (!res || res.status >= 500 || res.status === 429 || res.status === 408) return "network";
      if (!res.ok) return "rejected";
      const body = (await res.json()) as { accessToken: string; refreshToken: string };
      await saveTokens(body.accessToken, body.refreshToken);
      return "ok";
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
      "Accept-Language": requestLanguage(),
    };
    // FormData (dosya yukleme) icin Content-Type'i fetch koyar: sinir (boundary) dahil.
    const isForm = body instanceof FormData;
    if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";
    if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;
    if (isForm) return uploadWithXhr(`${API_BASE_URL}${path}`, { method, headers, body }, UPLOAD_TIMEOUT_MS);
    return fetchWithTimeout(
      `${API_BASE_URL}${path}`,
      { method, headers, body: body === undefined ? undefined : JSON.stringify(body) },
      REQUEST_TIMEOUT_MS,
    ) as Promise<HttpResponse>;
  };

  let res: HttpResponse;
  try {
    res = await send();
  } catch {
    throw new ApiError(0, "network");
  }

  if (res.status === 401 && auth && refreshToken) {
    const outcome = await refreshOnce();
    if (outcome === "ok") {
      res = await send();
    } else if (outcome === "network") {
      throw new ApiError(0, "network");
    } else {
      await clearTokens();
      onSessionExpired?.();
      throw new ApiError(401, "session_expired");
    }
  } else if (res.status === 401 && auth) {
    // Yenileyecek token yok ama ekran oturum acik saniyor: "bir seyler ters gitti"de
    // takili kalmak yerine giris ekranina don.
    await clearTokens();
    onSessionExpired?.();
    throw new ApiError(401, "session_expired");
  }

  const text = await res.text();
  const json = text ? safeJson(text) : null;
  if (!res.ok) {
    const code =
      json && typeof json === "object" && "error" in json && typeof json.error === "string"
        ? json.error
        : `http_${res.status}`;
    throw new ApiError(res.status, code, json);
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
