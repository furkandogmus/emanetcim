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
import { isInsuranceEnabled } from "@/lib/commerce-context";

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
  const { paymentCopyMode } = useCommerce();
  const k = usePaymentCopyKey();
  return (
    <div>
      <span data-testid="mode">{paymentCopyMode}</span>
      <span data-testid="key">{k("modifyRefundNote")}</span>
    </div>
  );
}

describe("CommerceProvider", () => {
  beforeEach(() => vi.clearAllMocks());

  it("SARMALAYICI YOKSA ihtiyatlı varsayılana düşer — vaat kazara ortaya çıkmaz", () => {
    // En kritik test: bir gelistirici saglayiciyi sarmalamayi unutursa, sistem
    // "kartla odeme var" DEMEMELI.
    render(<Probe />);

    expect(screen.getByTestId("mode").textContent).toBe("onsite");
    expect(screen.getByTestId("key").textContent).toBe("modifyRefundNoteOnsite");
  });

  it("dükkanda tahsilat modunda Onsite anahtarı seçilir", () => {
    render(
      <CommerceProvider
        value={{ paymentCopyMode: "onsite" }}
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
        value={{ paymentCopyMode: "online" }}
      >
        <Probe />
      </CommerceProvider>,
    );

    expect(screen.getByTestId("key").textContent).toBe("modifyRefundNote");
  });

});

describe("isInsuranceEnabled", () => {
  /**
   * Sigorta durumu artık kök layout'tan DEĞİL, kuralları zaten elinde olan
   * yüzeylerden türüyor. Sebep: layout'ta DB sorgusu hem her istekte bir tur
   * demekti hem de `/about`, `/faq`, `/hotels` gibi tamamen içerik sayfalarının
   * statik üretilmesini imkânsız kılıyordu.
   */
  it("ücret sıfırken KAPALI — karşılığı olmayan güvence vaadi verilmez", () => {
    expect(isInsuranceEnabled({ insuranceFeeTry: 0 })).toBe(false);
  });

  it("ücret varsa açık", () => {
    expect(isInsuranceEnabled({ insuranceFeeTry: 15 })).toBe(true);
  });

  it("negatif veya anlamsız değer KAPALI sayılır", () => {
    expect(isInsuranceEnabled({ insuranceFeeTry: -5 })).toBe(false);
    expect(isInsuranceEnabled({ insuranceFeeTry: NaN })).toBe(false);
  });
});
