/**
 * @vitest-environment jsdom
 *
 * Bu dosya React bileşeni render ediyor; proje genelindeki `node` ortamı yerine
 * dosya bazında jsdom kullanılıyor. Global ayarı değiştirmek, DOM'a ihtiyacı
 * olmayan 300+ testi de yavaşlatırdı.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  CommerceProvider,
  useCommerce,
  usePaymentCopyKey,
} from "@/components/providers/CommerceProvider";

/**
 * Ticari vaat bağlamı.
 *
 * Neden test edilir: 2026-08-22 denetiminde aynı hata sınıfı iki yerde çıktı —
 * kamuya açık metinler arkalarındaki yapılandırmadan bağımsız olarak sabit
 * yazılmıştı: "kartınıza iade edilir" (ödeme sağlayıcısı yokken, P1-19) ve
 * "Sigortalı Emanet" rozeti (`insuranceFeeTry = 0` iken, P1-20).
 *
 * Sözleşme: **yalan söylemek için ayrı bir efor gerekmeli, doğru olan varsayılan
 * olmalı.** En kritik test, sarmalayıcı unutulduğunda ne olduğudur.
 */

function Probe() {
  const { paymentCopyMode, insuranceEnabled, insuranceFeeTry } = useCommerce();
  const k = usePaymentCopyKey();
  return (
    <div>
      <span data-testid="mode">{paymentCopyMode}</span>
      <span data-testid="insurance">{String(insuranceEnabled)}</span>
      <span data-testid="fee">{insuranceFeeTry}</span>
      <span data-testid="key">{k("modifyRefundNote")}</span>
    </div>
  );
}

describe("CommerceProvider", () => {
  beforeEach(() => vi.clearAllMocks());

  it("SARMALAYICI YOKSA ihtiyatlı varsayılana düşer — vaat kazara ortaya çıkmaz", () => {
    // En kritik test: bir gelistirici saglayiciyi sarmalamayi unutursa, sistem
    // "kartla odeme var, sigorta var" DEMEMELI.
    render(<Probe />);

    expect(screen.getByTestId("mode").textContent).toBe("onsite");
    expect(screen.getByTestId("insurance").textContent).toBe("false");
    expect(screen.getByTestId("key").textContent).toBe("modifyRefundNoteOnsite");
  });

  it("dükkanda tahsilat modunda Onsite anahtarı seçilir", () => {
    render(
      <CommerceProvider
        value={{ paymentCopyMode: "onsite", insuranceEnabled: false, insuranceFeeTry: 0 }}
      >
        <Probe />
      </CommerceProvider>,
    );

    expect(screen.getByTestId("key").textContent).toBe("modifyRefundNoteOnsite");
  });

  it("online tahsilat modunda kartlı anahtar KENDİLİĞİNDEN geri gelir", () => {
    // PSP entegre edildigi gun hicbir ceviri dosyasi elle degismez.
    render(
      <CommerceProvider
        value={{ paymentCopyMode: "online", insuranceEnabled: true, insuranceFeeTry: 15 }}
      >
        <Probe />
      </CommerceProvider>,
    );

    expect(screen.getByTestId("key").textContent).toBe("modifyRefundNote");
    expect(screen.getByTestId("insurance").textContent).toBe("true");
    expect(screen.getByTestId("fee").textContent).toBe("15");
  });

  it("sigorta ücreti sıfırken insuranceEnabled false olmalı", () => {
    render(
      <CommerceProvider
        value={{ paymentCopyMode: "onsite", insuranceEnabled: false, insuranceFeeTry: 0 }}
      >
        <Probe />
      </CommerceProvider>,
    );

    expect(screen.getByTestId("insurance").textContent).toBe("false");
  });
});
