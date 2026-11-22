/**
 * @vitest-environment jsdom
 */
import { useState } from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useModalBehavior } from "@/lib/hooks/useModalBehavior";

/**
 * Modal açıkken arka plan `inert` olmalı: Tab tuzağı VoiceOver'ın sanal imlecini
 * durdurmuyordu (bkz. `src/lib/modal-inert.ts`). jsdom `inert`in davranışını
 * uygulamaz, bu yüzden öznitelik doğrulanıyor; tarayıcı gerisini yapar.
 */

function Dialog({
  label,
  onClose,
  children,
}: {
  label: string;
  onClose: () => void;
  children?: React.ReactNode;
}) {
  useModalBehavior({ open: true, onClose });
  return (
    <div className="fixed inset-0" data-testid={`${label}-overlay`}>
      <div role="dialog" aria-modal="true" aria-label={label}>
        <button type="button">{label}-ilk</button>
        {children}
      </div>
    </div>
  );
}

function Page() {
  const [outer, setOuter] = useState(false);
  const [inner, setInner] = useState(false);
  return (
    <>
      <header data-testid="header">
        <button type="button">logo</button>
      </header>
      <main data-testid="main">
        <section data-testid="content">
          <button type="button" onClick={() => setOuter(true)}>
            dis-ac
          </button>
        </section>
        {outer && (
          <Dialog label="dis" onClose={() => setOuter(false)}>
            <button type="button" onClick={() => setInner(true)}>
              ic-ac
            </button>
          </Dialog>
        )}
        {inner && <Dialog label="ic" onClose={() => setInner(false)} />}
      </main>
      <footer data-testid="footer">altbilgi</footer>
      <div aria-live="polite" data-testid="live" />
    </>
  );
}

const isInert = (id: string) => screen.getByTestId(id).hasAttribute("inert");

describe("useModalBehavior — arka plan inert", () => {
  it("açılınca modal dışındaki kardeşler inert olur; modalın ataları ve kendisi olmaz", () => {
    render(<Page />);
    fireEvent.click(screen.getByText("dis-ac"));

    expect(isInert("header")).toBe(true);
    expect(isInert("footer")).toBe(true);
    expect(isInert("content")).toBe(true);
    // Modal `<main>` içinde çiziliyor: `<main>` inert olsaydı modal da kilitlenirdi.
    expect(isInert("main")).toBe(false);
    expect(isInert("dis-overlay")).toBe(false);
    expect(screen.getByRole("dialog").closest("[inert]")).toBeNull();
    // Canlı bölge açık kalır: modal açıkken çıkan bildirim okunmalı.
    expect(isInert("live")).toBe(false);
  });

  it("kapanınca bütün inert'ler kalkar ve odak açan düğmeye döner", () => {
    render(<Page />);
    const opener = screen.getByText("dis-ac");
    opener.focus();
    fireEvent.click(opener);
    expect(document.activeElement?.textContent).toBe("dis-ilk");

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.querySelectorAll("[inert]")).toHaveLength(0);
    expect(document.activeElement).toBe(opener);
  });

  it("iç içe: içteki açıkken dıştaki de inert; içteki kapanınca arka plan HÂLÂ inert, sonuncu kapanınca serbest", () => {
    render(<Page />);
    const outerOpener = screen.getByText("dis-ac");
    outerOpener.focus();
    fireEvent.click(outerOpener);
    const innerOpener = screen.getByText("ic-ac");
    innerOpener.focus();
    fireEvent.click(innerOpener);

    expect(isInert("dis-overlay")).toBe(true);
    expect(isInert("ic-overlay")).toBe(false);
    expect(isInert("header")).toBe(true);

    // Escape yalnızca en üsttekini kapatır (eskiden ikisi birden kapanıyordu).
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("ic-overlay")).toBeNull();
    expect(screen.getByTestId("dis-overlay")).toBeTruthy();

    expect(isInert("dis-overlay")).toBe(false);
    expect(isInert("header")).toBe(true);
    expect(isInert("content")).toBe(true);
    expect(document.activeElement).toBe(innerOpener);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.querySelectorAll("[inert]")).toHaveLength(0);
    expect(document.activeElement).toBe(outerOpener);
  });

  it("başkasının koyduğu inert'e dokunmaz (kapalı BottomSheet)", () => {
    function WithClosedSheet() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <div inert data-testid="kapali-sheet">
            <div role="dialog" aria-label="kapali">
              <button type="button">gizli</button>
            </div>
          </div>
          <button type="button" onClick={() => setOpen(true)}>
            ac
          </button>
          {open && <Dialog label="acik" onClose={() => setOpen(false)} />}
        </>
      );
    }
    render(<WithClosedSheet />);
    fireEvent.click(screen.getByText("ac"));
    // Kapalı sheet DOM'da sonra değil önce, ama yine de etkin diyalog açık olan.
    expect(document.activeElement?.textContent).toBe("acik-ilk");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(isInert("kapali-sheet")).toBe(true);
  });

  it("data-modal-root: diyaloğun kardeşi olan karartma inert olmaz", () => {
    function Sheet() {
      useModalBehavior({ open: true, onClose: () => {} });
      return (
        <div data-modal-root="">
          <div data-testid="backdrop" />
          <div role="dialog" aria-label="sheet">
            <button type="button">x</button>
          </div>
        </div>
      );
    }
    render(
      <>
        <nav data-testid="nav" />
        <Sheet />
      </>,
    );
    expect(isInert("nav")).toBe(true);
    expect(isInert("backdrop")).toBe(false);
  });

  it("modal açıkken arka plana sonradan eklenen öğe de inert olur", async () => {
    function Late() {
      const [late, setLate] = useState(false);
      return (
        <>
          <main>
            <button type="button" onClick={() => setLate(true)} data-testid="tetik">
              t
            </button>
          </main>
          {/* `<main>` zaten inert; geç öğe onun KARDEŞİ olmalı ki gözlemci sınansın. */}
          {late && <div data-testid="gec" />}
          <Dialog label="m" onClose={() => {}}>
            <button type="button" onClick={() => setLate(true)}>
              gec-ekle
            </button>
          </Dialog>
        </>
      );
    }
    render(<Late />);
    fireEvent.click(screen.getByText("gec-ekle"));
    await waitFor(() => expect(screen.getByTestId("gec").closest("[inert]")).not.toBeNull());
  });
});
