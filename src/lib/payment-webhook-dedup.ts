import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import logger from "@/lib/logger";

export { iyzicoWebhookDedupKey } from "@/lib/iyzico-webhook-dedup-key";

export async function isPaymentWebhookProcessed(
  dedupKey: string,
): Promise<boolean> {
  const row = await prisma.processedPaymentWebhook.findUnique({
    where: { dedupKey },
    select: { id: true },
  });
  return !!row;
}

/**
 * Aynı webhook olayını yalnızca bir kez işle; tekrarlar 200 ile kısa devre.
 */
export async function claimPaymentWebhookEvent(params: {
  provider: string;
  dedupKey: string;
  paymentId?: string | null;
  conversationId?: string | null;
}): Promise<"new" | "duplicate"> {
  try {
    await prisma.processedPaymentWebhook.create({
      data: {
        provider: params.provider,
        dedupKey: params.dedupKey,
        paymentId: params.paymentId ?? null,
        conversationId: params.conversationId ?? null,
      },
    });
    return "new";
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      logger.info(
        { provider: params.provider, dedupKey: params.dedupKey },
        "payment_webhook_duplicate_ignored",
      );
      return "duplicate";
    }
    throw e;
  }
}
