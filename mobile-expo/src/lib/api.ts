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

/** Iki token TEK kayitta: ayri iki yazim arasinda surec olurse cift birbirinden kopuyordu. */
const SESSION_KEY = "bp.session";
// Eski surumlerin ayri kayitlari: bir kez okunur, yeni kayda tasinir.
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
/*
  Yonetici "kullanici olarak gir" token'i. Yalnizca bellekte: SecureStore'daki admin
  token'lari dokunulmadan kalir, uygulama yeniden acilinca admin oturumu doner.
*/
let impersonationToken: string | null = null;
let onImpersonationEnded: (() => void) | null = null;

export function setImpersonationToken(token: string | null) {
  impersonationToken = token;
}

export function isImpersonating() {
  return impersonationToken !== null;
}

export function setImpersonationEndedHandler(fn: () => void) {
  onImpersonationEnded = fn;
}

function parseSession(raw: string | null): { accessToken: string; refreshToken: string } | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { accessToken?: unknown; refreshToken?: unknown };
    return typeof v.accessToken === "string" && typeof v.refreshToken === "string"
      ? { accessToken: v.accessToken, refreshToken: v.refreshToken }
      : null;
  } catch {
    return null;
  }
}

/** SecureStore okuma hatasi FIRLATILIR; cagiran (auth.tsx acilisi) yakalar. */
export async function loadTokens() {
  const stored = parseSession(await SecureStore.getItemAsync(SESSION_KEY));
  if (stored) {
    accessToken = stored.accessToken;
    refreshToken = stored.refreshToken;
  } else {
    const legacyAccess = await SecureStore.getItemAsync(ACCESS_KEY);
    const legacyRefresh = await SecureStore.getItemAsync(REFRESH_KEY);
    accessToken = legacyAccess;
    refreshToken = legacyRefresh;
    if (legacyAccess && legacyRefresh) await saveTokens(legacyAccess, legacyRefresh).catch(() => undefined);
  }
  return { accessToken, refreshToken };
}

/**
 * Once diske, sonra bellege: yazim basarisiz olursa bellekteki (sunucunun hala
 * tanidigi) cift degismez.
 *
 * Eski ayri kayitlar BU SURUMDE de guncel yazilir (2026-11-21): OTA ayni runtime'da
 * onceki JS paketine geri alinirsa eski paket yalniz onlari okur. Silinseydi geri
 * almada herkes cikisa duserdi; bayat kalsaydi eski paket kullanilmis refresh
 * token'la gelir, sunucu bunu replay sayip butun oturumlari iptal ederdi.
 * Bir sonraki surumde yazim kalkar, silme yalniz `clearTokens`ta kalir.
 */
export async function saveTokens(access: string, refresh: string) {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify({ accessToken: access, refreshToken: refresh }));
  accessToken = access;
  refreshToken = refresh;
  await SecureStore.setItemAsync(ACCESS_KEY, access).catch(() => undefined);
  await SecureStore.setItemAsync(REFRESH_KEY, refresh).catch(() => undefined);
}

/** Reddetmez: cikis ve oturum sonu yollari bunu beklerken takilmasin. */
export async function clearTokens() {
  accessToken = null;
  refreshToken = null;
  for (const k of [SESSION_KEY, ACCESS_KEY, REFRESH_KEY]) await SecureStore.deleteItemAsync(k).catch(() => undefined);
}

/** Disk kaydina dokunmadan bu surecte oturumsuz devam: acilista sunucuya ulasilamadiysa sonraki acilis dener. */
export function forgetTokensInMemory() {
  accessToken = null;
  refreshToken = null;
}

/**
 * Cikista yerel oturum silinmeden once yakalanan cift; arka plandaki push silme ve
 * `/auth/logout` bununla gider. Access token 15 dk yasar: uzun bosta kalan
 * kullanicida yakalanan token suresi dolmus olur. 401'de cift BIR KEZ yenilenir
 * (modul durumuna ve diske dokunmadan), istekler yeni token'la tekrarlanir. Yoksa
 * push kaydi kalir (cikis yapmis telefona bildirim gider) ve refresh token 30 gun
 * gecerli kalirdi.
 */
export class DetachedSession {
  private renewal: Promise<string | null> | null = null;

  constructor(
    public accessToken: string,
    private readonly refreshToken: string | null,
  ) {}

