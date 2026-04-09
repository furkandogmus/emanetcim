import { Resend } from "resend";
import logger from "@/lib/logger";

const resend = new Resend(process.env.RESEND_API_KEY);
const domain = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const sendVerificationEmail = async (email: string, token: string, locale: string = "tr") => {
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
