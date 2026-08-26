"use server";

import prisma from "@/lib/db";
import { normalizeTrGsm10 } from "@/lib/netgsm";
import { generatePasswordResetTokenByPhone } from "@/lib/password-reset-token";
import { writeAuditLog } from "@/lib/audit-log";
import { headers } from "next/headers";
import { requireAdmin } from "@/lib/action-auth";

async function clientIp(): Promise<string | null> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    null
  );
}

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";

/**
 * Admin: partner telefonu ile şifre sıfırlama linki oluşturur.
 * Partner email'siz kaydolduğu için normal "şifremi unuttum" akışı çalışmaz.
 * Admin linki kopyalayıp partner'e WhatsApp/telefonla iletir.
 */
export async function adminInitiatePartnerPasswordResetAction(
  phone: string,
): Promise<
  | { ok: true; resetUrl: string; userName: string }
  | { ok: false; error: string }
> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const normalized = normalizeTrGsm10(phone);
  if (!normalized) {
    return { ok: false, error: "invalid_phone" };
  }

  const user = await prisma.user.findUnique({
    where: { phone: normalized },
    select: { id: true, name: true, email: true },
  });

  if (!user) {
    return { ok: false, error: "user_not_found" };
  }

  const row = await generatePasswordResetTokenByPhone(normalized);

  writeAuditLog({
    actorUserId: auth.actor.id,
    actorRole: auth.actor.role,
    action: "partner.password_reset_initiated",
    entityType: "User",
    entityId: user.id,
    metadata: { phone: normalized, tokenId: row.token },
    ip: await clientIp(),
  });

  const resetUrl = `${BASE_URL}/tr/auth/new-password?token=${row.token}`;
  return { ok: true, resetUrl, userName: user.name || normalized };
}
