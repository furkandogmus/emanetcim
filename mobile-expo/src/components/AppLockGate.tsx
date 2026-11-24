import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AppState, Modal, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, usePathname } from "expo-router";
import { LockKeyhole } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { AppText, Button } from "@/components/ui";
import { authenticate, deviceCanLock, lockEnabledFor, lockOnResume, readLockPref, writeLockPref } from "@/lib/app-lock";
import { AppLockContext, type AppLockValue } from "@/lib/app-lock-context";
import { useAuth } from "@/lib/auth";
import type { Role } from "@/lib/types";
import { colors, space } from "@/theme/tokens";

/*
  Kok yigindaki modal ekranlar (app/_layout.tsx). iOS'ta yerel yigin modali acikken kok
  denetleyici yeni bir RN Modal sunamaz; kilit once bunlari kapatir, acilinca geri acar.
*/
const MODAL_ROUTES = new Set(["/profile", "/profile-edit", "/affiliate", "/affiliate-apply"]);

type Owner = { id: string; role: Role };

/**
 * Esnaf ve yonetici oturumunu biyometri / cihaz koduyla kilitler: soguk acilista ve 5
 * dakikadan uzun arka plandan donuste; taze giristen hemen sonra degil. Iptal kullaniciyi
 * disari atmaz: kilit ekraninda yeniden dene ve cikis durur.
 */
export function AppLockGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { state, impersonating, signOut } = useAuth();
  const pathname = usePathname();

  /*
    Goruntulemede (ve kimlik gecisindeki kisa `loading`te) oturumun sahibi yoneticidir:
    tercih onun kimligiyle okunur, goruntulemeye giris/cikis yeniden kilitlemez.
  */
  const [owner, setOwner] = useState<Owner | null>(null);
  const ownerNow: Owner | null =
    state.status === "signedIn" && !impersonating
      ? { id: state.user.id, role: state.user.role }
      : state.status === "signedOut"
        ? null
        : owner;
  if (ownerNow?.id !== owner?.id || ownerNow?.role !== owner?.role) setOwner(ownerNow);
  const userId = ownerNow?.id ?? null;
  const role = ownerNow?.role ?? null;
  const lockable = userId !== null && role !== null && role !== "GUEST";

  // Giris ekranindan gelen oturum taze: sifre/kod az once girildi, hemen kilitlenmez.
  const [fresh, setFresh] = useState(false);
  if (state.status === "signedOut" && !fresh) setFresh(true);

  const [info, setInfo] = useState<{ userId: string; canLock: boolean; pref: boolean | null } | null>(null);
  const [locked, setLocked] = useState(false);
  const prompting = useRef(false);
  const backgroundedAt = useRef<number | null>(null);
  const resumePath = useRef<string | null>(null);

  useEffect(() => {
    if (!lockable || !userId || !role) return;
    let alive = true;
    void Promise.all([deviceCanLock(), readLockPref(userId)])
      .then(([can, pref]) => {
        if (!alive) return;
        setInfo({ userId, canLock: can, pref });
        setLocked(can && lockEnabledFor(role, pref) && !fresh);
        setFresh(false);
      })
      .catch(() => alive && setInfo({ userId, canLock: false, pref: null }));
    return () => {
      alive = false;
    };
    // Yalniz oturum sahibi degisince; rol ayni kullanicida degismez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, lockable]);

  const current = info && info.userId === userId ? info : null;
  // Kilitlenebilir oturumda durum bilinene kadar icerik gosterilmez.
  const pending = lockable && current === null;
  const canLock = current?.canLock ?? false;
  const enabled = lockable && role !== null && canLock && lockEnabledFor(role, current?.pref ?? null);
  const showLock = enabled && locked;
  const covering = pending || showLock;

  // Kilitliyken acik (ya da derin baglantiyla acilan) modal ekran kapatilir, sonra geri acilir.
  useEffect(() => {
    if (!covering || !MODAL_ROUTES.has(pathname)) return;
    resumePath.current = pathname;
    if (router.canDismiss()) router.dismissAll();
  }, [covering, pathname]);

  const release = useCallback(() => {
    setLocked(false);
    const path = resumePath.current;
    resumePath.current = null;
    if (path) setTimeout(() => router.push(path as never), 0);
  }, []);

  const unlock = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    try {
      const r = await authenticate(t("appLock.prompt"), t("appLock.cancel"));
      if (r === "ok") release();
      // Biyometri/kod kilitliyken kaldirildiysa kimse acamaz: yeniden sor, yoksa kilidi kaldir.
      else if (r === "unavailable" && !(await deviceCanLock())) {
        setInfo((prev) => (prev ? { ...prev, canLock: false } : prev));
        release();
      }
    } finally {
      prompting.current = false;
    }
  }, [release, t]);

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

  // Kilit acilinca istem bir kez kendiliginden gelir (modal ekran kapandiktan sonra); sonrasi dugmeyle.
  const onModalRoute = MODAL_ROUTES.has(pathname);
  useEffect(() => {
    if (showLock && !onModalRoute) void unlock();
  }, [showLock, onModalRoute, unlock]);

  const setEnabled = useCallback(
    async (on: boolean) => {
      if (!userId) return;
      if ((await authenticate(t("appLock.confirmPrompt"), t("appLock.cancel"))) !== "ok") return;
      await writeLockPref(userId, on);
      setInfo((prev) => (prev && prev.userId === userId ? { ...prev, pref: on } : prev));
    },
    [t, userId],
  );

  const value: AppLockValue = { available: lockable && canLock, enabled, covering, setEnabled };

  const content = showLock ? (
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
  ) : (
    <View style={styles.wrap} />
  );

  return (
    <AppLockContext.Provider value={value}>
      {children}
      {covering ? (
        <>
          {/* Agacta ortu: Modal sunulamazsa (ya da sunulana kadar) icerik yine gorunmez. */}
          <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
            {content}
          </View>
          <Modal
            visible={!onModalRoute}
            presentationStyle="fullScreen"
            animationType="none"
            statusBarTranslucent
            navigationBarTranslucent
            // Android geri tusu kilidi kapatmaz.
            onRequestClose={() => undefined}
          >
            {content}
          </Modal>
        </>
      ) : null}
    </AppLockContext.Provider>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.md, padding: space.xl, backgroundColor: colors.bg },
  actions: { alignSelf: "stretch", gap: space.sm, marginTop: space.lg },
});
