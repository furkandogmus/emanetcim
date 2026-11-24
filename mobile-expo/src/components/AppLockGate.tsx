import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AppState, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LockKeyhole } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { AppText, Button } from "@/components/ui";
import { authenticate, deviceCanLock, lockEnabledFor, lockOnResume, readLockPref, writeLockPref } from "@/lib/app-lock";
import { useAuth } from "@/lib/auth";
import { colors, space } from "@/theme/tokens";

type AppLockValue = {
  /** Ayar gosterilsin mi: kilitlenebilir rol ve cihazda biyometri/kod var. */
  available: boolean;
  enabled: boolean;
  /** Degisiklik once kimlik dogrulamasi ister; iptal edilirse ayar degismez. */
  setEnabled: (on: boolean) => Promise<void>;
};

const AppLockContext = createContext<AppLockValue>({ available: false, enabled: false, setEnabled: async () => undefined });

export function useAppLock() {
  return useContext(AppLockContext);
}

/**
 * Esnaf ve yonetici oturumunu biyometri / cihaz koduyla kilitler: soguk acilista ve 5
 * dakikadan uzun arka plandan donuste. Iptal kullaniciyi disari atmaz; kilit ekraninda
 * yeniden dene ve cikis yap durur.
 */
export function AppLockGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { state, impersonating, signOut } = useAuth();
  const user = state.status === "signedIn" ? state.user : null;
  // Goruntulemede asil oturum yoneticinindir.
  const role = impersonating ? "ADMIN" : (user?.role ?? null);
  const userId = user?.id ?? null;

  const lockable = userId !== null && role !== null && role !== "GUEST";
  const [info, setInfo] = useState<{ userId: string; canLock: boolean; pref: boolean | null } | null>(null);
  const [locked, setLocked] = useState(false);
  const prompting = useRef(false);
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    if (!lockable || !userId || !role) return;
    let alive = true;
    void Promise.all([deviceCanLock(), readLockPref(userId)])
      .then(([can, pref]) => {
        if (!alive) return;
        setInfo({ userId, canLock: can, pref });
        // Soguk acilis / oturum geri yukleme kilitli baslar.
        setLocked(can && lockEnabledFor(role, pref));
      })
      .catch(() => alive && setInfo({ userId, canLock: false, pref: null }));
    return () => {
      alive = false;
    };
    // Kimlik degisince yeniden degerlendir; rol ayni kullanicida degismez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, lockable]);

  const current = info && info.userId === userId ? info : null;
  const ready = !lockable || current !== null;
  const canLock = current?.canLock ?? false;
  const enabled = lockable && role !== null && canLock && lockEnabledFor(role, current?.pref ?? null);

  const unlock = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    try {
      if (await authenticate(t("appLock.prompt"), t("appLock.cancel"))) setLocked(false);
    } finally {
      prompting.current = false;
    }
  }, [t]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (st) => {
      // iOS'ta Face ID istemi uygulamayi "inactive" yapar; yalnizca gercek arka plan sayilir.
      if (st === "background") backgroundedAt.current = Date.now();
      if (st === "active") {
        if (enabled && !prompting.current && lockOnResume(backgroundedAt.current, Date.now())) setLocked(true);
        backgroundedAt.current = null;
      }
    });
    return () => sub.remove();
  }, [enabled]);

  // Kilit acilinca istem bir kez kendiliginden gelir; sonrasi dugmeyle.
  useEffect(() => {
    if (locked && enabled && ready) void unlock();
  }, [locked, enabled, ready, unlock]);

  const setEnabled = useCallback(
    async (on: boolean) => {
      if (!userId) return;
      if (!(await authenticate(t("appLock.confirmPrompt"), t("appLock.cancel")))) return;
      await writeLockPref(userId, on);
      setInfo((prev) => (prev && prev.userId === userId ? { ...prev, pref: on } : prev));
    },
    [t, userId],
  );

  const value: AppLockValue = { available: lockable && canLock, enabled, setEnabled };

  return (
    <AppLockContext.Provider value={value}>
      {children}
      {enabled && (locked || !ready) ? (
        <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
          <SafeAreaView style={styles.wrap}>
            <LockKeyhole size={40} color={colors.accent} />
            <AppText variant="heading" style={{ textAlign: "center" }}>
              {t("appLock.title")}
            </AppText>
            <AppText style={{ textAlign: "center", color: colors.inkSecondary }}>{t("appLock.body")}</AppText>
            <View style={styles.actions}>
              <Button title={t("appLock.unlock")} onPress={() => void unlock()} />
              <Button variant="ghost" title={t("appLock.signOut")} onPress={() => void signOut().catch(() => undefined)} />
            </View>
          </SafeAreaView>
        </View>
      ) : null}
    </AppLockContext.Provider>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.md, padding: space.xl, backgroundColor: colors.bg },
  actions: { alignSelf: "stretch", gap: space.sm, marginTop: space.lg },
});
