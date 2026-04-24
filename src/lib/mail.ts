import { Resend } from "resend";
import logger from "@/lib/logger";

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
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM || "BagajPark <info@bagajpark.com>",
      to: email,
      subject: content.subject,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
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
    });

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
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM || "BagajPark <info@bagajpark.com>",
      to: email,
      subject: content.subject,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
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
    });

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
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM || "BagajPark <info@bagajpark.com>",
      to: email,
      subject: content.subject,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 12px;">
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
    });

    if (error) {
      logger.error({ error, email }, "mobile_otp_mail_error");
    } else {
      logger.info({ email, id: data?.id }, "mobile_otp_mail_sent");
    }
  } catch (error) {
    logger.error({ error, email }, "mobile_otp_mail_exception");
  }
};
