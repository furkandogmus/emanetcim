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

  /**
   * DUZ METIN PARCASI (2026-08-31'de olculdu). Bu uc e-posta Resend'e YALNIZCA
   * `html` veriyordu; `text` alani hic gecilmiyordu. Iki sonucu var:
   *
   *  - HTML-only posta spam filtrelerinde puan kaybeder. Kayit dogrulamasi
   *    spam'e duserse kullanici hesabini hic acamaz ve sebebini goremez.
   *  - Duz metin gosteren istemcilerde, saat bildiriminde ve onizlemede govde
   *    bos ya da bozuk cikar. OTP'de bu dogrudan islevsel: kodu onizlemeden
   *    okuyan kisi kodu goremez.
   */
  it("ucu de Resend'e duz metin parcasi gecer; OTP kodu o metnin icindedir", async () => {
    const { sendVerificationEmail, sendPasswordResetEmail, sendMobileOtp } =
      await import("@/lib/mail");

    await sendVerificationEmail("a@b.com", "tok", "tr");
    await sendPasswordResetEmail("a@b.com", "tok", "tr");
    await sendMobileOtp("a@b.com", "483920", "tr");

    const gonderilenler = sendMock.mock.calls.map((c) => c[0]);
    expect(gonderilenler).toHaveLength(3);

    for (const g of gonderilenler) {
      expect(typeof g.text).toBe("string");
      expect(g.text.length).toBeGreaterThan(20);
      // Duz metin parcasinda HTML olmamali, yoksa amacini kaybeder.
      expect(g.text).not.toContain("<");
    }

    expect(gonderilenler[0].text).toContain("/tr/auth/verify-email?token=tok");
    expect(gonderilenler[1].text).toContain("/tr/auth/new-password?token=tok");
    expect(gonderilenler[2].text).toContain("483920");
  });

  /**
   * KARANLIK MOD. Acik zemin basip metin rengini soylemeyen bir kabuk, e-posta
   * istemcisinin karanlik modunda beyaz-uzerine-beyaz uretir. Her kabugun
   * zemin+renk cifti tam olmali.
   */
  it("her kabuk hem zemin hem metin rengi tasir", async () => {
    const { sendVerificationEmail, sendPasswordResetEmail, sendMobileOtp } =
      await import("@/lib/mail");

    await sendVerificationEmail("a@b.com", "tok", "tr");
    await sendPasswordResetEmail("a@b.com", "tok", "tr");
    await sendMobileOtp("a@b.com", "483920", "tr");

    for (const g of sendMock.mock.calls.map((c) => c[0])) {
      expect(g.html).toContain("background: #ffffff");
      expect(g.html).toContain("color: #111827");
      // rem, Outlook masaustunde guvenilir cozulmez.
      expect(g.html).not.toContain("rem;");
    }
  });

});
