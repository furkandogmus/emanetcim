import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Partner → Stripe Connect OAuth başlatıcı.
 * Partner "Stripe Hesabını Bağla" düğmesine tıkladığında buraya yönlendirilir.
 * Stripe Express onboarding URL'si oluşturur ve redirect eder.
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/tr/login", req.url));
  }
  if (session.user.role !== "PARTNER" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const clientId = process.env.STRIPE_CLIENT_ID?.trim();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://bagajpark.com";

  if (!clientId) {
    return NextResponse.json(
      { error: "Stripe Connect yapılandırılmamış (STRIPE_CLIENT_ID eksik)." },
      { status: 503 }
    );
  }

  // state = userId — callback'te CSRF doğrulaması için
  const state = Buffer.from(session.user.id).toString("base64url");
  const redirectUri = `${baseUrl}/api/stripe/connect/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    scope: "read_write",
    response_type: "code",
    redirect_uri: redirectUri,
    state,
    "stripe_user[business_type]": "individual",
    "stripe_user[country]": "TR",
  });

  // Partner'ın mevcut e-postasını önceden doldur
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, name: true },
  });
  if (user?.email) params.set("stripe_user[email]", user.email);
  if (user?.name) params.set("stripe_user[first_name]", user.name.split(" ")[0]);

  return NextResponse.redirect(
    `https://connect.stripe.com/oauth/authorize?${params.toString()}`
  );
}
