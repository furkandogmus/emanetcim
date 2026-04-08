import { Resend } from "resend";
import logger from "@/lib/logger";

const resend = new Resend(process.env.RESEND_API_KEY);
const domain = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const sendVerificationEmail = async (email: string, token: string) => {
  const confirmLink = `${domain}/new-verification?token=${token}`;

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM || "BagajPark <info@bagajpark.com>",
      to: email,
      subject: "E-postanızı Doğrulayın",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #ea580c;">BagajPark'a Hoş Geldiniz!</h1>
          <p>Hesabınızı doğrulamak için lütfen aşağıdaki butona tıklayın:</p>
          <a href="${confirmLink}" 
             style="display: inline-block; background-color: #ea580c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
            E-postayı Doğrula
          </a>
          <p style="margin-top: 24px; font-size: 0.875rem; color: #6b7280;">
            Eğer bu işlemi siz yapmadıysanız bu e-postayı görmezden gelebilirsiniz.
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

export const sendPasswordResetEmail = async (email: string, token: string) => {
  const resetLink = `${domain}/new-password?token=${token}`;

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM || "BagajPark <info@bagajpark.com>",
      to: email,
      subject: "Şifrenizi Sıfırlayın",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #ea580c;">Şifre Sıfırlama İsteği</h1>
          <p>Şifrenizi sıfırlamak için lütfen aşağıdaki butona tıklayın:</p>
          <a href="${resetLink}" 
             style="display: inline-block; background-color: #ea580c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
            Şifreyi Sıfırla
          </a>
          <p style="margin-top: 24px; font-size: 0.875rem; color: #6b7280;">
            Eğer bu işlemi siz yapmadıysanız bu e-postayı görmezden gelebilirsiniz.
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
