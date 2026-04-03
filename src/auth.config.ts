import Google from "next-auth/providers/google";
import Apple from "next-auth/providers/apple";
import Credentials from "next-auth/providers/credentials";
import type { NextAuthConfig } from "next-auth";
import { verifyPassword } from "@/lib/auth-password";
import { rateLimit } from "@/lib/rate-limit";

/**
 * OAuth sağlayıcıları env eksikken bile tanımlanırsa Auth.js `Configuration` hatası verebilir;
 * yalnızca kimlik bilgisi doluysa eklenir.
 */
const oauthProviders = [
  ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? [
        Google({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }),
      ]
    : []),
  ...(process.env.APPLE_ID && process.env.APPLE_SECRET
    ? [
        Apple({
          clientId: process.env.APPLE_ID,
          clientSecret: process.env.APPLE_SECRET,
        }),
      ]
    : []),
];

/**
 * Auth.js Edge-Compatible Configuration
 */
export const authConfig = {
  providers: [
    ...oauthProviders,
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = (credentials?.email as string | undefined)?.trim();
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        if (
          !rateLimit(`credentials:${email.toLowerCase()}`, 25, 15 * 60 * 1000)
        ) {
          return null;
        }

        const { default: prisma } = await import("@/lib/db");
        const user = await prisma.user.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
        });
        if (!user?.passwordHash) return null;

        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email ?? email,
          name: user.name ?? email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session.user) {
        session.user.role = token.role;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const userRole = (auth?.user as any)?.role;
      const pathname = nextUrl.pathname;

      const isAdminRoute = pathname.match(/^\/(tr|en)\/admin/) || pathname.startsWith("/admin");
      const isPartnerRoute = pathname.match(/^\/(tr|en)\/partner/) || pathname.startsWith("/partner");

      if (isAdminRoute) {
        if (!isLoggedIn) return false;
        if (userRole !== "ADMIN") return Response.redirect(new URL("/", nextUrl));
        return true;
      }

      if (isPartnerRoute) {
        if (!isLoggedIn) return false;
        if (userRole !== "PARTNER" && userRole !== "ADMIN") {
          return Response.redirect(new URL("/", nextUrl));
        }
        return true;
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
