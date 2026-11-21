import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Identity } from "./identity";

import * as SecureStore from "expo-secure-store";

import {
  ApiError,
  api,
  clearTokens,
  detachSession,
  forgetTokensInMemory,
  isImpersonating,
  loadTokens,
  saveTokens,
  setImpersonationEndedHandler,
  setImpersonationToken,
  setSessionExpiredHandler,
} from "./api";
import i18n from "./i18n";
import { msUntilExpiry, type ImpersonationResponse } from "./impersonation";
import { notify } from "./notify";
import { pickAppleCredential } from "./apple-auth";
import { forgetGoogleAccount, pickGoogleIdToken } from "./google-auth";
import { forgetPushRegistration, unregisterPush } from "./push";
import { clearOfflineTickets } from "./offline-tickets";
import { clearSavedPartnerShop } from "./partner-shop";
import type { MobileUser, SessionResponse } from "./types";

type AuthState =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "signedIn"; user: MobileUser };

/** Yonetici baska bir kullanici olarak goruntuluyorsa o kullanici ve oturumun bitisi. */
export type Impersonation = { user: MobileUser; expiresAt: string };

type AuthContextValue = {
  state: AuthState;
  requestCode: (id: Identity) => Promise<void>;
  verifyCode: (id: Identity, code: string) => Promise<MobileUser>;
  signInWithPassword: (id: Identity, password: string) => Promise<MobileUser>;
  /** Kullanici hesap seciciyi kapatirsa `null`. */
  signInWithGoogle: () => Promise<MobileUser | null>;
  signInWithApple: () => Promise<MobileUser | null>;
  signOut: () => Promise<void>;
  /** Profil degisikliginden sonra: PUT /auth/me yalnizca { success } doner. */
  refreshUser: () => Promise<MobileUser>;
  impersonating: Impersonation | null;
  /** Yalniz ADMIN: hedef kullanicinin paneline gecer (token yalnizca bellekte). */
  startImpersonation: (userId: string) => Promise<void>;
  /** Admin oturumuna doner; admin token'lari hic silinmemistir. */
  stopImpersonation: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const USER_KEY = "bp.user";
/** Goruntuleme acikken yazilir; uygulama o sirada olurse acilista hedefin verisi temizlenir. */
const IMPERSONATION_MARKER_KEY = "bp.impersonating";

/*
  Son bilinen kullanici. Acilista `/auth/me` ag hatasi ya da 5xx verirse
  (havalimani wifi'si) eskiden token'lar silinip misafir giris ekranina
  atiliyordu. Oturum yalnizca sunucu "gecersiz" derse (401/403) kapanir.
  Avatar (2,7 MB'a varan data URL) saklanmaz: buyuk deger SecureStore yazimini dusurup
  onbellegi bos birakiyordu.
*/
async function rememberUser(user: MobileUser | null) {
  if (user) {
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify({ ...user, avatarUrl: null })).catch(() => undefined);
  } else await SecureStore.deleteItemAsync(USER_KEY).catch(() => undefined);
}

async function lastKnownUser(): Promise<MobileUser | null> {
  const raw = await SecureStore.getItemAsync(USER_KEY).catch(() => null);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MobileUser;
  } catch {
    return null;
  }
}

function isRejected(e: unknown) {
  return e instanceof ApiError && (e.status === 401 || e.status === 403);
}

