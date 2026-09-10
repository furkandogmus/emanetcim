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

  /*
    `typedConfirmation` (2026-09-10, hesap kapatma icin eklendi): en yikici
    eylemlerde "yanlislikla tikladim" ihtimalini azaltmak icin ifadeyi
    harfiyen yazma sarti. Opsiyonel oldugu icin bu davranis yalnizca prop
    verildiginde devreye girmeli -- yukaridaki testlerin hicbiri bunu
    kullanmiyor ve hepsi hala gecmeli.
  */
  describe("typedConfirmation", () => {
    it("ifade yazılana kadar onay butonu devre dışı kalır", () => {
      const { onConfirm } = setup({
        typedConfirmation: { phrase: "HESABIMI SİL", label: "Yazın:" },
      });
      const confirmBtn = screen.getByText("Evet, kapat");
      expect(confirmBtn).toBeDisabled();
      fireEvent.click(confirmBtn);
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it("tam (harf duyarlı) eşleşme onay butonunu etkinleştirir", () => {
      const { onConfirm } = setup({
        typedConfirmation: { phrase: "HESABIMI SİL", label: "Yazın:" },
      });
      fireEvent.change(screen.getByRole("textbox"), {
        target: { value: "HESABIMI SİL" },
      });
      const confirmBtn = screen.getByText("Evet, kapat");
      expect(confirmBtn).not.toBeDisabled();
      fireEvent.click(confirmBtn);
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it("harf büyüklüğü farklıysa devre dışı kalır (Türkçe İ/I tuzağına düşmez)", () => {
      setup({ typedConfirmation: { phrase: "HESABIMI SİL", label: "Yazın:" } });
      fireEvent.change(screen.getByRole("textbox"), {
        target: { value: "hesabimi sil" },
      });
      expect(screen.getByText("Evet, kapat")).toBeDisabled();
    });

    it("kısmi/yanlış yazım devre dışı bırakmayı sürdürür", () => {
      setup({ typedConfirmation: { phrase: "HESABIMI SİL", label: "Yazın:" } });
      fireEvent.change(screen.getByRole("textbox"), {
        target: { value: "hesabimi" },
      });
      expect(screen.getByText("Evet, kapat")).toBeDisabled();
    });

    it("typedConfirmation verilmezse davranış eskisiyle birebir aynı kalır", () => {
      setup();
      expect(screen.getByText("Evet, kapat")).not.toBeDisabled();
      expect(screen.queryByRole("textbox")).toBeNull();
    });
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
