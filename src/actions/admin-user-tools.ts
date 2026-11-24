"use server";

import { z } from "zod";
import { getClientIpOrNull } from "@/lib/client-ip";
import { requireAdmin } from "@/lib/action-auth";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import { accountPrivacyService } from "@/services/AccountPrivacyService";
import { adminUserService } from "@/services/AdminUserService";

/*
  Yonetici kullanici araclari (web). Govdeler mobil `admin/users/[id]` uclariyla ortak:
  KVKK silmesi `AccountPrivacyService.anonymizeByAdmin`, inceleme hesabi
  `AdminUserService.setReviewSandbox`. Hata kodlari servisin kodlari; istemci
  `AdminUserAccount.error_<kod>` ile cevirir.
*/

export type AdminUserToolResult = { ok: true } | { ok: false; error: string };

const anonymizeSchema = z.object({
  userId: z.string().uuid(),
  confirm: z.string().max(320),
  reason: z.string().max(1000),
});

export async function adminAnonymizeUserAction(raw: unknown): Promise<AdminUserToolResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const parsed = anonymizeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Errors.invalidData" };

  const result = await accountPrivacyService.anonymizeByAdmin({
    targetUserId: parsed.data.userId,
    actor: { userId: auth.actor.id, ip: await getClientIpOrNull() },
    confirm: parsed.data.confirm,
    reason: parsed.data.reason,
  });
  if (!result.ok) return { ok: false, error: result.reason };
  revalidatePathAllLocales("/admin/users");
  return { ok: true };
}

const sandboxSchema = z.object({ userId: z.string().uuid(), reviewSandbox: z.boolean() });

export async function adminSetReviewSandboxAction(raw: unknown): Promise<AdminUserToolResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const parsed = sandboxSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Errors.invalidData" };

  const result = await adminUserService.setReviewSandbox(parsed.data.userId, parsed.data.reviewSandbox, {
    userId: auth.actor.id,
    ip: await getClientIpOrNull(),
  });
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePathAllLocales("/admin/users");
  return { ok: true };
}