/** Bekleyen kimlik gecisi: eski rolun ekranlari kapandiktan SONRA calisir. */
type PendingSwitch = { run: () => Promise<void>; resolve: () => void; reject: (e: unknown) => void };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const [impersonating, setImpersonating] = useState<Impersonation | null>(null);
  const queryClient = useQueryClient();
  // Oturum-sonu isleyicisi son durumu render beklemeden okur (ayni anda gelen 401'ler tek bildirim versin).
  const stateRef = useRef<AuthState>(state);
  const update = useCallback((next: AuthState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  // Kimlikler arasinda veri sizmasin: onbellek ve cevrimdisi biletler her geciste silinir.
  const resetIdentityData = useCallback(async () => {
    queryClient.clear();
    await clearOfflineTickets().catch(() => undefined);
  }, [queryClient]);

  /*
    Kimlik degisimi (goruntulemeye giris/cikis) once `loading`e gecer: RootNavigator
    null doner ve eski rolun ekranlari kapanir. Token ve onbellek ancak o render
    islendikten sonra degisir; yoksa acik kalan hedef ekranlari admin token'iyla
    (ya da admin ekranlari hedef token'iyla) yeniden istek atiyordu.
  */
  const pendingSwitch = useRef<PendingSwitch | null>(null);
  const switchIdentity = useCallback(
    (run: () => Promise<void>) =>
      new Promise<void>((resolve, reject) => {
        pendingSwitch.current = { run, resolve, reject };
        update({ status: "loading" });
      }),
    [update],
  );
  useEffect(() => {
    const pending = pendingSwitch.current;
    if (state.status !== "loading" || !pending) return;
    pendingSwitch.current = null;
    pending.run().then(pending.resolve, (e: unknown) => {
      // Gecis yarida kaldiysa bos ekranda kalinmaz.
      if (stateRef.current.status === "loading") update({ status: "signedOut" });
      pending.reject(e);
    });
  }, [state, update]);

  const stopImpersonation = useCallback(async () => {
    if (!isImpersonating()) return;
    await switchIdentity(async () => {
      setImpersonationToken(null);
      setImpersonating(null);
      await resetIdentityData();
      await SecureStore.deleteItemAsync(IMPERSONATION_MARKER_KEY).catch(() => undefined);
      // Admin onbellekte (goruntulemede `rememberUser` cagrilmaz): bos ekran /auth/me'yi beklemez.
      const cached = await lastKnownUser();
      if (cached) update({ status: "signedIn", user: cached });
      try {
        const user = await api<MobileUser>("/auth/me");
        void rememberUser(user);
        update({ status: "signedIn", user });
      } catch (e) {
        // 401'de oturum-sona-erdi isleyicisi zaten giris ekranina gecirdi.
        if (isRejected(e) || cached) return;
        update({ status: "signedOut" });
      }
    });
  }, [resetIdentityData, switchIdentity, update]);

  const startImpersonation = useCallback(
    async (userId: string) => {
      const res = await api<ImpersonationResponse & { expiresInSeconds?: number }>(
        `/admin/users/${encodeURIComponent(userId)}/impersonate`,
        { method: "POST" },
      );
      // Goreli sure: cihaz saati kaymis olsa da zamanlayici sunucuyla ayni anda biter.
      const expiresAt =
        typeof res.expiresInSeconds === "number"
          ? new Date(Date.now() + res.expiresInSeconds * 1000).toISOString()
          : res.expiresAt;
      await switchIdentity(async () => {
        await resetIdentityData();
        await SecureStore.setItemAsync(IMPERSONATION_MARKER_KEY, "1").catch(() => undefined);
        setImpersonationToken(res.accessToken);
        setImpersonating({ user: res.user, expiresAt });
        // `rememberUser` BILEREK yok: onbellekteki kullanici admin olarak kalir.
        update({ status: "signedIn", user: res.user });
      });
    },
    [resetIdentityData, switchIdentity, update],
  );

  // 401 (sure doldu, admin yetkisi alindi) ve zamanlayici ayni yoldan cikar.
  const endImpersonation = useCallback(() => {
    if (!isImpersonating()) return;
    void stopImpersonation().catch(() => undefined);
    notify(i18n.t("impersonation.endedTitle"), i18n.t("impersonation.endedBody"));
  }, [stopImpersonation]);
  useEffect(() => {
    setImpersonationEndedHandler(endImpersonation);
  }, [endImpersonation]);

  const expiresAt = impersonating?.expiresAt;
  useEffect(() => {
    if (!expiresAt) return;
    const timer = setTimeout(endImpersonation, msUntilExpiry(expiresAt));
    return () => clearTimeout(timer);
  }, [expiresAt, endImpersonation]);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      const prev = stateRef.current;
      if (prev.status === "signedOut") return;
      forgetPushRegistration();
      void forgetGoogleAccount().catch(() => undefined);
      void resetIdentityData().catch(() => undefined);
      void rememberUser(null);
      update({ status: "signedOut" });
      // Sessizce misafir haritasina dusmek yerine neden: esnaf/yonetici paneline giris gerektigini bilsin.
      const staff = prev.status === "signedIn" && prev.user.role !== "GUEST";
      notify(i18n.t("auth.sessionExpiredTitle"), i18n.t(staff ? "auth.sessionExpiredBodyStaff" : "auth.sessionExpiredBody"));
    });
    (async () => {
      // Yarim kalmis goruntulemeden (uygulama oldu) hedefin biletleri ve dukkan secimi kalmasin.
      if (await SecureStore.getItemAsync(IMPERSONATION_MARKER_KEY).catch(() => null)) {
        await clearOfflineTickets().catch(() => undefined);
        await clearSavedPartnerShop();
        await SecureStore.deleteItemAsync(IMPERSONATION_MARKER_KEY).catch(() => undefined);
      }
      let accessToken: string | null;
      try {
        ({ accessToken } = await loadTokens());
      } catch {
        // Okunamayan anahtar deposu acilis ekranini sonsuza dek tutmasin.
        await clearTokens();
        update({ status: "signedOut" });
        return;
      }
      if (!accessToken) {
        update({ status: "signedOut" });
        return;
      }
      // Onbellekteki kullaniciyla hemen acilir; /auth/me arkadan dogrular (zayif agda 12-36 sn acilis ekrani yok).
      const cached = await lastKnownUser();
      if (cached) update({ status: "signedIn", user: cached });
      try {
        const user = await api<MobileUser>("/auth/me");
        void rememberUser(user);
        update({ status: "signedIn", user });
      } catch (e) {
        if (isRejected(e)) {
          if (stateRef.current.status === "signedOut") return; // isleyici zaten kapatti
          await clearTokens();
          void rememberUser(null);
          update({ status: "signedOut" });
          return;
        }
        if (cached) return;
        // Ag/5xx ve onbellek yok: oturum SILINMEZ, sonraki acilis yeniden dener.
        forgetTokensInMemory();
        update({ status: "signedOut" });
      }
    })().catch(() => update({ status: "signedOut" }));
  }, [queryClient, resetIdentityData, update]);

  // E-posta ya da telefon (esnaf); telefonda kod SMS ile gider.
  const requestCode = useCallback(async (id: Identity) => {
    await api("/auth/otp", { method: "POST", body: id, auth: false });
  }, []);

  const startSession = useCallback(async (body: Record<string, string>, path = "/auth/session") => {
    const res = await api<SessionResponse>(path, { method: "POST", body, auth: false });
    await saveTokens(res.accessToken, res.refreshToken);
    void rememberUser(res.user);
    update({ status: "signedIn", user: res.user });
    return res.user;
  }, [update]);

  const verifyCode = useCallback(
    (id: Identity, code: string) => startSession({ ...id, code }),
    [startSession],
  );

  // Web'de sifre belirlemis kullanicilar ve Play inceleme hesabi icin: OTP
  // e-postasina erisemeyen biri de girebilmeli.
  const signInWithPassword = useCallback(
    (id: Identity, password: string) => startSession({ ...id, password }),
    [startSession],
  );

  // Sunucu ucu ayni oturum govdesini doner (`auth/google`); hesap yoksa misafir acar.
  const signInWithGoogle = useCallback(async () => {
    const idToken = await pickGoogleIdToken();
    if (!idToken) return null;
    return startSession({ idToken }, "/auth/google");
  }, [startSession]);

  // Ayni oturum govdesi (`auth/apple`); ad alanlari yalnizca ilk giriste dolu gelir.
  const signInWithApple = useCallback(async () => {
    const cred = await pickAppleCredential();
    if (!cred) return null;
    const body: Record<string, string> = { identityToken: cred.identityToken };
    if (cred.givenName) body.givenName = cred.givenName;
    if (cred.familyName) body.familyName = cred.familyName;
    return startSession(body, "/auth/apple");
  }, [startSession]);

  const refreshUser = useCallback(async () => {
    const user = await api<MobileUser>("/auth/me");
    if (!isImpersonating()) void rememberUser(user);
    update({ status: "signedIn", user });
    return user;
  }, [update]);

  /*
    Yerel oturum ONCE kapanir, sunucu istekleri arkadan gider: zayif agda iki
    ardisik 12 sn'lik istek bitene kadar "Cikis yap" donuyordu ve uygulamayi
    kapatan kullanici ortak cihazda oturumu acik birakiyordu.
  */
  const signOut = useCallback(async () => {
    // Goruntulemede "cikis" admini disari atmaz, admin push kaydini da silmez.
    if (isImpersonating()) {
      await stopImpersonation();
      return;
    }
    const session = detachSession();
    stateRef.current = { status: "signedOut" };
    await clearTokens();
    void rememberUser(null);
    // Onbellek temizlenmezse ayni telefonda baska hesapla girildiginde onceki
    // kisinin rezervasyonlari / davet kodu bir an (ya da staleTime boyunca) gorunur.
    await resetIdentityData();
    update({ status: "signedOut" });
    void forgetGoogleAccount().catch(() => undefined);
    if (session) {
      // Push silme cikistan once: cikis tokenVersion'i artirir, sonraki istek 401 alirdi.
      // Yakalanan access token'in suresi dolduysa cift bir kez yenilenir (DetachedSession).
      void (async () => {
        await unregisterPush(session);
        await api("/auth/logout", { method: "POST", bearer: session });
      })().catch(() => undefined);
    } else forgetPushRegistration();
  }, [resetIdentityData, stopImpersonation, update]);

  const value = useMemo(
    () => ({
      state,
      requestCode,
      verifyCode,
      signInWithPassword,
      signInWithGoogle,
      signInWithApple,
      signOut,
      refreshUser,
      impersonating,
      startImpersonation,
      stopImpersonation,
    }),
    [
      state,
      requestCode,
      verifyCode,
      signInWithPassword,
      signInWithGoogle,
      signInWithApple,
      signOut,
      refreshUser,
      impersonating,
      startImpersonation,
      stopImpersonation,
    ],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
