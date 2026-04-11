"use server";

import { auth } from "@/auth";
import { generateVerificationToken } from "@/lib/tokens";
import { sendVerificationEmail } from "@/lib/mail";
import { getLocale } from "next-intl/server";

/**
 * Oturumu açık olan ama e-postası doğrulanmamış kullanıcıya tekrar link gönderir.
 */
export async function resendVerificationAction() {
  const session = await auth();

  if (!session?.user?.email) {
    return { success: false, error: "Errors.authRequired" };
  }

  if (session.user.emailVerified) {
    return { success: false, error: "Errors.generic" };
  }

  if (session.user.role === "PARTNER") {
    return { success: false, error: "Errors.generic" };
  }

  // Exponential Backoff: 3dk, 6dk ve Destek fall-back
  const { getVerificationBackoff, recordVerificationAttempt } = await import("@/lib/verification-backoff");
  const backoff = await getVerificationBackoff(session.user.email);

  if (!backoff.canResend) {
    if (backoff.maxReached) {
      return { success: false, error: "Errors.maxVerificationAttempts" };
    }
    return { 
      success: false, 
      error: "Errors.verificationCooldown", 
      metadata: { waitSeconds: backoff.waitSeconds } 
    };
  }

  try {
    const locale = await getLocale();
    const verificationToken = await generateVerificationToken(session.user.email);
    await sendVerificationEmail(session.user.email, verificationToken.token, locale);
    
    // Denemeyi kaydet (count artır)
    await recordVerificationAttempt(session.user.email);
    
    return { success: true };
  } catch (error) {
    console.error("[resendVerificationAction]", error);
    return { success: false, error: "Errors.generic" };
  }
}
