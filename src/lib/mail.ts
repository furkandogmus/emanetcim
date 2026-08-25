import { Resend } from "resend";
import logger from "@/lib/logger";
import { withTimeout } from "@/lib/async-timeout";

/**
 * NEDEN (2026-08-25): bu üç fonksiyon kayıt/şifre-sıfırlama/mobil-giriş
 * akışlarında DOĞRUDAN `await`leniyor (bkz. `actions/register.ts`,
 * `actions/password-reset.ts`, `api/mobile/auth/otp/route.ts) — yani
 * misafirin "Kayıt Ol" / "Şifremi Sıfırla" butonuna tıkladığı istek, bu e-posta
 * gönderimi bitene kadar sonuçlanmaz. Resend'e yapılan `fetch` çağrısında hiç
 * zaman aşımı yoktu: Resend yavaşlarsa ya da yanıt vermezse istek SÜRESİZ
 * askıda kalır — hesap DB'de zaten oluşturulmuş olsa bile kullanıcı "Kayıt
 * Ol" ekranında sonsuza kadar dönen bir yükleniyor ikonuyla kalırdı.
 */
const MAIL_SEND_TIMEOUT_MS = 8000;

function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  return new Resend(key);
}

const domain = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const sendVerificationEmail = async (email: string, token: string, locale: string = "tr") => {
  const resend = getResendClient();
  if (!resend) {
    logger.warn({}, "mail_verification_skipped_no_resend_key");
    return;
  }

  const confirmLink = `${domain}/${locale}/auth/verify-email?token=${token}`;

  /**
   * NEDEN 6 DİL (2026-08-25'te ölçüldü): bu nesne yalnızca `tr`/`en` içeriyordu;
   * diğer 4 dilde kayıt olan kullanıcı (uygulamanın geri kalanı tam çevrilmişken)
   * doğrulama e-postasını Türkçe alıyordu — kayıt akışının en kritik adımı.
   */
  const content = {
    tr: {
      subject: "E-postanızı Doğrulayın",
      title: "BagajPark'a Hoş Geldiniz!",
      text: "Hesabınızı doğrulamak için lütfen aşağıdaki butona tıklayın:",
      button: "E-postayı Doğrula",
      footer: "Eğer bu işlemi siz yapmadıysanız bu e-postayı görmezden gelebilirsiniz."
    },
    en: {
      subject: "Verify Your Email",
      title: "Welcome to BagajPark!",
      text: "Please click the button below to verify your account:",
      button: "Verify Email",
      footer: "If you did not perform this action, you can safely ignore this email."
    },
    de: {
      subject: "Bestätigen Sie Ihre E-Mail",
      title: "Willkommen bei BagajPark!",
      text: "Bitte klicken Sie auf die Schaltfläche unten, um Ihr Konto zu bestätigen:",
      button: "E-Mail bestätigen",
      footer: "Wenn Sie diese Aktion nicht durchgeführt haben, können Sie diese E-Mail ignorieren."
    },
    fr: {
      subject: "Vérifiez votre e-mail",
      title: "Bienvenue chez BagajPark !",
      text: "Veuillez cliquer sur le bouton ci-dessous pour vérifier votre compte :",
      button: "Vérifier l'e-mail",
      footer: "Si vous n'êtes pas à l'origine de cette action, vous pouvez ignorer cet e-mail en toute sécurité."
    },
    ja: {
      subject: "メールアドレスを確認してください",
      title: "BagajParkへようこそ！",
      text: "アカウントを確認するには、下のボタンをクリックしてください：",
      button: "メールを確認",
      footer: "このアクションに心当たりがない場合は、このメールを無視していただいて構いません。"
    },
    fa: {
      subject: "ایمیل خود را تأیید کنید",
      title: "به BagajPark خوش آمدید!",
      text: "برای تأیید حساب خود، لطفاً روی دکمه زیر کلیک کنید:",
      button: "تأیید ایمیل",
      footer: "اگر این کار را شما انجام نداده‌اید، می‌توانید این ایمیل را نادیده بگیرید."
    }
  }[locale] || {
    tr: {
      subject: "E-postanızı Doğrulayın",
      title: "BagajPark'a Hoş Geldiniz!",
      text: "Hesabınızı doğrulamak için lütfen aşağıdaki butona tıklayın:",
      button: "E-postayı Doğrula",
      footer: "Eğer bu işlemi siz yapmadıysanız bu e-postayı görmezden gelebilirsiniz."
    }
  }.tr;

  try {
    const { data, error } = await withTimeout(
      resend.emails.send({
        from: process.env.RESEND_FROM || "BagajPark <info@bagajpark.com>",
        to: email,
        subject: content.subject,
        html: `
        <div dir="${locale === "fa" ? "rtl" : "ltr"}" style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #ea580c;">${content.title}</h1>
          <p style="color: #374151;">${content.text}</p>
          <a href="${confirmLink}"
             style="display: inline-block; background-color: #ea580c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0;">
            ${content.button}
          </a>
          <p style="margin-top: 24px; font-size: 0.875rem; color: #6b7280;">
            ${content.footer}
          </p>
        </div>
      `,
      }),
      MAIL_SEND_TIMEOUT_MS,
      "verification_email_send",
    );

    if (error) {
      logger.error({ error, email }, "verification_email_error");
    } else {
      logger.info({ email, id: data?.id }, "verification_email_sent");
    }
  } catch (error) {
    logger.error({ error, email }, "verification_email_exception");
  }
};

