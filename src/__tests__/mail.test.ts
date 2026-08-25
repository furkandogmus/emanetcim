import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * `sendVerificationEmail` / `sendPasswordResetEmail` / `sendMobileOtp` içerik
 * nesneleri yalnızca `tr`/`en` içeriyordu; kayıt, şifre sıfırlama ve mobil
 * giriş — hesaba erişimin temel akışları — diğer 4 dilde (`de`/`fr`/`ja`/`fa`)
 * Türkçe e-posta gönderiyordu, uygulamanın geri kalanı tam çevrilmişken.
 */

const sendMock = vi.fn().mockResolvedValue({ data: { id: "email-1" }, error: null });

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));

const loggerError = vi.fn();
vi.mock("@/lib/logger", () => ({
  default: { warn: vi.fn(), error: loggerError, info: vi.fn() },
}));

describe("mail.ts — 6 dil desteği", () => {
  beforeEach(() => {
    sendMock.mockClear();
    loggerError.mockClear();
    process.env.RESEND_API_KEY = "test_key";
  });

  /**
   * NEDEN (2026-08-25): bu üç fonksiyon kayıt/şifre-sıfırlama/mobil-giriş
   * akışlarında DOĞRUDAN `await`leniyor. Resend hiç yanıt vermezse (asılı
   * kalırsa) zaman aşımı olmadan istek süresiz askıda kalırdı — hesap DB'de
   * zaten oluşturulmuş olsa bile kullanıcı "Kayıt Ol" ekranında sonsuza kadar
   * dönen bir yükleniyor ikonuyla kalırdı.
   */
  it("sendVerificationEmail Resend hiç yanıt vermezse zaman aşımıyla döner, askıda kalmaz", async () => {
    vi.useFakeTimers();
    try {
      sendMock.mockImplementationOnce(() => new Promise(() => {}));
      const { sendVerificationEmail } = await import("@/lib/mail");

      const promise = sendVerificationEmail("guest@example.com", "tok-1", "tr");
      await vi.advanceTimersByTimeAsync(8000);

      await expect(promise).resolves.toBeUndefined();
      expect(loggerError).toHaveBeenCalledWith(
        expect.objectContaining({ email: "guest@example.com" }),
        "verification_email_exception",
      );
    } finally {
      vi.useRealTimers();
    }
  });

  describe("sendVerificationEmail", () => {
    it.each([
      ["de", "Bestätigen Sie Ihre E-Mail"],
      ["fr", "Vérifiez votre e-mail"],
      ["ja", "メールアドレスを確認してください"],
      ["fa", "ایمیل خود را تأیید کنید"],
    ])("should not fall back to Turkish for %s", async (locale, expectedSubject) => {
      const { sendVerificationEmail } = await import("@/lib/mail");
      await sendVerificationEmail("guest@example.com", "tok-1", locale);

      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({ subject: expectedSubject }),
      );
    });
  });

  describe("sendPasswordResetEmail", () => {
    it.each([
      ["de", "Setzen Sie Ihr Passwort zurück"],
      ["fr", "Réinitialisez votre mot de passe"],
      ["ja", "パスワードをリセットしてください"],
      ["fa", "رمز عبور خود را بازنشانی کنید"],
    ])("should not fall back to Turkish for %s", async (locale, expectedSubject) => {
      const { sendPasswordResetEmail } = await import("@/lib/mail");
      await sendPasswordResetEmail("guest@example.com", "tok-1", locale);

      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({ subject: expectedSubject }),
      );
    });
  });

  describe("sendMobileOtp", () => {
    it.each([
      ["de", "Ihr Anmeldecode"],
      ["fr", "Votre code de connexion"],
      ["ja", "ログインコード"],
      ["fa", "کد ورود شما"],
    ])("should not fall back to Turkish for %s", async (locale, expectedSubject) => {
      const { sendMobileOtp } = await import("@/lib/mail");
      await sendMobileOtp("guest@example.com", "123456", locale);

      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({ subject: expectedSubject }),
      );
    });

    it("wraps the Farsi email body in dir=\"rtl\"", async () => {
      const { sendMobileOtp } = await import("@/lib/mail");
      await sendMobileOtp("guest@example.com", "123456", "fa");

      const call = sendMock.mock.calls.at(-1)?.[0];
      expect(call.html).toContain('dir="rtl"');
    });
  });
});
