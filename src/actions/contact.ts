"use server";

import prisma from "@/lib/db";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";
import { sendSupportReplyEmail } from "@/lib/mail";
import { replySubjectForMailto, normalizeInboundSubjectLine } from "@/lib/reply-subject";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import logger from "@/lib/logger";
import { requireAdmin } from "@/lib/action-auth";

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
  const h = await headers();
  const ip = h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "unknown";
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
  body: z.string().min(2).max(5000),
});

/**
 * Gelen kutusu adresi mi? Cevap, misafirin YAZDIĞI adresten dönmeli
 * (destek@bagajpark.com'a yazdıysa cevap oradan gelmeli) — ama yalnızca kendi
 * domain'imizse. Aksi hâlde RESEND_FROM'a düşülür; keyfî bir adresi "from"
 * yapmak Resend'de domain doğrulamasına takılır.
 */
function replyFromAddress(inboundTo: string): string {
  const addr = inboundTo.match(/<([^>]+)>/)?.[1] ?? inboundTo.trim();
  if (/^[a-z0-9._%+-]+@bagajpark\.com$/i.test(addr)) {
    return `BagajPark Destek <${addr}>`;
  }
  return process.env.RESEND_FROM || "BagajPark Destek <destek@bagajpark.com>";
}

/**
 * Panelden destek cevabı: gerçek e-posta olarak gider, yazışma zincirine bağlanır,
 * geçmişi `ContactReply`'da tutulur.
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
  const { messageId, body } = parsed.data;

  if (!(await rateLimit(`contact_reply:${auth.actor.id}`, 30, 60 * 60 * 1000))) {
    return { success: false as const, error: "Errors.tooManyRequests" };
  }

  const message = await prisma.contactMessage.findUnique({
    where: { id: messageId },
    select: { id: true, from: true, to: true, subject: true, inboundMessageId: true },
  });
  if (!message) {
    return { success: false as const, error: "Errors.notFound" };
  }

  const toEmail = message.from.match(/<([^>]+)>/)?.[1] ?? message.from.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(toEmail)) {
    return { success: false as const, error: "Errors.invalidInput" };
  }

  const fromEmail = replyFromAddress(message.to);
  const subject = replySubjectForMailto(
    normalizeInboundSubjectLine(message.subject ?? ""),
  );

  const sent = await sendSupportReplyEmail({
    to: toEmail,
    from: fromEmail,
    subject,
    text: body,
    inReplyTo: message.inboundMessageId,
  });
  if (!sent) {
    // RESEND_API_KEY yok ya da gönderim reddedildi — kayıt YAZILMAZ:
    // gitmemiş bir cevabı "gitti" diye göstermek en kötüsü.
    return { success: false as const, error: "Errors.emailSendFailed" };
  }

  const reply = await prisma.contactReply.create({
    data: {
      contactMessageId: message.id,
      fromEmail,
      toEmail,
      subject,
      body,
      resendId: sent.id,
      sentBy: auth.actor.id,
    },
  });
  await prisma.contactMessage.update({
    where: { id: message.id },
    data: { isRead: true },
  });

  logger.info(
    { contactMessageId: message.id, resendId: sent.id },
    "contact_reply_sent",
  );
  revalidatePathAllLocales("/admin/messages");

  return {
    success: true as const,
    reply: {
      id: reply.id,
      body: reply.body,
      fromEmail: reply.fromEmail,
      createdAt: reply.createdAt.toISOString(),
    },
  };
}