export const sendPasswordResetEmail = async (email: string, token: string, locale: string = "tr") => {
  const resend = getResendClient();
  if (!resend) {
    logger.warn({}, "mail_password_reset_skipped_no_resend_key");
    return;
  }

  const resetLink = `${domain}/${locale}/auth/new-password?token=${token}`;

  /**
   * NEDEN 6 DİL: bu nesne yalnızca `tr`/`en` içeriyordu; şifre sıfırlama —
   * hesabınıza tekrar erişmenin tek yolu — diğer 4 dilde Türkçe geliyordu.
   */
  const content = {
    tr: {
      subject: "Şifrenizi Sıfırlayın",
      title: "Şifre Sıfırlama İsteği",
      text: "Şifrenizi sıfırlamak için lütfen aşağıdaki butona tıklayın:",
      button: "Şifreyi Sıfırla",
      footer: "Eğer bu işlemi siz yapmadıysanız bu e-postayı görmezden gelebilirsiniz."
    },
    en: {
      subject: "Reset Your Password",
      title: "Password Reset Request",
      text: "Please click the button below to reset your password:",
      button: "Reset Password",
      footer: "If you did not perform this action, you can safely ignore this email."
    },
    de: {
      subject: "Setzen Sie Ihr Passwort zurück",
      title: "Anfrage zum Zurücksetzen des Passworts",
      text: "Bitte klicken Sie auf die Schaltfläche unten, um Ihr Passwort zurückzusetzen:",
      button: "Passwort zurücksetzen",
      footer: "Wenn Sie diese Aktion nicht durchgeführt haben, können Sie diese E-Mail ignorieren."
    },
    fr: {
      subject: "Réinitialisez votre mot de passe",
      title: "Demande de réinitialisation du mot de passe",
      text: "Veuillez cliquer sur le bouton ci-dessous pour réinitialiser votre mot de passe :",
      button: "Réinitialiser le mot de passe",
      footer: "Si vous n'êtes pas à l'origine de cette action, vous pouvez ignorer cet e-mail en toute sécurité."
    },
    ja: {
      subject: "パスワードをリセットしてください",
      title: "パスワードリセットのリクエスト",
      text: "パスワードをリセットするには、下のボタンをクリックしてください：",
      button: "パスワードをリセット",
      footer: "このアクションに心当たりがない場合は、このメールを無視していただいて構いません。"
    },
    fa: {
      subject: "رمز عبور خود را بازنشانی کنید",
      title: "درخواست بازنشانی رمز عبور",
      text: "برای بازنشانی رمز عبور خود، لطفاً روی دکمه زیر کلیک کنید:",
      button: "بازنشانی رمز عبور",
      footer: "اگر این کار را شما انجام نداده‌اید، می‌توانید این ایمیل را نادیده بگیرید."
    }
  }[locale] || {
    tr: {
      subject: "Şifrenizi Sıfırlayın",
      title: "Şifre Sıfırlama İsteği",
      text: "Şifrenizi sıfırlamak için lütfen aşağıdaki butona tıklayın:",
      button: "Şifreyi Sıfırla",
      footer: "Eğer bu işlemi siz yapmadıysanız bu e-postayı görmezden gelebilirsiniz."
    }
  }.tr;

  try {
    const { data, error } = await withTimeout(
      resend.emails.send({
        from: process.env.RESEND_FROM || "BagajPark <info@bagajpark.com>",
        to: email,
        subject: content.subject,
        html: `
        <div dir="${locale === "fa" ? "rtl" : "ltr"}" style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #ea580c;">${content.title}</h1>
          <p style="color: #374151;">${content.text}</p>
          <a href="${resetLink}"
             style="display: inline-block; background-color: #ea580c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0;">
            ${content.button}
          </a>
          <p style="margin-top: 24px; font-size: 0.875rem; color: #6b7280;">
            ${content.footer}
          </p>
        </div>
      `,
      }),
      MAIL_SEND_TIMEOUT_MS,
      "password_reset_email_send",
    );

    if (error) {
      logger.error({ error, email }, "password_reset_email_error");
    } else {
      logger.info({ email, id: data?.id }, "password_reset_email_sent");
    }
  } catch (error) {
    logger.error({ error, email }, "password_reset_email_exception");
  }
};

