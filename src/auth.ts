import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { Role } from "@prisma/client";
import prisma from "@/lib/db";
import { authConfig } from "./auth.config";

/**
 * Auth.js (v5) - Merkezi Kimlik Doğrulama Konfigürasyonu
 * Google ve Apple sosyal girişlerini ve RBAC (Role-Based Access Control) yönetimini sağlar.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  trustHost:
    process.env.AUTH_TRUST_HOST === "true" ||
    process.env.NODE_ENV === "development" ||
    process.env.VERCEL === "1",
  ...authConfig,
  callbacks: {
    async session({ session, token }: any) {
      if (session.user) {
        session.user.role = token.role || Role.GUEST;
        session.user.id = token.sub || "";
      }
      return session;
    },
    async jwt({ token, user }: any) {
      if (user) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
        });
        token.role = dbUser?.role || Role.GUEST;
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
});

