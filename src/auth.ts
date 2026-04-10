import "@/lib/auth-public-url";
import NextAuth from "next-auth";
import type { Session, User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { Role } from "@prisma/client";
import prisma from "@/lib/db";
import { authConfig } from "./auth.config";

/**
 * Auth.js (v5) - Merkezi Kimlik Doğrulama Konfigürasyonu
 * Google ve Apple sosyal girişlerini ve RBAC (Role-Based Access Control) yönetimini sağlar.
 */
/** ADMIN_EMAILS: virgülle ayrılmış e-posta listesi; Google ile ilk girişte bu adresler otomatik ADMIN olur. */
const adminEmailSet = new Set(
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  ...authConfig,
  events: {
    async linkAccount({ user, account }) {
      if (account.type === "oauth") {
        await prisma.user.update({
          where: { id: user.id },
          data: { emailVerified: new Date() },
        });
      }
    },
  },
  callbacks: {
    ...authConfig.callbacks,
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        session.user.role = token.role || Role.GUEST;
        session.user.id = token.sub || "";
        // JWT serileştirmesinde Tarih stringleşebilir, istemci tarafı için Date nesnesi olduğundan emin oluyoruz.
        session.user.emailVerified = token.emailVerified ? new Date(token.emailVerified as unknown as string) : null;
      }
      return session;
    },
    async jwt({ token, user, trigger, session }: { token: JWT; user?: User; trigger?: string; session?: { user?: { emailVerified?: Date | string | null } } }) {
      if (user) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
        });

        const emailLower = (user.email ?? "").toLowerCase();
        if (adminEmailSet.has(emailLower) && dbUser?.role !== Role.ADMIN) {
          await prisma.user.update({
            where: { id: user.id },
            data: { role: Role.ADMIN },
          });
          token.role = Role.ADMIN;
        } else {
          token.role = dbUser?.role || Role.GUEST;
        }
        token.emailVerified = dbUser?.emailVerified || null;
      }
      
      // Handle manual updates (e.g. from useSession().update())
      if (trigger === "update" && session?.user) {
        if (session.user.emailVerified) token.emailVerified = new Date(session.user.emailVerified as string);
      }

      return token;
    },
  },
  pages: {
    signIn: "/login",
    error: "/auth/error",
  },
  /** Yerel geliştirmede .env’de AUTH_SECRET yoksa giriş `Configuration` hatası verir; prod’da AUTH_SECRET zorunlu. */
  secret:
    process.env.AUTH_SECRET ||
    (process.env.NODE_ENV === "development"
      ? "dev-only-auth-secret-not-for-production"
      : undefined),
  // Son sırada: ...authConfig ve setEnvDefaults ile ezilmesin. Docker/nginx/ngrok arkasında Host güvenilir.
  // AUTH_TRUST_HOST=false ile kapatılabilir.
  trustHost: process.env.AUTH_TRUST_HOST !== "false",
});