export const sendMobileOtp = async (email: string, code: string, locale: string = "tr") => {
  const resend = getResendClient();
  if (!resend) {
    logger.warn({ email }, "mobile_otp_mail_skipped_no_resend_key");
    return;
  }

  /**
   * NEDEN 6 DİL: bu nesne yalnızca `tr`/`en` içeriyordu; mobil uygulama giriş
   * kodu diğer 4 dilde Türkçe geliyordu.
   */
  const content = {
    tr: {
      subject: "Giriş Kodunuz",
      title: "Giriş Yapmak İçin Kodunuz",
      text: "BagajPark mobil uygulamasına giriş yapmak için kullanacağınız onay kodu:",
      footer: "Bu kod 5 dakika içinde geçerliliğini yitirecektir."
    },
    en: {
      subject: "Your Login Code",
      title: "Your Login Code",
      text: "Here is your verification code to log in to the BagajPark mobile app:",
      footer: "This code will expire in 5 minutes."
    },
    de: {
      subject: "Ihr Anmeldecode",
      title: "Ihr Anmeldecode",
      text: "Hier ist Ihr Bestätigungscode, um sich in der BagajPark-App anzumelden:",
      footer: "Dieser Code läuft in 5 Minuten ab."
    },
    fr: {
      subject: "Votre code de connexion",
      title: "Votre code de connexion",
      text: "Voici votre code de vérification pour vous connecter à l'application mobile BagajPark :",
      footer: "Ce code expirera dans 5 minutes."
    },
    ja: {
      subject: "ログインコード",
      title: "ログインコード",
      text: "BagajParkモバイルアプリにログインするための確認コードです：",
      footer: "このコードは5分後に無効になります。"
    },
    fa: {
      subject: "کد ورود شما",
      title: "کد ورود شما",
      text: "این کد تأیید برای ورود به اپلیکیشن موبایل BagajPark است:",
      footer: "این کد تا ۵ دقیقه دیگر منقضی می‌شود."
    }
  }[locale] || {
    tr: {
      subject: "Giriş Kodunuz",
      title: "Giriş Yapmak İçin Kodunuz",
      text: "BagajPark mobil uygulamasına giriş yapmak için kullanacağınız onay kodu:",
      footer: "Bu kod 5 dakika içinde geçerliliğini yitirecektir."
    }
  }.tr;

  try {
    const { data, error } = await withTimeout(
      resend.emails.send({
        from: process.env.RESEND_FROM || "BagajPark <info@bagajpark.com>",
        to: email,
        subject: content.subject,
        html: `
        <div dir="${locale === "fa" ? "rtl" : "ltr"}" style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 12px;">
          <h1 style="color: #ea580c;">${content.title}</h1>
          <p style="color: #374151; font-size: 16px;">${content.text}</p>
          <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-radius: 8px; margin: 24px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #0f172a;">${code}</span>
          </div>
          <p style="font-size: 0.875rem; color: #6b7280; text-align: center;">
            ${content.footer}
          </p>
        </div>
      `,
      }),
      MAIL_SEND_TIMEOUT_MS,
      "mobile_otp_email_send",
    );

    if (error) {
      logger.error({ error, email }, "mobile_otp_mail_error");
    } else {
      logger.info({ email, id: data?.id }, "mobile_otp_mail_sent");
    }
  } catch (error) {
    logger.error({ error, email }, "mobile_otp_mail_exception");
  }
};
