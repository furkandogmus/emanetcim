import prisma from "@/lib/db";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { sendSupportReplyEmail } from "@/lib/mail";
import { replySubjectForMailto, normalizeInboundSubjectLine } from "@/lib/reply-subject";
import logger from "@/lib/logger";

/**
 * Destek mesajına e-postayla cevap — web panelinin ve mobil admin ucunun ORTAK gövdesi.
 *
 * NEDEN SERVİSTE: gövde önce yalnızca `replyToContactMessageAction`'daydı; mobil
 * admin ekranı "cevap web'den verilir" diyordu (2026-10-18). Mobil uca ikinci bir
 * kopya yazmak yerine gövde buraya taşındı: alıcı adresi, gönderen adresi,
 * konu sadeleştirme ve "gönderilmediyse kaydetme" kuralı tek yerde.
 */

export const contactReplyBodySchema = z.string().trim().min(2).max(5000);

export type ContactReplyResult =
  | {
      ok: true;
      reply: { id: string; body: string; fromEmail: string; createdAt: string };
    }
  | {
      ok: false;
      code: "invalid_input" | "too_many_requests" | "not_found" | "email_send_failed";
    };

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

export async function replyToContactMessage(input: {
  messageId: string;
  body: string;
  actorId: string;
}): Promise<ContactReplyResult> {
  const parsedBody = contactReplyBodySchema.safeParse(input.body);
  if (!parsedBody.success || input.messageId.length < 10 || input.messageId.length > 64) {
    return { ok: false, code: "invalid_input" };
  }
  const body = parsedBody.data;

  if (!(await rateLimit(`contact_reply:${input.actorId}`, 30, 60 * 60 * 1000))) {
    return { ok: false, code: "too_many_requests" };
  }

  const message = await prisma.contactMessage.findUnique({
    where: { id: input.messageId },
    select: { id: true, from: true, to: true, subject: true, inboundMessageId: true },
  });
  if (!message) return { ok: false, code: "not_found" };

  const toEmail = message.from.match(/<([^>]+)>/)?.[1] ?? message.from.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(toEmail)) {
    return { ok: false, code: "invalid_input" };
  }

  const fromEmail = replyFromAddress(message.to);
  const subject = replySubjectForMailto(normalizeInboundSubjectLine(message.subject ?? ""));

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
    return { ok: false, code: "email_send_failed" };
  }

  const reply = await prisma.contactReply.create({
    data: {
      contactMessageId: message.id,
      fromEmail,
      toEmail,
      subject,
      body,
      resendId: sent.id,
      sentBy: input.actorId,
    },
  });
  await prisma.contactMessage.update({
    where: { id: message.id },
    data: { isRead: true },
  });

  logger.info({ contactMessageId: message.id, resendId: sent.id }, "contact_reply_sent");

  return {
    ok: true,
    reply: {
      id: reply.id,
      body: reply.body,
      fromEmail: reply.fromEmail,
      createdAt: reply.createdAt.toISOString(),
    },
  };
}
