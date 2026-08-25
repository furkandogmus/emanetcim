/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ConfirmDialog from "@/components/common/ConfirmDialog";

/**
 * Yıkıcı onay kutusunun klavye ve erişilebilirlik sözleşmesi.
 *
 * NEDEN (2026-08-22 taraması): kod tabanındaki **hiçbir** modal Escape tuşunu
 * desteklemiyordu ve çoğunda `role="dialog"` yoktu. En kritik olanı buydu: her
 * yıkıcı onayda kullanılan bileşen, klavye kullanıcısının kapatamadığı bir kutu
 * açıyordu — üstelik en dikkat gerektiren anda.
 */

function setup(overrides: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ConfirmDialog
      open
      title="Hesabınızı kapatmak üzeresiniz"
      message="Bu işlem geri alınamaz."
      confirmLabel="Evet, kapat"
      cancelLabel="Vazgeç"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...overrides}
    />,
  );
  return { onConfirm, onCancel };
}

describe("ConfirmDialog", () => {
  beforeEach(() => {
    document.body.style.overflow = "";
  });
  afterEach(() => {
    document.body.innerHTML = "";
    document.body.style.overflow = "";
  });

  it("kapalıyken hiçbir şey render etmez", () => {
    const { onCancel } = setup({ open: false });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("ekran okuyucuya iletişim kutusu olduğunu söyler", () => {
    setup();
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-describedby")).toBeTruthy();
  });

  it("ESCAPE kapatır — klavye kullanıcısının çıkış yolu", () => {
    const { onCancel, onConfirm } = setup();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
    // Escape ASLA onaylamaz.
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("VARSAYILAN ODAK İPTAL'de — Enter yıkıcı eylemi tetiklemez", () => {
    setup();
    expect(document.activeElement?.textContent).toBe("Vazgeç");
  });

  it("dışarı tıklamak iptal eder, onaylamaz", () => {
    const { onCancel, onConfirm } = setup();
    fireEvent.click(screen.getByRole("dialog").parentElement!);
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("kutunun içine tıklamak kapatmaz", () => {
    const { onCancel } = setup();
    fireEvent.click(screen.getByRole("dialog"));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("onay butonu yalnızca tıklanınca çalışır", () => {
    const { onConfirm } = setup();
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Evet, kapat"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("son elemandan Tab ilk elemana döner (focus trap)", () => {
    setup();
    screen.getByText("Evet, kapat").focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement?.textContent).toBe("Vazgeç");
  });

  it("ilk elemandan Shift+Tab son elemana döner (focus trap)", () => {
    setup();
    // Varsayılan odak zaten ilk elemanda (İPTAL).
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement?.textContent).toBe("Evet, kapat");
  });

  it("açıkken arka plan kaydırması kilitlenir, kapanınca geri açılır", () => {
    const { unmount } = render(
      <ConfirmDialog
        open
        message="x"
        confirmLabel="ok"
        cancelLabel="iptal"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).not.toBe("hidden");
  });
});
