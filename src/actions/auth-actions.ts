"use server";

import { auth } from "@/auth";
import { generateVerificationToken } from "@/lib/tokens";
import { sendVerificationEmail } from "@/lib/mail";
import { rateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";
import { getLocale } from "next-intl/server";

/**
 * Oturumu açık olan ama e-postası doğrulanmamış kullanıcıya tekrar link gönderir.
 */
export async function resendVerificationAction() {
  const session = await auth();

  if (!session?.user?.email) {
    return { success: false, error: "Oturum açmanız gerekiyor." };
  }

  // Zaten doğrulanmışsa gerek yok
  if (session.user.emailVerified) {
    return { success: false, error: "E-postanız zaten doğrulanmış." };
  }

  // Rate limit: Aynı IP'den 1 dakikada sadece 1 kez link istenebilir
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  
  if (!(await rateLimit(`resend_email:${ip}`, 1, 60 * 1000))) {
    return { success: false, error: "Lütfen yeni bir link istemeden önce 1 dakika bekleyin." };
  }

  try {
    const locale = await getLocale();
    const verificationToken = await generateVerificationToken(session.user.email);
    await sendVerificationEmail(session.user.email, verificationToken.token, locale);
    
    return { success: true };
  } catch (error) {
    console.error("[resendVerificationAction]", error);
    return { success: false, error: "E-posta gönderilirken bir hata oluştu." };
  }
}
