import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import prisma from "@/lib/db";
import { hashPassword } from "@/lib/auth-password";
import { isRateLimited } from "@/lib/internal-api-guard";

/**
 * POST /api/admin/setup
 *
 * Production ortamında ilk admin / partner / guest hesabı oluşturur.
 * Koruma: `ADMIN_SETUP_KEY` env değişkeni `setupKey` body alanıyla eşleşmeli.
 * `ADMIN_SETUP_ENABLED=true` ve `ADMIN_SETUP_KEY` birlikte verilmedikçe endpoint kapalıdır.
 * Varsayılan olarak ilk ADMIN oluşturulduktan sonra endpoint tekrar çalışmaz.
 *
 * Body:
 *   { setupKey, email, password, name?, role? }
 *   role: "ADMIN" | "PARTNER" | "GUEST"  (varsayılan: "ADMIN")
 *
 * Yanıtlar:
 *   201 – kullanıcı oluşturuldu / güncellendi
 *   400 – eksik alan
 *   401 – geçersiz setupKey
 *   403 – endpoint devre dışı (ADMIN_SETUP_KEY tanımsız)
 *   500 – DB hatası
 */
export async function POST(req: NextRequest) {
  const setupEnabled = process.env.ADMIN_SETUP_ENABLED?.trim() === "true";
  const setupKey = process.env.ADMIN_SETUP_KEY?.trim();
  if (!setupEnabled || !setupKey) {
    return NextResponse.json(
      {
        error:
          "Setup endpoint disabled. Set ADMIN_SETUP_ENABLED=true and ADMIN_SETUP_KEY for temporary bootstrap.",
      },
      { status: 403 }
    );
  }

  if (await isRateLimited(req, "admin_setup", 10, 900_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: { setupKey?: string; email?: string; password?: string; name?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { setupKey: providedKey, email, password, name, role } = body;

  if (providedKey !== setupKey) {
    return NextResponse.json({ error: "Invalid setup key." }, { status: 401 });
  }

  if (!email || !password) {
    return NextResponse.json({ error: "email and password are required." }, { status: 400 });
  }

  const allowReseed = process.env.ADMIN_SETUP_ALLOW_RESEED?.trim() === "true";
  if (!allowReseed) {
    const existingAdmin = await prisma.user.findFirst({
      where: { role: Role.ADMIN },
      select: { id: true },
    });
    if (existingAdmin) {
      return NextResponse.json(
        {
          error:
            "Setup endpoint locked because an admin already exists. Use ADMIN_SETUP_ALLOW_RESEED=true only for controlled recovery.",
        },
        { status: 403 },
      );
    }
  }

  const validRoles = [Role.ADMIN, Role.PARTNER, Role.GUEST];
  const userRole: Role = validRoles.includes(role as Role) ? (role as Role) : Role.ADMIN;

  try {
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.upsert({
      where: { email },
      update: { 
        passwordHash, 
        role: userRole,
        emailVerified: new Date(),
        ...(name ? { name } : {}) 
      },
      create: {
        email,
        name: name ?? email,
        role: userRole,
        passwordHash,
        emailVerified: new Date(),
      },
    });

    return NextResponse.json(
      {
        ok: true,
        id: user.id,
        email: user.email,
        role: user.role,
        created: user.createdAt,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[setup] DB error:", err);
    return NextResponse.json({ error: "Database error." }, { status: 500 });
  }
}

/** GET /api/admin/setup — endpoint durumunu döndürür (key göstermez). */
export async function GET() {
  const enabled =
    process.env.ADMIN_SETUP_ENABLED?.trim() === "true" &&
    !!process.env.ADMIN_SETUP_KEY?.trim();
  return NextResponse.json({
    enabled,
    usage: enabled ? "POST with { setupKey, email, password, role? }" : "disabled",
  });
}
