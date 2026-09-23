// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  REASK_AFTER_MS,
  countVisit,
  dismissInstall,
  isInstallDismissed,
  isInstallEligible,
  isIosDevice,
} from "@/lib/pwa-install";

/** Kurulum daveti zamanlamasi (2026-09-23). */
describe("pwa-install", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("kapatilan davet 30 gun sonra yeniden sorulur", () => {
    const now = 1_000_000_000_000;
    dismissInstall(now);
    expect(isInstallDismissed(now + 1000)).toBe(true);
    expect(isInstallDismissed(now + REASK_AFTER_MS + 1)).toBe(false);
  });

  it("eski kalici '1' degeri bugun kapatilmis sayilir, sonsuza dek degil", () => {
    const now = 2_000_000_000_000;
    localStorage.setItem("bagajpark-pwa-install-dismissed", "1");
    expect(isInstallDismissed(now)).toBe(true);
    expect(isInstallDismissed(now + REASK_AFTER_MS + 1)).toBe(false);
  });

  it("ziyaret oturum basina bir kez sayilir", () => {
    expect(countVisit()).toBe(1);
    expect(countVisit()).toBe(1);
    sessionStorage.clear();
    expect(countVisit()).toBe(2);
  });

  it("ilk ziyarette davet yok; ikinci ziyarette ya da rezervasyondan sonra var", () => {
    expect(isInstallEligible(false, 1)).toBe(false);
    expect(isInstallEligible(false, 2)).toBe(true);
    expect(isInstallEligible(true, 1)).toBe(true);
  });

  it("iPhone ve kendini Mac diye tanitan iPad iOS sayilir, masaustu Mac sayilmaz", () => {
    expect(isIosDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)", 5)).toBe(true);
    expect(isIosDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5)).toBe(true);
    expect(isIosDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0)).toBe(false);
    expect(isIosDevice("Mozilla/5.0 (Linux; Android 14)", 5)).toBe(false);
  });
});
