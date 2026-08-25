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
});
