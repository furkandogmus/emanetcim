/**
 * @vitest-environment jsdom
 */
import { useState } from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useModalBehavior } from "@/lib/hooks/useModalBehavior";

/**
 * `ConfirmDialog` kendi odak hedefini seçiyor (bkz. confirm-dialog.test.tsx),
 * ama `CheckoutSealsDialog` / galeri lightbox'ı gibi kendi odak mantığı
 * OLMAYAN modallarda, hook'un kendisi açılışta odağı içeri taşımıyordu.
 * Odak tetikleyen düğmede (artık arka planda) kalıyor, Tab'a basana kadar
 * modal açılmamış gibi davranıyordu.
 */
function MinimalDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  useModalBehavior({ open, onClose });
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label="test">
      <button type="button">Birinci</button>
      <button type="button">İkinci</button>
    </div>
  );
}

describe("useModalBehavior — açılışta odak", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("kendi odak mantığı olmayan bir modalda, açılışta odağı ilk odaklanabilir öğeye taşır", () => {
    render(<MinimalDialog open onClose={() => {}} />);
    expect(document.activeElement?.textContent).toBe("Birinci");
  });

  it("tetikleyen düğmede kalan odağı değil, modal içindekini tercih eder", () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Aç
          </button>
          <MinimalDialog open={open} onClose={() => setOpen(false)} />
        </>
      );
    }
    render(<Harness />);
    const trigger = screen.getByText("Aç");
    trigger.focus();
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger);
    expect(document.activeElement?.textContent).toBe("Birinci");
  });

  /**
   * `onClose` cogu cagirandan INLINE bir fonksiyon olarak geliyor (ornek:
   * `ConfirmDialog`'un `onCancel={() => setX(null)}` kullanan cagiranlari).
   * Eskiden `onClose` efektin bagimlilik dizisindeydi: modal acikken ebeveyn
   * BASKA bir nedenle yeniden render olup `onClose`a yeni bir referans
   * verirse efekt sokulup yeniden kuruluyordu -- temizleme adimi odagi
   * tetikleyiciye geri tasiyordu, kullanici modal icindeki bir alana
   * yazarken bile.
   */
  it("onClose her render'da yeni bir referans olsa da, ilgisiz bir yeniden render odagi modalden disari tasimaz", () => {
    // `rerender` ile ayni agaci, her seferinde YENI (inline) bir `onClose`
    // referansiyla yeniden render ediyoruz -- odak degisikligine yol acacak
    // hicbir DOM etkilesimi (tiklama vb.) olmadan, salt render nedeniyle.
    const { rerender } = render(<MinimalDialog open onClose={() => {}} />);
    const second = screen.getByText("İkinci");
    second.focus();
    expect(document.activeElement).toBe(second);

    rerender(<MinimalDialog open onClose={() => {}} />);
    expect(document.activeElement).toBe(second);
  });
});
