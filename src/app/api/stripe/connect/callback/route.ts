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
  let locale = "tr";
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

  // CSRF: state = base64url({ uid, loc }) ; geriye dönük uyumluluk için düz userId de desteklenir.
  let stateUserId: string;
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    if (decoded.startsWith("{")) {
      const parsed = JSON.parse(decoded) as { uid?: string; loc?: string };
      stateUserId = String(parsed.uid ?? "");
      if (parsed.loc && /^[a-z]{2}$/i.test(parsed.loc)) {
        locale = parsed.loc.toLowerCase();
      }
    } else {
      stateUserId = decoded;
    }
  } catch {
    return NextResponse.redirect(`${settingsUrl}?stripe_error=invalid_state`);
  }

  const localizedSettingsUrl = `${baseUrl}/${locale}/partner/settings`;

  if (stateUserId !== session.user.id) {
    return NextResponse.redirect(`${localizedSettingsUrl}?stripe_error=state_mismatch`);
  }

  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    return NextResponse.redirect(`${localizedSettingsUrl}?stripe_error=not_configured`);
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
      return NextResponse.redirect(`${localizedSettingsUrl}?stripe_error=no_shop`);
    }

    await prisma.shop.update({
      where: { id: shop.id },
      data: { stripeAccountId },
    });

    logger.info({ shopId: shop.id, stripeAccountId }, "stripe_connect_linked");
    return NextResponse.redirect(`${localizedSettingsUrl}?stripe_connected=1`);
  } catch (err) {
    logger.error({ err }, "stripe_connect_callback_error");
    return NextResponse.redirect(`${localizedSettingsUrl}?stripe_error=oauth_failed`);
  }
}
