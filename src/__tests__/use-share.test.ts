/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useShare } from "@/lib/hooks/useShare";

/**
 * `navigator.share` yoksa (masaüstü) veya paylaşım başarısız olursa panoya
 * kopyalanıyor. Geri bildirim toast'u sabit İngilizce metindi — `t()`
 * kullanılmadığı için Türkçe dahil hiçbir dilde çevrilmiyordu.
 */

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    key === "linkCopied" ? "Bağlantı panoya kopyalandı" : "Bağlantı kopyalanamadı",
}));

describe("useShare", () => {
  const originalShare = navigator.share;
  const originalClipboard = navigator.clipboard;

  beforeEach(() => {
    toastSuccess.mockClear();
    toastError.mockClear();
  });

  afterEach(() => {
    Object.defineProperty(navigator, "share", { value: originalShare, configurable: true });
    Object.defineProperty(navigator, "clipboard", { value: originalClipboard, configurable: true });
  });

  it("navigator.share yoksa panoya kopyalar ve ÇEVRİLMİŞ metinle bildirir", async () => {
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    const { result } = renderHook(() => useShare());
    await act(async () => {
      await result.current.share({ title: "t", text: "d", url: "https://x.test" });
    });

    expect(writeText).toHaveBeenCalledWith("https://x.test");
    expect(toastSuccess).toHaveBeenCalledWith("Bağlantı panoya kopyalandı");
  });

  it("kopyalama başarısız olursa ÇEVRİLMİŞ hata metniyle bildirir", async () => {
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    const { result } = renderHook(() => useShare());
    await act(async () => {
      await result.current.share({ title: "t", text: "d", url: "https://x.test" });
    });

    expect(toastError).toHaveBeenCalledWith("Bağlantı kopyalanamadı");
  });

  it("navigator.share başarılı olursa panoya kopyalamaz", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    const writeText = vi.fn();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    const { result } = renderHook(() => useShare());
    await act(async () => {
      await result.current.share({ title: "t", text: "d", url: "https://x.test" });
    });

    expect(share).toHaveBeenCalled();
    expect(writeText).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
