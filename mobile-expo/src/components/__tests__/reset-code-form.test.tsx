/**
 * Kodla sifre sifirlama formu: gonder dugmesinin kapisi, sunucu kodlarinin metni,
 * tekrar gonderme bekleme suresi. Her test, kurali kaldirilirsa kirilacak sekilde kurulu.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { RESET_RESEND_COOLDOWN_S, ResetCodeForm } from "@/components/ResetCodeForm";
import { ApiError } from "@/lib/api";
import i18n from "@/lib/i18n";

jest.setTimeout(20_000);

jest.mock("expo-secure-store", () => ({}));
jest.mock("expo-haptics", () => ({ selectionAsync: () => Promise.resolve() }));
jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));

const SUBMIT = "Şifreyi güncelle ve giriş yap";
const submitButton = () => screen.getByRole("button", { name: SUBMIT });

async function fill(code: string, password: string) {
  await fireEvent.changeText(screen.getByLabelText("6 haneli kod"), code);
  await fireEvent.changeText(screen.getByLabelText("Yeni şifre"), password);
}

beforeAll(async () => {
  await i18n.changeLanguage("tr");
});

describe("gonder kapisi", () => {
  it("6 hane ve gecerli sifre olmadan kapali; yapistirilan bosluklu kod sayilir", async () => {
    await render(<ResetCodeForm onSubmit={jest.fn(async () => undefined)} onResend={jest.fn(async () => undefined)} />);
    expect(submitButton()).toBeDisabled();
    await fill("12345", "uzunsifre1");
    expect(submitButton()).toBeDisabled();
    await fill("123456", "kisa");
    expect(submitButton()).toBeDisabled();
    await fill("123456", "        ");
    expect(submitButton()).toBeDisabled();
    await fill("123 456", "uzunsifre1");
    expect(screen.getByLabelText("6 haneli kod").props.value).toBe("123456");
    expect(submitButton()).toBeEnabled();
  });

  it("kod ve sifreyi onSubmit'e verir", async () => {
    const onSubmit = jest.fn(async (_c: string, _p: string) => undefined);
    await render(<ResetCodeForm onSubmit={onSubmit} onResend={jest.fn(async () => undefined)} />);
    await fill("654321", "uzunsifre1");
    await fireEvent.press(submitButton());
    expect(onSubmit).toHaveBeenCalledWith("654321", "uzunsifre1");
  });
});

describe("sunucu hata kodlari", () => {
  it.each([
    [400, "invalid_code", "Kod hatalı. E-postadaki 6 haneli kodu kontrol et."],
    [400, "expired_code", "Kodun süresi dolmuş. Yeni bir kod iste."],
    [429, "too_many_attempts", "Çok fazla hatalı deneme. Yeni bir kod iste."],
    [400, "invalid_password", "Bu şifre kullanılamaz. En az 8 karakter olmalı."],
    // Uc henuz yokken (eski sunucu) HTML 404 -> http_404: baglantiya yonlendirir.
    [404, "http_404", "Kodla sıfırlama şu an kullanılamıyor. E-postadaki bağlantıyı kullan."],
  ])("%i %s kendi metnini gosterir", async (status, code, text) => {
    const onSubmit = jest.fn(async () => {
      throw new ApiError(status, code);
    });
    await render(<ResetCodeForm onSubmit={onSubmit} onResend={jest.fn(async () => undefined)} />);
    await fill("123456", "uzunsifre1");
    await fireEvent.press(submitButton());
    expect(screen.getByText(text)).toBeTruthy();
    // Hata sonrasi tekrar denenebilir.
    expect(submitButton()).toBeEnabled();
  });
});

// Sayac her saniye yeni bir zamanlayici kurar (render sonrasi): saniye saniye ilerletilir.
async function seconds(n: number) {
  for (let i = 0; i < n; i++) {
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
  }
}

describe("kodu tekrar gonder", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it(`${RESET_RESEND_COOLDOWN_S} sn kapali; sonra istek atar ve sayac yeniden baslar`, async () => {
    const onResend = jest.fn(async () => undefined);
    await render(<ResetCodeForm onSubmit={jest.fn(async () => undefined)} onResend={onResend} />);
    expect(screen.getByRole("button", { name: `Tekrar gönder (${RESET_RESEND_COOLDOWN_S} sn)` })).toBeDisabled();

    await seconds(RESET_RESEND_COOLDOWN_S - 1);
    expect(screen.getByRole("button", { name: "Tekrar gönder (1 sn)" })).toBeDisabled();

    await seconds(1);
    const resend = screen.getByRole("button", { name: "Kodu tekrar gönder" });
    expect(resend).toBeEnabled();
    await fireEvent.press(resend);
    expect(onResend).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Yeni bir kod gönderdik. En son gelen kodu kullan.")).toBeTruthy();
    expect(screen.getByRole("button", { name: `Tekrar gönder (${RESET_RESEND_COOLDOWN_S} sn)` })).toBeDisabled();
  });
});
