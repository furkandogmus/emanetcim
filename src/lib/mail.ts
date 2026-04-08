import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const domain = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * E-posta doğrulama linkini gönderir.
 * @param email Alıcı e-posta adresi
 * @param token Doğrulama tokenı
 */
export const sendVerificationEmail = async (email: string, token: string) => {
  const confirmLink = `${domain}/auth/verify-email?token=${token}`;

  const { data, error } = await resend.emails.send({
    from: "BagajPark <onboarding@bagajpark.com>",
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
    console.error("[mail] Verification email failed:", error);
  } else {
    console.log("[mail] Verification email sent:", data?.id, "→", email);
  }
};