  /** Yeni access token ya da `null` (yenilenemedi). Tek ucus: ikinci cagiran ayni sonucu alir. */
  renew(): Promise<string | null> {
    if (!this.renewal) {
      this.renewal = (async () => {
        if (!this.refreshToken) return null;
        const res = await fetchWithTimeout(`${API_BASE_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: this.refreshToken }),
        }).catch(() => null);
        if (!res?.ok) return null;
        const body = parseSession(await res.text().catch(() => null));
        if (!body) return null;
        this.accessToken = body.accessToken;
        return body.accessToken;
      })();
    }
    return this.renewal;
  }
}

/** Cikista: yerel oturum silinmeden once cagrilir; oturum yoksa `null`. */
export function detachSession(): DetachedSession | null {
  return accessToken ? new DetachedSession(accessToken, refreshToken) : null;
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
/** Zaman asimina ugrayan yenilemenin tek tekrari: sunucu 60 sn icinde ayni cifti geri verir. */
const REFRESH_RETRY_TIMEOUT_MS = 30_000;
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
export type RefreshOutcome = "ok" | "rejected" | "network";

function refreshOnce(): Promise<RefreshOutcome> {
  if (!refreshing) {
    refreshing = (async (): Promise<RefreshOutcome> => {
      if (!refreshToken) return "rejected";
      const sent = refreshToken;
      const post = (ms: number) =>
        fetchWithTimeout(
          `${API_BASE_URL}/auth/refresh`,
          { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refreshToken: sent }) },
          ms,
        ).catch(() => null);
      // Yanit kaybolduysa sunucu jti'yi yakmis olabilir; tolerans penceresi icindeki tekrar ayni cifti alir.
      const res = (await post(REQUEST_TIMEOUT_MS)) ?? (await post(REFRESH_RETRY_TIMEOUT_MS));
      // 429 (operator NAT'inda paylasilan IP'ye hiz siniri) ve 408 gecicidir: bunlarda
      // token silinip kullanici disari atilmasin.
      if (!res || res.status >= 500 || res.status === 429 || res.status === 408) return "network";
      if (!res.ok) return "rejected";
      const body = parseSession(await res.text().catch(() => null));
      if (!body) return "network";
      try {
        await saveTokens(body.accessToken, body.refreshToken);
      } catch {
        // Diske yazilamadi: cift yine de bu surecte kullanilir, sonraki acilis eski token'la pencereye duser.
        accessToken = body.accessToken;
        refreshToken = body.refreshToken;
      }
      return "ok";
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

/** Uygulama on plana gelince sayac gibi 401 donmeyen uclar icin: suresi dolmus token'i yeniler. */
export function refreshSession(): Promise<RefreshOutcome> {
  return refreshOnce();
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: boolean;
  /**
   * Bu token'la gonder; modulun yenileme yolu ve oturum-sonu isleyicisi CALISMAZ.
   * Cikista yerel oturum silindikten sonra arka planda giden istekler icin.
   * `DetachedSession` verilirse 401'de o cift bir kez yenilenip istek tekrarlanir.
   */
  bearer?: string | DetachedSession;
  /** Ek basliklar (ornegin `Idempotency-Key`); Authorization/Accept bunlari ezmez. */
  headers?: Record<string, string>;
};

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, bearer: explicitBearer, headers: extraHeaders } = opts;
  const auth = explicitBearer ? false : (opts.auth ?? true);

  const send = () => {
    const headers: Record<string, string> = {
      ...extraHeaders,
      Accept: "application/json",
      "Accept-Language": requestLanguage(),
    };
    // FormData (dosya yukleme) icin Content-Type'i fetch koyar: sinir (boundary) dahil.
    const isForm = body instanceof FormData;
    if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";
    const bearer =
      typeof explicitBearer === "string"
        ? explicitBearer
        : (explicitBearer?.accessToken ?? (auth ? (impersonationToken ?? accessToken) : null));
    if (bearer) headers.Authorization = `Bearer ${bearer}`;
    if (isForm) return uploadWithXhr(`${API_BASE_URL}${path}`, { method, headers, body }, UPLOAD_TIMEOUT_MS);
    return fetchWithTimeout(
      `${API_BASE_URL}${path}`,
      { method, headers, body: body === undefined ? undefined : JSON.stringify(body) },
      REQUEST_TIMEOUT_MS,
    ) as Promise<HttpResponse>;
  };

  // Gonderim anindaki kimlik: yanit gelmeden goruntulemeden cikilirsa 401 admin'e yazilmasin.
  const sentWithImpersonation = auth && impersonationToken !== null;
  let res: HttpResponse;
  try {
    res = await send();
  } catch {
    throw new ApiError(0, "network");
  }

  if (res.status === 401 && explicitBearer instanceof DetachedSession) {
    if (await explicitBearer.renew()) {
      try {
        res = await send();
      } catch {
        throw new ApiError(0, "network");
      }
    }
  } else if (res.status === 401 && sentWithImpersonation) {
    // Goruntuleme token'i yenilenmez; 401 admin oturumunu degil goruntulemeyi bitirir.
    onImpersonationEnded?.();
    throw new ApiError(401, "impersonation_ended");
  } else if (res.status === 401 && auth && refreshToken) {
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
