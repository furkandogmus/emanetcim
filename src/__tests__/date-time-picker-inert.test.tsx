/**
 * @vitest-environment jsdom
 */
import { useRef, useState } from "react";
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DateTimePicker from "@/components/ui/DateTimePicker";
import BottomSheet from "@/components/ui/BottomSheet";
import { useModalBehavior } from "@/lib/hooks/useModalBehavior";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "tr",
}));

beforeAll(() => {
  // Masaüstü: açılır takvim (mobilde BottomSheet).
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (q: string) => ({
      matches: false,
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
});

/**
 * REGRESYON (QA, 2026-11-23): takvim yalnızca `open && anchor` olunca çiziliyor
 * ve `anchor` bir SONRAKİ render'da geliyor. Hook açılışta düğümü DOM'da
 * bulamayıp kapalı bir `BottomSheet`i (arama sayfasının mobil filtresi) kök
 * seçiyor ve takvimin kendisini `inert` yapıyordu: /search'te ilk açılışta
 * gün seçilemiyordu. Takvim modal değil; sayfayı hiç kilitlememeli.
 */
describe("DateTimePicker — açılır takvim arka planı kilitlemez", () => {
  function SearchLike({ onChange }: { onChange: (v: string) => void }) {
    return (
      <main data-testid="main">
        <DateTimePicker value="" onChange={onChange} ariaLabel="birakis" dateOnly />
        <button type="button" data-testid="other">
          baska
        </button>
        <BottomSheet open={false} onClose={() => {}} ariaLabel="filtre">
          <button type="button">filtre-dugme</button>
        </BottomSheet>
      </main>
    );
  }

  it("ilk açılışta takvim etkileşimli, sayfa inert değil, gün seçilebiliyor", async () => {
    const onChange = vi.fn();
    render(<SearchLike onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "birakis" }));

    const pop = await waitFor(() => {
      const d = document.body.querySelector<HTMLElement>(':scope > [role="dialog"]');
      expect(d).not.toBeNull();
      return d!;
    });
    expect(pop.closest("[inert]")).toBeNull();
    expect(screen.getByTestId("main").hasAttribute("inert")).toBe(false);
    expect(screen.getByTestId("other").closest("[inert]")).toBeNull();
    // Kapalı sheet'in kendi `inert`i duruyor; başka hiçbir şey `inert` değil.
    expect([...document.querySelectorAll("[inert]")].every((el) => el.contains(screen.getByText("filtre-dugme")))).toBe(true);

    const day = await waitFor(() => {
      const b = [...pop.querySelectorAll<HTMLButtonElement>("td button:not([disabled])")][0];
      expect(b).toBeTruthy();
      return b;
    });
    fireEvent.click(day);
    expect(onChange).toHaveBeenCalled();
  });

  it("bir modalın içinde açılınca, body'ye portallanan takvim modalın kilidinden muaf", async () => {
    function ModalWithPicker() {
      const ref = useRef<HTMLDivElement>(null);
      const [v, setV] = useState("");
      useModalBehavior({ open: true, onClose: () => {}, ref });
      return (
        <>
          <header data-testid="hdr" />
          <div ref={ref} role="dialog" data-testid="modal">
            <DateTimePicker value={v} onChange={setV} ariaLabel="tarih" dateOnly />
          </div>
        </>
      );
    }
    render(<ModalWithPicker />);
    fireEvent.click(screen.getByRole("button", { name: "tarih" }));
    const pop = await waitFor(() => {
      const d = document.body.querySelector<HTMLElement>(':scope > [role="dialog"]');
      expect(d).not.toBeNull();
      return d!;
    });
    expect(pop.closest("[inert]")).toBeNull();
    expect(screen.getByTestId("hdr").hasAttribute("inert")).toBe(true);
    expect(screen.getByTestId("modal").closest("[inert]")).toBeNull();

    // Escape yalnızca üstteki takvimi kapatır, modal açık kalır.
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(document.body.querySelector(':scope > [role="dialog"]')).toBeNull());
    expect(screen.getByTestId("modal")).toBeTruthy();
    expect(screen.getByTestId("hdr").hasAttribute("inert")).toBe(true);
  });
});
