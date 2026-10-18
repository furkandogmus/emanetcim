"use server";

import { getClientIp } from "@/lib/client-ip";

import prisma from "@/lib/db";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import { requireAdmin } from "@/lib/action-auth";
import { contactReplyBodySchema, replyToContactMessage } from "@/services/ContactReplyService";

const contactSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(200),
  message: z.string().min(5).max(2000),
});

export type ContactFormState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; error: string };

export async function sendContactMessageAction(
  _prev: ContactFormState,
  formData: FormData
): Promise<ContactFormState> {
  const ip = await getClientIp();
  const allowed = await rateLimit(`contact:${ip}`, 3, 60_000);
  if (!allowed) {
    return { status: "error", error: "too_many_requests" };
  }

  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    message: formData.get("message"),
  });

  if (!parsed.success) {
    return { status: "error", error: "invalid" };
  }

  const { name, email, message } = parsed.data;

  try {
    await prisma.contactMessage.create({
      data: {
        from: `${name} <${email}>`,
        to: "destek@bagajpark.com",
        subject: `İletişim Formu: ${name}`,
        text: message,
        // Form her zaman gerçek bir insandır; sınıflandırıcı da bu öneke bakar
        // ama burada açıkça yazmak, ikisinin ayrışmasını engelliyor.
        category: "SUPPORT",
        categoryReason: "contact_form",
      },
    });
    return { status: "success" };
  } catch {
    return { status: "error", error: "server" };
  }
}

const replySchema = z.object({
  messageId: z.string().min(10).max(64),
  body: contactReplyBodySchema,
});

const REPLY_ERRORS = {
  invalid_input: "Errors.invalidInput",
  too_many_requests: "Errors.tooManyRequests",
  not_found: "Errors.notFound",
  email_send_failed: "Errors.emailSendFailed",
} as const;

/**
 * Panelden destek cevabı: gerçek e-posta olarak gider, yazışma zincirine bağlanır,
 * geçmişi `ContactReply`'da tutulur. Gövde `ContactReplyService`'te (mobil admin
 * ucu da onu çağırır).
 *
 * NEDEN: eski "Yanıtla" bir `mailto:` linkiydi — cevap adminin KİŞİSEL posta
 * kutusundan gidiyordu ve panelde "cevaplandı mı" bilgisi yoktu.
 */
export async function replyToContactMessageAction(input: unknown) {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false as const, error: auth.error };

  const parsed = replySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: "Errors.invalidInput" };
  }

  const result = await replyToContactMessage({ ...parsed.data, actorId: auth.actor.id });
  if (!result.ok) {
    return { success: false as const, error: REPLY_ERRORS[result.code] };
  }

  revalidatePathAllLocales("/admin/messages");
  return { success: true as const, reply: result.reply };
}
