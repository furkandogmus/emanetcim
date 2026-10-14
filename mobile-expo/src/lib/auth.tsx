import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { api, clearTokens, loadTokens, saveTokens, setSessionExpiredHandler } from "./api";
import type { MobileUser, SessionResponse } from "./types";

type AuthState =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "signedIn"; user: MobileUser };

type AuthContextValue = {
  state: AuthState;
  requestCode: (email: string) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<MobileUser>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

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
        setState({ status: "signedIn", user });
      } catch {
        await clearTokens();
        setState({ status: "signedOut" });
      }
    })();
  }, []);

  const requestCode = useCallback(async (email: string) => {
    await api("/auth/otp", { method: "POST", body: { email }, auth: false });
  }, []);

  const verifyCode = useCallback(async (email: string, code: string) => {
    const res = await api<SessionResponse>("/auth/session", {
      method: "POST",
      body: { email, code },
      auth: false,
    });
    await saveTokens(res.accessToken, res.refreshToken);
    setState({ status: "signedIn", user: res.user });
    return res.user;
  }, []);

  const signOut = useCallback(async () => {
    // Sunucu tarafi iptal en iyi caba; basarisiz olsa da yerel oturum kapanir.
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    await clearTokens();
    setState({ status: "signedOut" });
  }, []);

  const value = useMemo(
    () => ({ state, requestCode, verifyCode, signOut }),
    [state, requestCode, verifyCode, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
