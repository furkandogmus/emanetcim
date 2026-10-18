import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import * as SecureStore from "expo-secure-store";

import { ApiError, api, clearTokens, loadTokens, saveTokens, setSessionExpiredHandler } from "./api";
import { unregisterPush } from "./push";
import type { MobileUser, SessionResponse } from "./types";

type AuthState =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "signedIn"; user: MobileUser };

type AuthContextValue = {
  state: AuthState;
  requestCode: (email: string) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<MobileUser>;
  signInWithPassword: (email: string, password: string) => Promise<MobileUser>;
  signOut: () => Promise<void>;
  /** Profil degisikliginden sonra: PUT /auth/me yalnizca { success } doner. */
  refreshUser: () => Promise<MobileUser>;
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

  useEffect(() => {
    setSessionExpiredHandler(() => setState({ status: "signedOut" }));
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
  }, []);

  const requestCode = useCallback(async (email: string) => {
    await api("/auth/otp", { method: "POST", body: { email }, auth: false });
  }, []);

  const startSession = useCallback(async (body: Record<string, string>) => {
    const res = await api<SessionResponse>("/auth/session", { method: "POST", body, auth: false });
    await saveTokens(res.accessToken, res.refreshToken);
    void rememberUser(res.user);
    setState({ status: "signedIn", user: res.user });
    return res.user;
  }, []);

  const verifyCode = useCallback(
    (email: string, code: string) => startSession({ email, code }),
    [startSession],
  );

  // Web'de sifre belirlemis kullanicilar ve Play inceleme hesabi icin: OTP
  // e-postasina erisemeyen biri de girebilmeli.
  const signInWithPassword = useCallback(
    (email: string, password: string) => startSession({ email, password }),
    [startSession],
  );

  const refreshUser = useCallback(async () => {
    const user = await api<MobileUser>("/auth/me");
    void rememberUser(user);
    setState({ status: "signedIn", user });
    return user;
  }, []);

  const signOut = useCallback(async () => {
    // Token oturum hala gecerliyken silinir; sonra sunucu tarafi iptal (en iyi caba).
    await unregisterPush();
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    await clearTokens();
    void rememberUser(null);
    setState({ status: "signedOut" });
  }, []);

  const value = useMemo(
    () => ({ state, requestCode, verifyCode, signInWithPassword, signOut, refreshUser }),
    [state, requestCode, verifyCode, signInWithPassword, signOut, refreshUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
