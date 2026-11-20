import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Identity } from "./identity";

import * as SecureStore from "expo-secure-store";

import {
  ApiError,
  api,
  clearTokens,
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

/*
  Son bilinen kullanici. Acilista `/auth/me` ag hatasi ya da 5xx verirse
  (havalimani wifi'si) eskiden token'lar silinip misafir giris ekranina
  atiliyordu. Oturum yalnizca sunucu "gecersiz" derse (401/403) kapanir.
*/
async function rememberUser(user: MobileUser | null) {
  if (user) await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)).catch(() => undefined);
  else await SecureStore.deleteItemAsync(USER_KEY).catch(() => undefined);
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const [impersonating, setImpersonating] = useState<Impersonation | null>(null);
  const queryClient = useQueryClient();

  // Kimlikler arasinda veri sizmasin: onbellek ve cevrimdisi biletler her geciste silinir.
  const resetIdentityData = useCallback(async () => {
    queryClient.clear();
    await clearOfflineTickets().catch(() => undefined);
  }, [queryClient]);

  const stopImpersonation = useCallback(async () => {
    if (!isImpersonating()) return;
    setImpersonationToken(null);
    setImpersonating(null);
    await resetIdentityData();
    try {
      const user = await api<MobileUser>("/auth/me");
      void rememberUser(user);
      setState({ status: "signedIn", user });
    } catch (e) {
      // 401'de oturum-sona-erdi isleyicisi zaten giris ekranina gecirdi.
      if (e instanceof ApiError && e.status === 401) return;
      const cached = await lastKnownUser();
      setState(cached ? { status: "signedIn", user: cached } : { status: "signedOut" });
    }
  }, [resetIdentityData]);

  const startImpersonation = useCallback(
    async (userId: string) => {
      const res = await api<ImpersonationResponse>(`/admin/users/${encodeURIComponent(userId)}/impersonate`, {
        method: "POST",
      });
      await resetIdentityData();
      setImpersonationToken(res.accessToken);
      setImpersonating({ user: res.user, expiresAt: res.expiresAt });
      // `rememberUser` BILEREK yok: onbellekteki kullanici admin olarak kalir.
      setState({ status: "signedIn", user: res.user });
    },
    [resetIdentityData],
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
      forgetPushRegistration();
      void forgetGoogleAccount().catch(() => undefined);
      queryClient.clear();
      setState({ status: "signedOut" });
    });
    (async () => {
      const { accessToken } = await loadTokens();
      if (!accessToken) {
        setState({ status: "signedOut" });
        return;
      }
      try {
        const user = await api<MobileUser>("/auth/me");
        void rememberUser(user);
        setState({ status: "signedIn", user });
      } catch (e) {
        const rejected = e instanceof ApiError && (e.status === 401 || e.status === 403);
        const cached = rejected ? null : await lastKnownUser();
        if (cached) {
          setState({ status: "signedIn", user: cached });
          return;
        }
        await clearTokens();
        void rememberUser(null);
        setState({ status: "signedOut" });
      }
    })();
  }, [queryClient]);

  // E-posta ya da telefon (esnaf); telefonda kod SMS ile gider.
  const requestCode = useCallback(async (id: Identity) => {
    await api("/auth/otp", { method: "POST", body: id, auth: false });
  }, []);

  const startSession = useCallback(async (body: Record<string, string>, path = "/auth/session") => {
    const res = await api<SessionResponse>(path, { method: "POST", body, auth: false });
    await saveTokens(res.accessToken, res.refreshToken);
    void rememberUser(res.user);
    setState({ status: "signedIn", user: res.user });
    return res.user;
  }, []);

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
    setState({ status: "signedIn", user });
    return user;
  }, []);

  const signOut = useCallback(async () => {
    // Goruntulemede "cikis" admini disari atmaz, admin push kaydini da silmez.
    if (isImpersonating()) {
      await stopImpersonation();
      return;
    }
    // Token oturum hala gecerliyken silinir; sonra sunucu tarafi iptal (en iyi caba).
    await unregisterPush();
    await clearOfflineTickets();
    await forgetGoogleAccount();
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    await clearTokens();
    void rememberUser(null);
    // Onbellek temizlenmezse ayni telefonda baska hesapla girildiginde onceki
    // kisinin rezervasyonlari / davet kodu bir an (ya da staleTime boyunca) gorunur.
    queryClient.clear();
    setState({ status: "signedOut" });
  }, [queryClient, stopImpersonation]);

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
