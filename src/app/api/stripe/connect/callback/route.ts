import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/db";
import Stripe from "stripe";
import logger from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Stripe Connect OAuth callback.
 * Stripe, partner onayladıktan sonra buraya ?code=xxx&state=yyy ile döner.
 */
export async function GET(req: Request) {
  const session = await auth();
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://bagajpark.com";

  const locale = "tr";
  const settingsUrl = `${baseUrl}/${locale}/partner/settings`;

  if (error) {
    logger.warn({ error }, "stripe_connect_oauth_denied");
    return NextResponse.redirect(
      `${settingsUrl}?stripe_error=${encodeURIComponent(error)}`
    );
  }

  if (!session?.user?.id || !code || !state) {
    return NextResponse.redirect(`${settingsUrl}?stripe_error=invalid_request`);
  }

  // CSRF: state = base64url(userId)
  let stateUserId: string;
  try {
    stateUserId = Buffer.from(state, "base64url").toString("utf8");
  } catch {
    return NextResponse.redirect(`${settingsUrl}?stripe_error=invalid_state`);
  }

  if (stateUserId !== session.user.id) {
    return NextResponse.redirect(`${settingsUrl}?stripe_error=state_mismatch`);
  }

  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    return NextResponse.redirect(`${settingsUrl}?stripe_error=not_configured`);
  }

  try {
    const stripe = new Stripe(secretKey, { apiVersion: "2025-08-27.basil" });

    const response = await stripe.oauth.token({
      grant_type: "authorization_code",
      code,
    });

    const stripeAccountId = response.stripe_user_id;
    if (!stripeAccountId) {
      throw new Error("stripe_user_id missing in OAuth response");
    }

    // Shop bul ve güncelle
    const shop = await prisma.shop.findFirst({
      where: { ownerId: session.user.id },
    });
    if (!shop) {
      return NextResponse.redirect(`${settingsUrl}?stripe_error=no_shop`);
    }

    await prisma.shop.update({
      where: { id: shop.id },
      data: { stripeAccountId },
    });

    logger.info({ shopId: shop.id, stripeAccountId }, "stripe_connect_linked");
    return NextResponse.redirect(`${settingsUrl}?stripe_connected=1`);
  } catch (err) {
    logger.error({ err }, "stripe_connect_callback_error");
    return NextResponse.redirect(`${settingsUrl}?stripe_error=oauth_failed`);
  }
}
