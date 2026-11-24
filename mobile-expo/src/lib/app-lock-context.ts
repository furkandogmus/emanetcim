import { createContext, useContext } from "react";

/** Kilit durumu; `Sheet` gibi hafif bilesenler auth'u yuklemeden okur. */
export type AppLockValue = {
  /** Ayar gosterilsin mi: kilitlenebilir rol ve cihazda biyometri/kod var. */
  available: boolean;
  enabled: boolean;
  /** Kilit ekrani (ya da kilit durumu bilinmiyor) gorunuyor: `Sheet` kendini kapatir. */
  covering: boolean;
  /** Degisiklik once kimlik dogrulamasi ister; iptal edilirse ayar degismez. */
  setEnabled: (on: boolean) => Promise<void>;
};

export const AppLockContext = createContext<AppLockValue>({
  available: false,
  enabled: false,
  covering: false,
  setEnabled: async () => undefined,
});

export function useAppLock() {
  return useContext(AppLockContext);
}
