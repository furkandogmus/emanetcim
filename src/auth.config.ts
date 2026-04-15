import type { NextAuthConfig } from "next-auth";
import Apple from "next-auth/providers/apple";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { Role, User as PrismaUser } from "@prisma/client";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { isAppleOAuthConfigured } from "@/lib/auth-providers";

const loginSchema = z.object({
  emailOrPhone: z.string().min(1, "Errors.invalidData"),
  password: z.string().min(1, "Errors.authRequired"),
});

export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    ...(isAppleOAuthConfigured()
      ? [
          Apple({
            clientId: process.env.APPLE_ID!,
            clientSecret: process.env.APPLE_SECRET!,
          }),
        ]
      : []),
    Credentials({
      name: "credentials",
      credentials: {
        emailOrPhone: { label: "Email or Phone", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { emailOrPhone, password } = parsed.data;

        // Rate limit kontrolü
        if (!(await rateLimit(`login:${emailOrPhone.toLowerCase()}`, 10, 60 * 60 * 1000))) {
          throw new Error("Errors.tooManyRequests");
        }

        const { default: prisma } = await import("@/lib/db");
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: { equals: emailOrPhone, mode: "insensitive" } },
              { phone: emailOrPhone }
            ]
          },
        });

        if (!user || !user.passwordHash) return null;

        const { verifyPassword } = await import("@/lib/auth-password");
        const isValid = await verifyPassword(password, user.passwordHash);
        if (!isValid) return null;

        // Ban kontrolü
        if ((user as PrismaUser).isBanned) {
          throw new Error("UserBanned");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          emailVerified: user.emailVerified,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "credentials") {
        const { default: prisma } = await import("@/lib/db");
        
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! },
        });

        if (existingUser && (existingUser as PrismaUser).isBanned) {
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = (user as PrismaUser).role;
        token.emailVerified = (user as PrismaUser).emailVerified;
      }
      if (trigger === "update" && session) {
        token.name = session.user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.emailVerified = token.emailVerified as Date | null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login", // Hata durumunda login sayfasına ve query param'a düşer (auth-error-message.ts ile yakalıyoruz)
  },
} satisfies NextAuthConfig;

export default authConfig;
