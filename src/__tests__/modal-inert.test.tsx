/**
 * @vitest-environment jsdom
 */
import fs from "node:fs";
import path from "node:path";
import { useRef, useState } from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
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
  const ref = useRef<HTMLDivElement>(null);
  useModalBehavior({ open: true, onClose, ref });
  return (
    <div ref={ref} className="fixed inset-0" data-testid={`${label}-overlay`}>
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
          <p aria-live="polite" data-testid="form-status" />
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
      <section aria-live="polite" data-testid="toaster" />
    </>
  );
}

const isInert = (id: string) => screen.getByTestId(id).hasAttribute("inert");
const inInert = (id: string) => screen.getByTestId(id).closest("[inert]") !== null;

describe("useModalBehavior — arka plan inert", () => {
  it("açılınca modal dışındaki kardeşler inert olur; modalın ataları ve kendisi olmaz", () => {
    render(<Page />);
    fireEvent.click(screen.getByText("dis-ac"));

    expect(isInert("header")).toBe(true);
    expect(isInert("footer")).toBe(true);
    expect(isInert("content")).toBe(true);
    // Modal `<main>` içinde çiziliyor: `<main>` inert olsaydı modal da kilitlenirdi.
    expect(isInert("main")).toBe(false);
    expect(inInert("dis-overlay")).toBe(false);
    // Yalnızca bildirim kabı açık kalır; sayfa içindeki canlı bölge kilitlenir.
    expect(isInert("toaster")).toBe(false);
    expect(inInert("form-status")).toBe(true);
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
    expect(inInert("ic-overlay")).toBe(false);
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
    expect(document.activeElement?.textContent).toBe("acik-ilk");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(isInert("kapali-sheet")).toBe(true);
  });

  it("ref kökü karartmayı da kapsar: diyaloğun kardeşi olan karartma inert olmaz (BottomSheet)", () => {
    function Sheet() {
      const ref = useRef<HTMLDivElement>(null);
      useModalBehavior({ open: true, onClose: () => {}, ref });
      return (
        <div ref={ref}>
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
    expect(inInert("backdrop")).toBe(false);
  });

  it("modal açıkken arka plana sonradan eklenen öğe de inert olur", async () => {
    function Late() {
      const [late, setLate] = useState(false);
      return (
        <>
          <main />
          <Dialog label="m" onClose={() => {}}>
            <button type="button" onClick={() => setLate(true)}>
              gec-ekle
            </button>
          </Dialog>
          {/* `<main>` zaten inert; geç öğe onun KARDEŞİ olmalı ki gözlemci sınansın. */}
          {late && <div data-testid="gec" />}
        </>
      );
    }
    render(<Late />);
    fireEvent.click(screen.getByText("gec-ekle"));
    await waitFor(() => expect(isInert("gec")).toBe(true));
  });
});

/**
 * REGRESYON (QA, 2026-11-23): kök DOM'dan tahmin ediliyordu. `<main>`den SONRA
 * çizilen ve `role="dialog"` taşıyan modal olmayan bir şerit (PWA kurulum
 * şeridi) kök seçiliyor, `<main>` modalla birlikte `inert` oluyor, odak şeride
 * kaçıyordu; şerit kapatılınca da kilit hiç kalkmıyordu.
 */
describe("useModalBehavior — kök ref'ten gelir, DOM'dan tahmin edilmez", () => {
  function Modal({ onClose }: { onClose: () => void }) {
    const ref = useRef<HTMLDivElement>(null);
    useModalBehavior({ open: true, onClose, ref });
    return (
      <div ref={ref} role="dialog" data-testid="modal">
        <button type="button">ok</button>
      </div>
    );
  }
  function WithBanner() {
    const [open, setOpen] = useState(false);
    const [banner, setBanner] = useState(true);
    return (
      <>
        <main data-testid="main">
          <button type="button" onClick={() => setOpen(true)}>
            ac
          </button>
          {open && <Modal onClose={() => setOpen(false)} />}
        </main>
        {banner && (
          <div role="dialog" data-testid="banner">
            <button type="button" onClick={() => setBanner(false)}>
              kapat-serit
            </button>
          </div>
        )}
      </>
    );
  }

  it("sonda başka bir role=dialog varken modal etkileşimli kalır, şerit inert olur", async () => {
    render(<WithBanner />);
    fireEvent.click(screen.getByText("ac"));

    expect(inInert("modal")).toBe(false);
    expect(isInert("main")).toBe(false);
    expect(isInert("banner")).toBe(true);
    expect(document.activeElement?.textContent).toBe("ok");

    // Şerit kendi durumuyla (ör. zaman aşımı) kaldırılınca kilit doğru kalır.
    // jsdom `inert`i uygulamadığı için tıklama, programatik kapanışın yerine geçiyor.
    await act(async () => {
      fireEvent.click(screen.getByText("kapat-serit"));
    });
    expect(screen.queryByTestId("banner")).toBeNull();
    expect(inInert("modal")).toBe(false);
    expect(isInert("main")).toBe(false);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.querySelectorAll("[inert]")).toHaveLength(0);
  });

  it("kök kaldırılıp yeniden bağlanınca (remount) kilit ve Tab yeni düğüme geçer", () => {
    function Remount() {
      const ref = useRef<HTMLDivElement>(null);
      const [k, setK] = useState(0);
      useModalBehavior({ open: true, onClose: () => {}, ref });
      return (
        <>
          <nav data-testid="nav2" />
          <div key={k} ref={ref} data-testid={`root-${k}`}>
            <button type="button" onClick={() => setK(1)}>
              yenile
            </button>
          </div>
        </>
      );
    }
    render(<Remount />);
    fireEvent.click(screen.getByText("yenile"));
    expect(inInert("root-1")).toBe(false);
    expect(isInert("nav2")).toBe(true);

    // Tab tuzağı yeni kökte: tek odaklanabilir öğede Tab yerinde kalır.
    const btn = screen.getByText("yenile");
    btn.focus();
    const ev = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    document.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });

  it("kök DOM'dan React dışı bir yolla kaldırılırsa kilit kalkar (gözlemci silmeyi de izler)", async () => {
    const el = document.createElement("div");
    document.body.append(el);
    function External() {
      useModalBehavior({ open: true, onClose: () => {}, ref: { current: el } });
      return <nav data-testid="nav3" />;
    }
    render(<External />);
    expect(inInert("nav3")).toBe(true);
    await act(async () => {
      el.remove();
    });
    expect(inInert("nav3")).toBe(false);
  });

  it("PWA kurulum şeridi modal değil: role=dialog taşımaz", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/components/PWAInstallBanner.tsx"),
      "utf8",
    );
    expect(src).not.toMatch(/role=["']dialog["']/);
    expect(src).toMatch(/role=["']region["']/);
  });
});
